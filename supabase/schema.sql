-- =====================================================================
-- 團隊工程清單與排程 —— Supabase 資料表、權限、即時同步
-- 用法：Supabase → SQL Editor → New query → 貼上整份 → Run
-- 可以重複執行（已存在的東西會略過或更新），不會刪資料。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 帳號與角色
--    pending 待核准（看不到資料）／viewer 只能看／editor 可編輯／admin 管理員
--    第一個註冊的人自動成為管理員，之後註冊的人都是「待核准」
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text not null default '',
  role        text not null default 'pending' check (role in ('pending', 'viewer', 'editor', 'admin')),
  created_at  timestamptz not null default now()
);

create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'none');
$$;
create or replace function public.can_read() returns boolean
language sql stable as $$ select public.app_role() in ('viewer', 'editor', 'admin') $$;
create or replace function public.can_write() returns boolean
language sql stable as $$ select public.app_role() in ('editor', 'admin') $$;
create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.app_role() = 'admin' $$;

-- 註冊時自動建立 profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(4242);  -- 避免兩人同時註冊都變成管理員
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where role = 'admin') then 'pending' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- profile 保護：不能改 id／email；不能把最後一位管理員降級
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id or coalesce(new.email, '') <> coalesce(old.email, '') then
    raise exception '不能修改帳號 id 或 email';
  end if;
  if old.role = 'admin' and new.role <> 'admin'
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception '至少要保留一位管理員';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- 自己改顯示名稱
create or replace function public.set_my_name(new_name text) returns void
language sql security definer set search_path = public as $$
  update public.profiles set name = left(trim(new_name), 64) where id = auth.uid() and trim(new_name) <> '';
$$;

alter table public.profiles enable row level security;
drop policy if exists "read own or admin" on public.profiles;
create policy "read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "admin update" on public.profiles;
create policy "admin update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete" on public.profiles;
create policy "admin delete" on public.profiles for delete to authenticated
  using (public.is_admin() and id <> auth.uid());

-- ---------------------------------------------------------------------
-- 2. 工作資料（只放文字與網路磁碟路徑，不放任何檔案本體）
-- ---------------------------------------------------------------------
create table if not exists public.members (
  id    text primary key,
  name  text not null,
  sort  int  not null default 0
);

create table if not exists public.machines (
  id    text primary key,
  name  text not null
);

create table if not exists public.settings (
  id        text primary key,            -- 目前只有一筆：app
  workdays  boolean not null default false
);

create table if not exists public.eng_items (
  id          text primary key,
  item        text not null default '',
  owner       text not null default '',
  cust_owner  text not null default '',
  machine     text not null default '',
  status      text not null default '未開始',
  due         date,
  priority    text not null default '普通',
  remark      text not null default '',
  days        numeric,
  sort_order  double precision not null default 0,
  updated     text not null default '',
  updated_by  text not null default ''
);

create table if not exists public.eng_logs (
  id        text primary key,
  row_id    text not null references public.eng_items(id) on delete cascade,
  log_date  date not null,
  author    text not null default '',
  body      text not null,
  created   text not null default '',
  updated   text not null default ''
);
create index if not exists eng_logs_row_idx on public.eng_logs (row_id, log_date);

create table if not exists public.eng_files (
  id       text primary key,
  row_id   text not null references public.eng_items(id) on delete cascade,
  name     text not null,
  kind     text not null default 'link',
  url      text not null,                -- http(s) 連結，或 \\server\share\... 網路磁碟路徑
  created  text not null default ''
);
create index if not exists eng_files_row_idx on public.eng_files (row_id);

create table if not exists public.prod_plans (
  id          text primary key,
  machine     text not null default '',
  grp         text not null default '',
  product     text not null default '',
  hw          boolean not null default false,
  start_date  date,
  end_date    date,
  remark      text not null default '',
  updated     text not null default '',
  updated_by  text not null default ''
);

-- 「更新者」一律由資料庫填登入者的名稱，不能冒用
create or replace function public.stamp_updated_by() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select name into n from public.profiles where id = auth.uid();
  if n is not null then new.updated_by := n; end if;
  return new;
end $$;
drop trigger if exists stamp_updated_by on public.eng_items;
create trigger stamp_updated_by before insert or update on public.eng_items
  for each row execute function public.stamp_updated_by();
drop trigger if exists stamp_updated_by on public.prod_plans;
create trigger stamp_updated_by before insert or update on public.prod_plans
  for each row execute function public.stamp_updated_by();

-- ---------------------------------------------------------------------
-- 3. 權限（RLS）：核准後才看得到；editor／admin 才能改；共用設定只有 admin 能改
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['members', 'machines', 'settings', 'eng_items', 'eng_logs', 'eng_files', 'prod_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('drop policy if exists "insert" on public.%I', t);
    execute format('drop policy if exists "update" on public.%I', t);
    execute format('drop policy if exists "delete" on public.%I', t);
    execute format('create policy "read" on public.%I for select to authenticated using (public.can_read())', t);
    if t = 'settings' then
      execute format('create policy "insert" on public.%I for insert to authenticated with check (public.is_admin())', t);
      execute format('create policy "update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
      execute format('create policy "delete" on public.%I for delete to authenticated using (public.is_admin())', t);
    else
      execute format('create policy "insert" on public.%I for insert to authenticated with check (public.can_write())', t);
      execute format('create policy "update" on public.%I for update to authenticated using (public.can_write()) with check (public.can_write())', t);
      execute format('create policy "delete" on public.%I for delete to authenticated using (public.can_write())', t);
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on public.profiles from anon;
grant select, update, delete on public.profiles to authenticated;
revoke execute on function public.set_my_name(text) from public, anon;
grant execute on function public.set_my_name(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. 即時同步（多人同時開頁面，一邊改另一邊馬上看到）
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'members', 'machines', 'settings', 'eng_items', 'eng_logs', 'eng_files', 'prod_plans'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
