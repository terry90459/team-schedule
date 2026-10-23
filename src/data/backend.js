import { SEED } from '../lib/util';

/* ============================================================
   資料後端介面 —— 畫面只透過這組函式存取資料，換後端時只改這一層
   每個資源＝一張資料表（每筆資料各自一列，多人同時改不會互相覆蓋）：
     rows → eng_items     plans → prod_plans     logs → eng_logs（row_id → eng_items.id）
     files → eng_files（row_id → eng_items.id）  members / machines / settings
   介面：
     subscribe(res, cb, onErr) → unsubscribe     cb(list) 每次收到該資源完整清單
     create(res, id, body) / update(res, id, patch) / remove(res, id)
   ============================================================ */
const RES = ['rows', 'plans', 'logs', 'files', 'members', 'machines', 'settings', 'customers'];

// ---------- Supabase ----------
// 這版網頁需要的資料庫版本（= supabase/schema.sql 最後的 schema_version()）；改 schema 時兩邊一起加 1
const SCHEMA_VERSION = 4;
const SCHEMA_URL = 'https://github.com/terry90459/team-schedule/blob/main/supabase/schema.sql';
const SB_TABLE = { rows: 'eng_items', plans: 'prod_plans', logs: 'eng_logs', files: 'eng_files', members: 'members', machines: 'machines', settings: 'settings', customers: 'customers' };
// 客戶帳號：只讀資料庫開放的檢視表（部分欄位、只有自己的分頁），其他資源一律不讀
// settings → cust_settings 只有「日曆天／工作天」（v4 起，畫工程時程圖用）
const SB_CUST_VIEW = { rows: 'cust_items', plans: 'cust_plans', settings: 'cust_settings' };
const CUST_RES = new Set(['rows', 'plans', 'customers', 'settings']);
// 前端欄位 → 資料庫欄位（沒列出的同名）
const SB_RENAME = {
  rows: { custOwner: 'cust_owner', order: 'sort_order', updatedBy: 'updated_by', customer: 'customer_id' },
  plans: { group: 'grp', start: 'start_date', end: 'end_date', updatedBy: 'updated_by', customer: 'customer_id' },
  logs: { rowId: 'row_id', date: 'log_date', text: 'body' },
  files: { rowId: 'row_id' },
  members: { profileId: 'profile_id' },
};
const SB_READONLY = new Set(['profileId']); // 只能由資料庫設定（帳號連動）
const SB_COLS = {
  rows: ['item', 'owner', 'custOwner', 'machine', 'status', 'due', 'priority', 'remark', 'days', 'order', 'updated', 'updatedBy', 'customer'],
  plans: ['machine', 'group', 'product', 'hw', 'start', 'end', 'remark', 'updated', 'updatedBy', 'customer'],
  logs: ['rowId', 'date', 'author', 'text', 'created', 'updated'],
  files: ['rowId', 'name', 'kind', 'url', 'created'],
  members: ['name', 'sort', 'team', 'profileId'], machines: ['name'], settings: ['workdays'], customers: ['name', 'sort', 'internal'],
};
const SB_NULL = new Set(['due', 'start', 'end', 'days', 'date', 'customer']); // 空字串存成 NULL
function toDb(res, obj) {
  const out = {}, ren = SB_RENAME[res] || {};
  for (const k of SB_COLS[res]) {
    if (!(k in obj) || SB_READONLY.has(k)) continue;
    let v = obj[k];
    if (SB_NULL.has(k) && (v === '' || v === undefined)) v = null;
    if (k === 'days' && v !== null) { v = Number(v); if (!Number.isFinite(v)) v = null; }
    out[ren[k] || k] = v;
  }
  return out;
}
function fromDb(res, row) {
  const out = { id: row.id }, ren = SB_RENAME[res] || {};
  for (const k of SB_COLS[res]) { const v = row[ren[k] || k]; out[k] = v === null || v === undefined ? (k === 'hw' || k === 'workdays' || k === 'internal' ? false : '') : v; }
  if (res === 'rows' && out.days !== '') out.days = Number(out.days);
  return out;
}
const POLL_MS = 20000;
function supabaseBackend(sb, onLive, cust) {
  const reg = {}, live = {};
  const setLive = (res, v) => { live[res] = v; onLive && onLive(Object.values(live).every(Boolean)); };
  return {
    kind: 'sb',
    subscribe(res, cb, onErr) {
      if (cust && !CUST_RES.has(res)) { cb([]); return () => {}; }
      const T = (cust && SB_CUST_VIEW[res]) || SB_TABLE[res];
      let map = new Map(), alive = true, timer = null;
      const emit = () => { if (alive) cb([...map.values()]); };
      const load = async () => {
        const all = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await sb.from(T).select('*').range(from, from + 999);
          if (error) {
            // 資料庫還沒更新到 v4（沒有 cust_settings）：當作日曆天，不跳錯誤
            if (cust && res === 'settings') { cb([]); return; }
            onErr && onErr(error); return;
          }
          all.push(...data);
          if (data.length < 1000) break;
        }
        map = new Map(all.map((r) => [r.id, fromDb(res, r)]));
        emit();
      };
      reg[res] = { put: (row) => { map.set(row.id, fromDb(res, row)); emit(); }, drop: (id) => { map.delete(id); emit(); }, load };
      load();
      if (cust) {   // 客戶帳號讀不到基本資料表的即時通知，固定每 20 秒重新讀取
        timer = setInterval(load, POLL_MS);
        return () => { alive = false; clearInterval(timer); };
      }
      // 即時同步；公司網路若擋 WebSocket，就退回每 20 秒重新讀取
      const ch = sb.channel('rt-' + T)
        .on('postgres_changes', { event: '*', schema: 'public', table: T }, (p) => {
          if (p.eventType === 'DELETE') map.delete(p.old.id); else map.set(p.new.id, fromDb(res, p.new));
          emit();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') { setLive(res, true); clearInterval(timer); timer = null; load(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setLive(res, false);
            if (!timer && alive) timer = setInterval(load, POLL_MS);
          }
        });
      setLive(res, false);
      const fallback = setTimeout(() => { if (!live[res] && !timer && alive) timer = setInterval(load, POLL_MS); }, 10000);
      return () => { alive = false; clearTimeout(fallback); clearInterval(timer); sb.removeChannel(ch); };
    },
    async create(res, id, body) {
      const { data, error } = await sb.from(SB_TABLE[res]).insert({ id, ...toDb(res, body) }).select();
      if (error) throw error;
      if (data && data[0]) reg[res] && reg[res].put(data[0]);
    },
    async update(res, id, p) {
      const { data, error } = await sb.from(SB_TABLE[res]).update(toDb(res, p)).eq('id', id).select();
      if (error) throw error;
      if (!data || !data.length) throw { code: 'not_found' };
      reg[res] && reg[res].put(data[0]);
    },
    async remove(res, id) {
      const { error } = await sb.from(SB_TABLE[res]).delete().eq('id', id);
      if (error) throw error;
      reg[res] && reg[res].drop(id);
    },
    // 資料庫端函式（改名、連結帳號）
    async rpc(fn, args) { const { error } = await sb.rpc(fn, args); if (error) throw error; },
    refresh: (list) => Promise.all((list || Object.keys(reg)).map((r) => reg[r] && reg[r].load())),
  };
}

// ---------- 沒設定 Supabase 時：存在這台裝置（試用／開發用）----------
function localBackend() {
  const KEY = { rows: 'worklist.v2', plans: 'worklist.plan.v1', logs: 'worklist.logs.v1', files: 'worklist.files.v1', members: 'worklist.members.v1', machines: 'worklist.machines.v2', settings: 'worklist.settings.v1', customers: 'worklist.customers.v1' };
  const read = (k) => { try { const a = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(a) ? a : null; } catch (e) { return null; } };
  const data = {}, subs = {};
  RES.forEach((r) => { data[r] = read(KEY[r]) || (r === 'rows' ? SEED : []); subs[r] = new Set(); });
  const emit = (r) => { try { localStorage.setItem(KEY[r], JSON.stringify(data[r])); } catch (e) {} subs[r].forEach((cb) => cb(data[r])); };
  return {
    kind: 'local',
    subscribe(r, cb) { subs[r].add(cb); cb(data[r]); return () => subs[r].delete(cb); },
    async create(r, id, body) { data[r] = [...data[r].filter((x) => x.id !== id), { ...body, id }]; emit(r); },
    async update(r, id, p) { if (!data[r].some((x) => x.id === id)) throw { code: 'not_found' }; data[r] = data[r].map((x) => (x.id === id ? { ...x, ...p } : x)); emit(r); },
    async remove(r, id) { data[r] = data[r].filter((x) => x.id !== id); emit(r); },
  };
}

export { RES, SCHEMA_VERSION, SCHEMA_URL, SB_TABLE, SB_CUST_VIEW, CUST_RES, SB_RENAME, SB_READONLY, SB_COLS, SB_NULL, toDb, fromDb, POLL_MS, supabaseBackend, localBackend };
