-- =====================================================================
-- 團隊工程清單與排程 —— Supabase 資料表、權限、即時同步
-- 用法：Supabase → SQL Editor → New query → 貼上整份 → Run
-- 可以重複執行（已存在的東西會略過或更新），不會刪資料。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 帳號：狀態（status）與權限（role）分開
--    status：pending 待核准／active 使用中／disabled 已停用（後兩者以外都看不到資料）
--    role  ：viewer 只能看／engineer 工程師／planner Planner／admin 管理員
--    is_owner：最高管理員（只有一位），唯一能刪除帳號的人；不能被降級或停用
--    第一個註冊的人自動成為最高管理員，之後註冊的人都是「待核准」
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text not null default '',
  role        text not null default 'engineer',
  created_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists status text;
alter table public.profiles add column if not exists is_owner boolean not null default false;

-- 舊版資料轉換：role 裡的 pending → status；editor → engineer
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles disable trigger user;
update public.profiles set status = case when role = 'pending' then 'pending' else 'active' end where status is null;
update public.profiles set role = 'engineer' where role in ('pending', 'editor');
-- 最高管理員：還沒有的話，指定最早註冊的管理員
update public.profiles set is_owner = true
 where id = (select id from public.profiles where role = 'admin' and status = 'active' order by created_at limit 1)
   and not exists (select 1 from public.profiles where is_owner);
alter table public.profiles enable trigger user;
alter table public.profiles alter column status set default 'pending';
alter table public.profiles alter column status set not null;
alter table public.profiles alter column role set default 'engineer';
alter table public.profiles add constraint profiles_role_check check (role in ('viewer', 'engineer', 'planner', 'admin'));
alter table public.profiles add constraint profiles_status_check check (status in ('pending', 'active', 'disabled'));
create unique index if not exists profiles_one_owner on public.profiles (is_owner) where is_owner;

-- 目前登入者的有效權限：沒啟用就回傳狀態（pending／disabled／none）
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select case when status = 'active' then role else status end from public.profiles where id = auth.uid()), 'none');
$$;
create or replace function public.can_read() returns boolean
language sql stable as $$ select public.app_role() in ('viewer', 'engineer', 'planner', 'admin') $$;
create or replace function public.can_eng() returns boolean
language sql stable as $$ select public.app_role() in ('engineer', 'admin') $$;
create or replace function public.can_plan() returns boolean
language sql stable as $$ select public.app_role() in ('planner', 'admin') $$;
create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.app_role() = 'admin' $$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner and status = 'active' from public.profiles where id = auth.uid()), false);
$$;

-- 註冊時自動建立 profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first boolean;
begin
  perform pg_advisory_xact_lock(4242);  -- 避免兩人同時註冊都變成管理員
  first := not exists (select 1 from public.profiles where role = 'admin' and status = 'active');
  insert into public.profiles (id, email, name, role, status, is_owner)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when first then 'admin' else 'engineer' end,
    case when first then 'active' else 'pending' end,
    first and not exists (select 1 from public.profiles where is_owner)
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- profile 保護
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id or coalesce(new.email, '') <> coalesce(old.email, '') then
    raise exception '不能修改帳號 id 或 email';
  end if;
  if new.is_owner is distinct from old.is_owner and auth.uid() is not null then
    raise exception '最高管理員只能在 Supabase SQL Editor 變更';
  end if;
  if old.is_owner and (new.role <> 'admin' or new.status <> 'active') then
    raise exception '最高管理員不能被降級或停用';
  end if;
  if old.role = 'admin' and old.status = 'active' and not (new.role = 'admin' and new.status = 'active')
     and not exists (select 1 from public.profiles where role = 'admin' and status = 'active' and id <> old.id) then
    raise exception '至少要保留一位管理員';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- 顯示名稱只由管理員修改（見第 5 節 rename_member），移除舊版的自行改名
drop function if exists public.set_my_name(text);

alter table public.profiles enable row level security;
drop policy if exists "read own or admin" on public.profiles;
create policy "read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "admin update" on public.profiles;
create policy "admin update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete" on public.profiles;   -- 刪帳號改走 delete_account（只限最高管理員）

-- 刪除帳號：只有最高管理員可以；登入帳號一起刪除（成員清單可選擇保留，歷史資料的名字不會變）
create or replace function public.delete_account(target uuid, remove_member boolean default false) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_owner() then raise exception '只有最高管理員可以刪除帳號'; end if;
  if target = auth.uid() then raise exception '不能刪除自己的帳號'; end if;
  if exists (select 1 from public.profiles where id = target and is_owner) then raise exception '不能刪除最高管理員'; end if;
  -- remove_member 參數保留相容；現在一律從成員清單移除（由 drop_member_on_delete 處理）
  delete from auth.users where id = target;
end $$;
revoke execute on function public.delete_account(uuid, boolean) from public, anon;
grant execute on function public.delete_account(uuid, boolean) to authenticated;

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
  if current_setting('app.skip_stamp', true) = 'on' then return new; end if;  -- 改名連動時不覆寫
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
-- 3. 權限（RLS）：核准後才看得到；
--    工程清單／紀錄／附件 → 工程師、管理員；生產排程 → Planner、管理員；成員／機台／設定 → 管理員
-- ---------------------------------------------------------------------
do $$
declare t text; w text;
begin
  foreach t in array array['members', 'machines', 'settings', 'eng_items', 'eng_logs', 'eng_files', 'prod_plans'] loop
    w := case when t in ('eng_items', 'eng_logs', 'eng_files') then 'public.can_eng()'
              when t = 'prod_plans' then 'public.can_plan()'
              else 'public.is_admin()' end;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read" on public.%I', t);
    execute format('drop policy if exists "insert" on public.%I', t);
    execute format('drop policy if exists "update" on public.%I', t);
    execute format('drop policy if exists "delete" on public.%I', t);
    execute format('create policy "read" on public.%I for select to authenticated using (public.can_read())', t);
    execute format('create policy "insert" on public.%I for insert to authenticated with check (%s)', t, w);
    execute format('create policy "update" on public.%I for update to authenticated using (%s) with check (%s)', t, w, w);
    execute format('create policy "delete" on public.%I for delete to authenticated using (%s)', t, w);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
drop function if exists public.can_write();  -- 舊版函式，已改成 can_eng／can_plan

revoke all on public.profiles from anon;
revoke delete on public.profiles from authenticated;
grant select, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 5. 成員清單與帳號連動
--    · 帳號被核准為 工程師／Planner／管理員 → 自動加入成員清單（同名的舊成員會直接連上）
--    · 成員分兩組：engineer（工程清單 Owner 下拉）、planner
--    · 改名（rename_member／改帳號名稱）會一併更新 Owner、紀錄人、更新者
-- ---------------------------------------------------------------------
alter table public.members add column if not exists team text not null default 'engineer';
alter table public.members add column if not exists profile_id uuid references public.profiles(id) on delete set null;
alter table public.members drop constraint if exists members_team_check;
alter table public.members add constraint members_team_check check (team in ('engineer', 'planner'));
create unique index if not exists members_profile_uidx on public.members (profile_id) where profile_id is not null;
create unique index if not exists members_name_uidx on public.members (lower(name));

-- 把所有資料裡的舊名字換成新名字（不覆寫「更新時間／更新者」的戳記）
create or replace function public._rename_everywhere(old_name text, new_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if old_name is null or new_name is null or old_name = new_name or old_name = '' then return; end if;
  perform set_config('app.skip_stamp', 'on', true);
  update public.eng_items  set owner = new_name      where owner = old_name;
  update public.eng_items  set updated_by = new_name where updated_by = old_name;
  update public.prod_plans set updated_by = new_name where updated_by = old_name;
  update public.eng_logs   set author = new_name     where author = old_name;
  perform set_config('app.skip_stamp', 'off', true);
end $$;
revoke execute on function public._rename_everywhere(text, text) from public, anon, authenticated;

-- 帳號 → 成員清單
create or replace function public.sync_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.members%rowtype; tm text;
begin
  if tg_op = 'UPDATE' and new.name is distinct from old.name then
    if exists (select 1 from public.members where lower(name) = lower(new.name) and profile_id is distinct from new.id
               and (profile_id is not null or exists (select 1 from public.members x where x.profile_id = new.id))) then
      raise exception '成員名稱「%」已經有人使用', new.name;
    end if;
    perform public._rename_everywhere(old.name, new.name);
    update public.members set name = new.name where profile_id = new.id;
  end if;
  -- 停用：從成員清單移除（他名下的工作會在工程清單顯示警示）；恢復時會重新加入
  if new.status = 'disabled' then delete from public.members where profile_id = new.id; return new; end if;
  if new.status <> 'active' or new.role not in ('engineer', 'planner', 'admin') then return new; end if;
  tm := case new.role when 'planner' then 'planner' when 'engineer' then 'engineer' else null end;
  select * into m from public.members where profile_id = new.id;
  if found then
    if tm is not null and m.team <> tm then update public.members set team = tm where id = m.id; end if;
    return new;
  end if;
  select * into m from public.members where lower(name) = lower(new.name) limit 1;
  if found then
    if m.profile_id is not null then raise exception '成員名稱「%」已經連到其他帳號，請先改名', new.name; end if;
    update public.members set profile_id = new.id, team = coalesce(tm, m.team) where id = m.id;
  else
    insert into public.members (id, name, sort, team, profile_id)
    values ('m' || substr(md5(new.id::text), 1, 12), new.name,
            coalesce((select max(sort) + 1 from public.members), 0), coalesce(tm, 'engineer'), new.id);
  end if;
  return new;
end $$;
drop trigger if exists sync_member on public.profiles;
create trigger sync_member after insert or update on public.profiles
  for each row execute function public.sync_member();

-- 刪除帳號（不論從網頁或 Supabase 後台）：同時從成員清單移除
create or replace function public.drop_member_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.members where profile_id = old.id;
  return old;
end $$;
drop trigger if exists drop_member_on_delete on public.profiles;
create trigger drop_member_on_delete before delete on public.profiles
  for each row execute function public.drop_member_on_delete();

-- 管理員改成員名稱（有連帳號的，帳號名稱一起改）
create or replace function public.rename_member(member_id text, new_name text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.members%rowtype; n text := left(trim(new_name), 64);
begin
  if not public.is_admin() then raise exception '只有管理員可以改成員名稱'; end if;
  if n = '' then raise exception '名稱不能空白'; end if;
  select * into m from public.members where id = member_id;
  if not found then raise exception '找不到這位成員'; end if;
  if m.name = n then return; end if;
  if exists (select 1 from public.members where lower(name) = lower(n) and id <> member_id) then
    raise exception '成員名稱「%」已經有人使用', n;
  end if;
  if m.profile_id is not null then
    update public.profiles set name = n where id = m.profile_id;   -- 觸發 sync_member 連動
  else
    perform public._rename_everywhere(m.name, n);
    update public.members set name = n where id = member_id;
  end if;
end $$;

-- 管理員把帳號對應到既有成員（例如註冊名稱跟清單裡的寫法不同）
create or replace function public.link_member(p_profile uuid, member_id text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.members%rowtype; old public.members%rowtype; pname text;
begin
  if not public.is_admin() then raise exception '只有管理員可以設定'; end if;
  select * into m from public.members where id = member_id;
  if not found then raise exception '找不到這位成員'; end if;
  if m.profile_id is not null and m.profile_id <> p_profile then raise exception '「%」已經連到其他帳號', m.name; end if;
  select * into old from public.members where profile_id = p_profile;
  select name into pname from public.profiles where id = p_profile;
  if found and old.id is not null and old.id <> member_id then
    update public.members set profile_id = null where id = old.id;
  end if;
  update public.members set profile_id = p_profile where id = member_id;
  if pname is distinct from m.name then
    perform public._rename_everywhere(pname, m.name);
    update public.profiles set name = m.name where id = p_profile;
  end if;
  -- 原本自動建立、已經沒有資料的成員就刪掉
  if old.id is not null and old.id <> member_id
     and not exists (select 1 from public.eng_items where owner = old.name)
     and not exists (select 1 from public.eng_logs where author = old.name) then
    delete from public.members where id = old.id;
  end if;
end $$;

revoke execute on function public.rename_member(text, text) from public, anon;
grant execute on function public.rename_member(text, text) to authenticated;
revoke execute on function public.link_member(uuid, text) from public, anon;
grant execute on function public.link_member(uuid, text) to authenticated;

-- 已停用的帳號：從成員清單移除
delete from public.members where profile_id in (select id from public.profiles where status = 'disabled');
-- 既有帳號補建／連上成員（重複執行沒關係）
update public.profiles set role = role where status = 'active' and role in ('engineer', 'planner', 'admin');

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
