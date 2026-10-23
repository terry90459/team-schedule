// 預覽版用：在瀏覽器記憶體裡模擬 Supabase（資料表、權限、帳號、即時同步、線上名單）
// 只給 demo 建置使用，正式網頁不會載入這個檔案。重新整理頁面就回到初始假資料。
import { stamp } from '../lib/util';

const INTERNAL = ['viewer', 'engineer', 'planner', 'admin'];
const clone = (x) => JSON.parse(JSON.stringify(x));
const err = (message, code = '42501') => ({ data: null, error: { message, code } });

export function createFakeSupabase(seed) {
  const db = clone(seed);
  let me = db.profiles.find((p) => p.is_owner).id;
  let session = null;
  const authCbs = new Set();
  const chans = new Set();
  const presence = {};   // id → [meta]
  (db._online || []).forEach((o) => { presence[o.id] = [o]; });

  const prof = () => db.profiles.find((p) => p.id === me);
  const role = () => { const p = prof(); return !p ? 'none' : p.status !== 'active' ? p.status : p.role; };
  const isOwner = () => { const p = prof(); return !!(p && p.is_owner && p.status === 'active'); };
  const canRead = () => INTERNAL.includes(role());
  const canTab = (cid) => {
    const r = role();
    if (r === 'admin') return true;
    if (['viewer', 'engineer', 'planner'].includes(r)) { const t = prof().tabs; return !t || t.includes(cid); }
    return false;
  };
  const custTabs = () => (role() === 'customer' ? (prof().tabs || []) : []);
  const isInternalTab = (cid) => !!(db.customers.find((c) => c.id === cid) || {}).internal;
  const pick = (r, cols) => Object.fromEntries(cols.map((k) => [k, r[k] ?? null]));

  // 依目前登入者可以看到的範圍（等同資料庫的 RLS 與 cust_* 檢視表）
  function visible(t) {
    const r = role();
    switch (t) {
      case 'eng_items': case 'prod_plans': return canRead() ? db[t].filter((x) => canTab(x.customer_id)) : [];
      case 'eng_logs': case 'eng_files': { const ids = new Set(visible('eng_items').map((x) => x.id)); return db[t].filter((x) => ids.has(x.row_id)); }
      case 'customers': return r === 'customer' ? db.customers.filter((c) => custTabs().includes(c.id) && !c.internal) : db.customers.filter((c) => canTab(c.id));
      case 'cust_items': return db.eng_items.filter((x) => custTabs().includes(x.customer_id) && !isInternalTab(x.customer_id)).map((x) => pick(x, ['id', 'item', 'owner', 'cust_owner', 'machine', 'status', 'due', 'remark', 'sort_order', 'customer_id', 'days']));
      case 'cust_plans': return db.prod_plans.filter((x) => custTabs().includes(x.customer_id) && !isInternalTab(x.customer_id)).map((x) => pick(x, ['id', 'machine', 'grp', 'product', 'start_date', 'end_date', 'customer_id']));
      case 'cust_settings': return role() === 'customer' ? db.settings.map((x) => pick(x, ['id', 'workdays'])) : [];
      case 'members': case 'machines': case 'settings': return canRead() ? db[t] : [];
      case 'profiles': return r === 'admin' ? db.profiles : db.profiles.filter((p) => p.id === me);
      case 'signup_allow': return r === 'admin' ? db.signup_allow : [];
      default: return [];
    }
  }
  function canWrite(t, row) {
    const r = role();
    if (t === 'eng_items') return ['engineer', 'admin'].includes(r) && canTab(row.customer_id);
    if (t === 'prod_plans') return ['planner', 'admin'].includes(r) && canTab(row.customer_id);
    if (t === 'eng_logs' || t === 'eng_files') return ['engineer', 'admin'].includes(r) && visible('eng_items').some((x) => x.id === row.row_id);
    if (t === 'signup_allow') return isOwner();
    return r === 'admin';
  }
  function emit(t, eventType, nw, old) {
    chans.forEach((c) => c.pg.forEach((l) => { if (l.table === t) setTimeout(() => l.cb({ eventType, new: nw || {}, old: old || {} }), 0); }));
  }
  function stampRow(t, row, old) {
    if (t === 'eng_items' || t === 'prod_plans') {
      const same = old && Object.keys(row).every((k) => k === 'sort_order' || k === 'updated_by' || JSON.stringify(row[k]) === JSON.stringify(old[k]));
      if (same) { row.updated_by = old.updated_by; return; }
      row.updated = stamp(); row.updated_by = (prof() || {}).name || row.updated_by;
    }
    if (t === 'eng_logs') { if (!old) row.created = stamp(); if (!old || row.body !== old.body || row.log_date !== old.log_date || row.author !== old.author) row.updated = stamp(); }
    if (t === 'eng_files' && !old) row.created = stamp();
    if (t === 'signup_allow' && !old) { row.created_by = (prof() || {}).name || ''; row.created_at = new Date().toISOString(); }
  }
  // 帳號狀態變更 → 成員清單（等同 sync_member）
  function syncMember(p) {
    if (p.status === 'disabled' || p.role === 'customer') { db.members = db.members.filter((m) => m.profile_id !== p.id); return; }
    if (p.status !== 'active' || !['engineer', 'planner', 'admin'].includes(p.role)) return;
    const team = p.role === 'planner' ? 'planner' : 'engineer';
    const m = db.members.find((x) => x.profile_id === p.id) || db.members.find((x) => !x.profile_id && x.name.toLowerCase() === p.name.toLowerCase());
    if (m) { m.profile_id = p.id; if (p.role !== 'admin') m.team = team; }
    else db.members.push({ id: 'm' + Math.random().toString(36).slice(2, 10), name: p.name, sort: db.members.length, team, profile_id: p.id });
    emit('members', 'UPDATE', {}, {});
  }

  class Query {
    constructor(t) { this.t = t; this.op = 'select'; this.f = []; this.cols = null; this.ord = null; this.rg = null; this.one = false; }
    select(cols) { if (this.op === 'select') this.cols = cols && cols !== '*' ? cols.split(',').map((s) => s.trim()) : null; return this; }
    insert(v) { this.op = 'insert'; this.val = v; return this; }
    update(v) { this.op = 'update'; this.val = v; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.f.push([c, v]); return this; }
    order(c, o) { this.ord = [c, !(o && o.ascending === false)]; return this; }
    range(a, b) { this.rg = [a, b]; return this; }
    maybeSingle() { this.one = true; return this; }
    then(ok, no) { return Promise.resolve().then(() => this.run()).then(ok, no); }
    match(r) { return this.f.every(([c, v]) => r[c] === v); }
    run() {
      const t = this.t;
      if (this.op === 'select') {
        let l = visible(t).filter((r) => this.match(r));
        if (this.ord) { const [c, asc] = this.ord; l = [...l].sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1)); }
        if (this.rg) l = l.slice(this.rg[0], this.rg[1] + 1);
        l = l.map((r) => (this.cols ? pick(r, this.cols) : clone(r)));
        return { data: this.one ? l[0] || null : l, error: null };
      }
      if (this.op === 'insert') {
        const rows = (Array.isArray(this.val) ? this.val : [this.val]).map((v) => ({ ...v }));
        for (const r of rows) {
          if (!canWrite(t, r)) return err(`new row violates row-level security policy for table "${t}"`);
          if (t === 'customers' && db.customers.some((c) => c.name.toLowerCase() === String(r.name).toLowerCase())) return err('duplicate key value violates unique constraint', '23505');
          if (t === 'signup_allow' && db.signup_allow.some((c) => c.pattern === r.pattern)) return err('duplicate key value violates unique constraint', '23505');
          stampRow(t, r, null);
          db[t].push(r); emit(t, 'INSERT', r);
        }
        return { data: clone(rows), error: null };
      }
      if (this.op === 'update') {
        const out = [];
        for (const r of visible(t === 'profiles' ? 'profiles' : t).filter((x) => this.match(x))) {
          const row = db[t].find((x) => (t === 'signup_allow' ? x.pattern === r.pattern : x.id === r.id));
          if (!canWrite(t, row)) continue;
          const old = { ...row }, next = { ...row, ...this.val };
          if (t === 'profiles') {
            if (old.is_owner && (next.role !== 'admin' || next.status !== 'active')) return err('最高管理員不能被降級或停用', 'P0001');
            if (next.role === 'customer' && (next.tabs || []).some(isInternalTab)) return err('客戶帳號不能指定內部分頁', 'P0001');
          }
          if ((t === 'eng_items' || t === 'prod_plans') && !canWrite(t, next)) continue;
          stampRow(t, next, old);
          Object.assign(row, next);
          if (t === 'profiles') syncMember(row);
          emit(t, 'UPDATE', row, old); out.push(clone(row));
        }
        return { data: out, error: null };
      }
      if (this.op === 'delete') {
        const del = visible(t).filter((x) => this.match(x)).filter((r) => canWrite(t, r));
        const ids = new Set(del.map((x) => (t === 'signup_allow' ? x.pattern : x.id)));
        db[t] = db[t].filter((x) => !ids.has(t === 'signup_allow' ? x.pattern : x.id));
        if (t === 'eng_items') ['eng_logs', 'eng_files'].forEach((c) => { db[c] = db[c].filter((x) => !ids.has(x.row_id)); });
        del.forEach((r) => emit(t, 'DELETE', null, r));
        return { data: null, error: null };
      }
      return err('不支援的操作');
    }
  }

  const rpc = async (fn, a = {}) => {
    switch (fn) {
      case 'schema_version': return { data: 4, error: null };
      case 'email_allowed': { const e = String(a.e || '').toLowerCase(); return { data: !db.signup_allow.length || db.signup_allow.some((x) => x.pattern === e || x.pattern === '@' + e.split('@')[1]), error: null }; }
      case 'rename_member': {
        if (role() !== 'admin') return err('只有管理員可以改成員名稱');
        const m = db.members.find((x) => x.id === a.member_id); if (!m) return err('找不到這位成員');
        const old = m.name; m.name = a.new_name;
        db.eng_items.forEach((r) => { if (r.owner === old) r.owner = a.new_name; if (r.updated_by === old) r.updated_by = a.new_name; });
        db.eng_logs.forEach((l) => { if (l.author === old) l.author = a.new_name; });
        if (m.profile_id) { const p = db.profiles.find((x) => x.id === m.profile_id); if (p) p.name = a.new_name; }
        return { data: null, error: null };
      }
      case 'link_member': {
        const m = db.members.find((x) => x.id === a.member_id); if (!m) return err('找不到這位成員');
        db.members.forEach((x) => { if (x.profile_id === a.p_profile) x.profile_id = null; });
        m.profile_id = a.p_profile; return { data: null, error: null };
      }
      case 'delete_account': {
        if (!isOwner()) return err('只有最高管理員可以刪除帳號');
        db.profiles = db.profiles.filter((p) => p.id !== a.target); db.members = db.members.filter((m) => m.profile_id !== a.target);
        return { data: null, error: null };
      }
      case 'restore_backup': {
        if (!isOwner()) return err('只有最高管理員可以還原備份');
        const t = a.data && a.data.tables; if (!a.data || a.data.app !== 'team-schedule' || !t) return err('這不是本系統的備份檔');
        const out = {};
        ['customers', 'eng_items', 'eng_logs', 'eng_files', 'prod_plans', 'machines', 'settings', 'members', 'signup_allow'].forEach((k) => { if (Array.isArray(t[k])) { db[k] = clone(t[k]); out[k] = t[k].length; } });
        db.profiles.filter((p) => p.status === 'active').forEach(syncMember);
        Object.keys(out).forEach((k) => emit(k, 'UPDATE', {}, {}));
        return { data: out, error: null };
      }
      default: return err('預覽版不支援：' + fn);
    }
  };

  function channel(name) {
    const c = {
      pg: [], pres: [], status: null,
      on(type, filter, cb) { if (type === 'postgres_changes') this.pg.push({ table: filter.table, cb }); else if (type === 'presence') this.pres.push(cb); return this; },
      subscribe(cb) { chans.add(this); setTimeout(() => cb && cb('SUBSCRIBED'), 0); return this; },
      presenceState() { return clone(presence); },
      async track(meta) { presence[me] = [meta]; chans.forEach((x) => x.pres.forEach((f) => setTimeout(f, 0))); },
      async untrack() { delete presence[me]; },
    };
    return c;
  }

  const mkSession = () => { const p = prof(); return p ? { user: { id: p.id, email: p.email }, access_token: 'demo' } : null; };
  const fire = () => authCbs.forEach((cb) => cb('SIGNED_IN', session));
  const api = {
    from: (t) => new Query(t),
    rpc,
    channel,
    removeChannel(c) { chans.delete(c); },
    auth: {
      async getSession() { return { data: { session } }; },
      onAuthStateChange(cb) { authCbs.add(cb); return { data: { subscription: { unsubscribe: () => authCbs.delete(cb) } } }; },
      async signOut() { session = null; authCbs.forEach((cb) => cb('SIGNED_OUT', null)); return { error: null }; },
      async signInWithPassword({ email }) {
        const p = db.profiles.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
        if (!p) return { error: { message: 'Invalid login credentials' } };
        me = p.id; session = mkSession(); fire(); return { data: { session }, error: null };
      },
      async signUp({ email, options }) {
        const e = String(email).toLowerCase();
        if (db.profiles.some((x) => x.email.toLowerCase() === e)) return { error: { message: 'User already registered' } };
        const ok = !db.signup_allow.length || db.signup_allow.some((x) => x.pattern === e || x.pattern === '@' + e.split('@')[1]);
        if (!ok) return { error: { message: 'Database error saving new user' } };
        const hit = db.signup_allow.filter((x) => (x.pattern === e || x.pattern === '@' + e.split('@')[1]) && x.customer_id).sort((a) => (a.pattern === e ? -1 : 1))[0];
        const p = { id: 'u' + Math.random().toString(36).slice(2, 10), email, name: (options && options.data && options.data.name) || e.split('@')[0], role: hit ? 'customer' : 'viewer', status: 'pending', is_owner: false, tabs: hit ? [hit.customer_id] : null, created_at: new Date().toISOString() };
        db.profiles.push(p); emit('profiles', 'INSERT', p);
        me = p.id; session = mkSession(); fire(); return { data: { session }, error: null };
      },
    },
    // 預覽版專用：直接切換身分
    _demo: {
      profiles: () => clone(db.profiles),
      me: () => me,
      as(id) { me = id; session = mkSession(); fire(); },
      signedIn: () => !!session,
    },
  };
  session = mkSession();
  return api;
}
