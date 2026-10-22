import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// 建置時由 build.mjs 帶入（GitHub → Settings → Secrets and variables → Actions → Variables）
const SB_URL = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
const SB_KEY = typeof __SUPABASE_KEY__ !== 'undefined' ? __SUPABASE_KEY__ : '';
const sbClient = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

/* ============================================================
   常數（沿用 Claude Design 的設定）
   ============================================================ */
const STATUS = ['未開始', '進行中', '等客戶回覆', '待審核', '暫停', '已完成'];
// 已完成、暫停：不算逾期／即將到期，也不做撞機台警示
const QUIET = ['已完成', '暫停'];
const ST = {
  '未開始': ['oklch(0.95 0.004 80)', 'oklch(0.45 0.01 80)'],
  '進行中': ['oklch(0.94 0.035 250)', 'oklch(0.42 0.12 250)'],
  '等客戶回覆': ['oklch(0.94 0.035 200)', 'oklch(0.42 0.09 210)'],
  '待審核': ['oklch(0.94 0.05 85)', 'oklch(0.45 0.1 70)'],
  '暫停': ['oklch(0.93 0.02 20)', 'oklch(0.45 0.05 20)'],
  '已完成': ['oklch(0.94 0.04 155)', 'oklch(0.4 0.1 155)'],
};
const STC = {
  '未開始': 'oklch(0.7 0.01 80)',
  '進行中': 'oklch(0.6 0.12 250)',
  '等客戶回覆': 'oklch(0.62 0.1 210)',
  '待審核': 'oklch(0.72 0.12 75)',
  '暫停': 'oklch(0.62 0.05 20)',
  '已完成': 'oklch(0.6 0.11 155)',
};
const STBG = {
  '未開始': 'oklch(0.95 0.004 80)',
  '進行中': 'oklch(0.94 0.035 250)',
  '等客戶回覆': 'oklch(0.94 0.035 200)',
  '待審核': 'oklch(0.95 0.05 85)',
  '暫停': 'oklch(0.93 0.02 20)',
  '已完成': 'oklch(0.94 0.04 155)',
};
const STTX = {
  '未開始': 'oklch(0.42 0.01 80)',
  '進行中': 'oklch(0.4 0.12 250)',
  '等客戶回覆': 'oklch(0.4 0.09 210)',
  '待審核': 'oklch(0.42 0.1 70)',
  '暫停': 'oklch(0.42 0.05 20)',
  '已完成': 'oklch(0.38 0.1 155)',
};
const PRIO = ['最優先', '優先', '普通', '擱置'];
const PR = {
  '最優先': ['oklch(0.58 0.17 25)', '#fff', 'oklch(0.58 0.17 25)'],
  '優先': ['oklch(0.96 0.04 50)', 'oklch(0.48 0.13 45)', 'oklch(0.86 0.07 50)'],
  '普通': ['#fff', '#3a3833', '#e3e0d9'],
  '擱置': ['#f3f1ec', '#9a968e', '#e3e0d9'],
};
const PRBAR = {
  '最優先': 'oklch(0.58 0.17 25)',
  '優先': 'oklch(0.7 0.12 50)',
  '普通': 'oklch(0.6 0.01 80)',
  '擱置': 'oklch(0.82 0.005 80)',
};
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const UN = '未指派';
const OVER = 'oklch(0.52 0.16 25)';

// 色票 → CSS 變數（淺色／深色主題由 CSS 切換）
const V = {
  bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface2)', tint: 'var(--tint)',
  line: 'var(--line)', line2: 'var(--line2)', line3: 'var(--line3)',
  ink: 'var(--ink)', ink2: 'var(--ink2)', muted: 'var(--muted)', muted2: 'var(--muted2)', faint: 'var(--faint)',
  head: 'var(--head)', btnBg: 'var(--btnBg)', btnFg: 'var(--btnFg)',
  todayBg: 'var(--todayBg)', todayHead: 'var(--todayHead)', accent: 'var(--accent)',
};
const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";

const SEED_NOTE = 'seed';

/* ============================================================
   小工具
   ============================================================ */
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const s2d = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diff = (a, b) => Math.round((a - b) / 86400000);
const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const av = (name) =>
  name === UN
    ? { initial: '?', avBg: 'var(--tint)', avFg: 'var(--muted2)' }
    : { initial: name.slice(0, 1), avBg: `oklch(0.92 0.04 ${hue(name)})`, avFg: `oklch(0.4 0.1 ${hue(name)})` };
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const SEED = [
  ['r1', '會員中心登入頁改版', '進行中', '2026-10-09', '最優先', '依 v2 視覺稿，含 RWD', 4],
  ['r2', '會員中心視覺稿 v2', '待審核', '2026-10-07', '優先', '表單錯誤狀態已調整', 3],
  ['r3', '訂單 API 分頁', '已完成', '2026-10-06', '普通', '改用 cursor-based', 2],
  ['r4', '資料庫備份排程', '進行中', '2026-10-10', '優先', '需補還原測試步驟', 3],
  ['r5', 'Sprint 12 規劃', '未開始', '2026-10-08', '優先', '', 2],
  ['r6', 'Icon 規範整理', '未開始', '2026-10-16', '擱置', '等設計系統定案', 5],
  ['r7', '季度 OKR 檢視', '進行中', '2026-10-09', '普通', '', 2],
].map(([id, item, status, due, priority, remark, days], i) => ({
  id, item, owner: '', machine: '', status, due, priority, remark, files: [], days, updated: '', order: i + 1,
}));

/* ============================================================
   資料後端介面 —— 畫面只透過這組函式存取資料，換後端時只改這一層
   每個資源＝一張資料表（每筆資料各自一列，多人同時改不會互相覆蓋）：
     rows → eng_items     plans → prod_plans     logs → eng_logs（row_id → eng_items.id）
     files → eng_files（row_id → eng_items.id）  members / machines / settings
   介面：
     subscribe(res, cb, onErr) → unsubscribe     cb(list) 每次收到該資源完整清單
     create(res, id, body) / update(res, id, patch) / remove(res, id)
   ============================================================ */
const RES = ['rows', 'plans', 'logs', 'files', 'members', 'machines', 'settings'];

// ---------- Supabase ----------
const SB_TABLE = { rows: 'eng_items', plans: 'prod_plans', logs: 'eng_logs', files: 'eng_files', members: 'members', machines: 'machines', settings: 'settings' };
// 前端欄位 → 資料庫欄位（沒列出的同名）
const SB_RENAME = {
  rows: { custOwner: 'cust_owner', order: 'sort_order', updatedBy: 'updated_by' },
  plans: { group: 'grp', start: 'start_date', end: 'end_date', updatedBy: 'updated_by' },
  logs: { rowId: 'row_id', date: 'log_date', text: 'body' },
  files: { rowId: 'row_id' },
  members: { profileId: 'profile_id' },
};
const SB_READONLY = new Set(['profileId']); // 只能由資料庫設定（帳號連動）
const SB_COLS = {
  rows: ['item', 'owner', 'custOwner', 'machine', 'status', 'due', 'priority', 'remark', 'days', 'order', 'updated', 'updatedBy'],
  plans: ['machine', 'group', 'product', 'hw', 'start', 'end', 'remark', 'updated', 'updatedBy'],
  logs: ['rowId', 'date', 'author', 'text', 'created', 'updated'],
  files: ['rowId', 'name', 'kind', 'url', 'created'],
  members: ['name', 'sort', 'team', 'profileId'], machines: ['name'], settings: ['workdays'],
};
const SB_NULL = new Set(['due', 'start', 'end', 'days', 'date']); // 空字串存成 NULL
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
  for (const k of SB_COLS[res]) { const v = row[ren[k] || k]; out[k] = v === null || v === undefined ? (k === 'hw' || k === 'workdays' ? false : '') : v; }
  if (res === 'rows' && out.days !== '') out.days = Number(out.days);
  return out;
}
const POLL_MS = 20000;
function supabaseBackend(sb, onLive) {
  const reg = {}, live = {};
  const setLive = (res, v) => { live[res] = v; onLive && onLive(Object.values(live).every(Boolean)); };
  return {
    kind: 'sb',
    subscribe(res, cb, onErr) {
      const T = SB_TABLE[res];
      let map = new Map(), alive = true, timer = null;
      const emit = () => { if (alive) cb([...map.values()]); };
      const load = async () => {
        const all = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await sb.from(T).select('*').range(from, from + 999);
          if (error) { onErr && onErr(error); return; }
          all.push(...data);
          if (data.length < 1000) break;
        }
        map = new Map(all.map((r) => [r.id, fromDb(res, r)]));
        emit();
      };
      reg[res] = { put: (row) => { map.set(row.id, fromDb(res, row)); emit(); }, drop: (id) => { map.delete(id); emit(); }, load };
      load();
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
  const KEY = { rows: 'worklist.v2', plans: 'worklist.plan.v1', logs: 'worklist.logs.v1', files: 'worklist.files.v1', members: 'worklist.members.v1', machines: 'worklist.machines.v2', settings: 'worklist.settings.v1' };
  const read = (k) => { try { const a = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(a) ? a : null; } catch (e) { return null; } };
  const data = {}, subs = {};
  RES.forEach((r) => { data[r] = read(KEY[r]) || (r === 'rows' ? SEED : []); subs[r] = new Set(); });
  // 舊版本機資料（名單是一整串字）→ 一筆一列
  if (!read(KEY.members)) { const o = read('worklist.owners.v1'); if (o) data.members = o.map((name, i) => ({ id: 'm' + i, name, sort: i })); }
  if (!read(KEY.machines)) { const o = read('worklist.machines.v1'); if (o) data.machines = o.map((name, i) => ({ id: 'k' + i, name })); }
  const emit = (r) => { try { localStorage.setItem(KEY[r], JSON.stringify(data[r])); } catch (e) {} subs[r].forEach((cb) => cb(data[r])); };
  return {
    kind: 'local',
    subscribe(r, cb) { subs[r].add(cb); cb(data[r]); return () => subs[r].delete(cb); },
    async create(r, id, body) { data[r] = [...data[r].filter((x) => x.id !== id), { ...body, id }]; emit(r); },
    async update(r, id, p) { if (!data[r].some((x) => x.id === id)) throw { code: 'not_found' }; data[r] = data[r].map((x) => (x.id === id ? { ...x, ...p } : x)); emit(r); },
    async remove(r, id) { data[r] = data[r].filter((x) => x.id !== id); emit(r); },
  };
}

/* ============================================================
   資料層：畫面只呼叫這裡，不直接碰後端
   ============================================================ */
const byName = (a, b) => String(a).localeCompare(String(b), 'zh-Hant-TW', { numeric: true, sensitivity: 'base' });
const sortRows = (l) => [...l].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || (a.id < b.id ? -1 : 1));
const uniqNames = (l) => [...new Set(l.map((x) => (x.name || '').trim()).filter(Boolean))];
const strip = ({ id, ...body }) => body;

function useStore(sb, profile) {
  const [d, setD] = useState(() => Object.fromEntries(RES.map((r) => [r, []])));
  const [mode, setMode] = useState('connecting'); // connecting | sb | local
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState(null); // { text, action?: { label, run } }
  const [localMe, setMeState] = useState(() => lsGet('me'));
  const me = profile ? profile.name : localMe;
  // 角色：engineer 改工程清單／紀錄／附件；planner 改生產排程；admin 全部（含成員、機台、設定）；viewer 只能看
  const role = profile ? (profile.status && profile.status !== 'active' ? 'none' : profile.role === 'editor' ? 'engineer' : profile.role) : 'admin';
  const canEngR = role === 'engineer' || role === 'admin', canPlanR = role === 'planner' || role === 'admin';
  const readOnly = !canEngR && !canPlanR;
  const S = useRef({ be: null, assets: null, queues: {}, d: null }).current;
  S.d = d; S.me = me;

  const say = (text, action) => { setNotice({ text, action }); clearTimeout(S.nt); S.nt = setTimeout(() => setNotice(null), action ? 10000 : 9000); };

  useEffect(() => {
    let dead = false;
    const unsubs = [];
    (async () => {
      const be = sb ? supabaseBackend(sb, setLive) : localBackend();
      S.be = be;
      const onErr = (e) => { if (!S.errShown) { S.errShown = true; say('讀取資料失敗：' + ((e && (e.message || e.code)) || '未知原因') + '。請重新整理頁面。'); } };
      RES.forEach((r) => unsubs.push(be.subscribe(r, (list) => setD((x) => ({ ...x, [r]: list })), onErr)));
      setMode(be.kind);
    })();
    return () => { dead = true; unsubs.forEach((u) => u && u()); };
  }, [sb]);

  // 同一筆資料的寫入排隊，一次一個
  const run = (key, fn) => {
    const prev = S.queues[key] || Promise.resolve();
    const next = prev.catch(() => {}).then(fn).catch((e) => {
      if (e && e.code === '42501') say('儲存失敗：你的帳號沒有編輯權限。');
      else if (e && e.code === 'not_found') say('儲存失敗：這筆資料可能已被其他人刪除。');
      else say('儲存失敗' + (e && e.message ? '：' + e.message : '，請檢查網路後再試一次。'));
    });
    S.queues[key] = next;
    return next;
  };
  const be = () => S.be;
  const C = (res, id, body) => run(res + '/' + id, () => be().create(res, id, body));
  const U = (res, id, p) => run(res + '/' + id, () => be().update(res, id, p));
  const X = (res, id) => run(res + '/' + id, () => be().remove(res, id));
  const who = () => ({ updated: stamp(), updatedBy: S.me || '' });

  const rows = useMemo(() => sortRows(d.rows), [d.rows]);
  const memberList = useMemo(() => [...d.members].map((m) => ({ ...m, team: m.team || 'engineer' })).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || byName(a.name, b.name)), [d.members]);
  const owners = useMemo(() => uniqNames(memberList.filter((m) => m.team !== 'planner')), [memberList]);   // 工程清單 Owner 下拉
  const planners = useMemo(() => uniqNames(memberList.filter((m) => m.team === 'planner')), [memberList]);
  const machines = useMemo(() => uniqNames(d.machines).sort(byName), [d.machines]);
  const settings = d.settings.find((x) => x.id === 'app') || {};
  // 附件：files 資源＋舊版存在 row.files 的
  const filesByRow = useMemo(() => {
    const m = new Map();
    d.rows.forEach((r) => (r.files || []).forEach((f) => { if (!m.has(r.id)) m.set(r.id, []); m.get(r.id).push({ ...f, legacy: true }); }));
    [...d.files].sort((a, b) => (a.created || '').localeCompare(b.created || '')).forEach((f) => { if (!m.has(f.rowId)) m.set(f.rowId, []); m.get(f.rowId).push(f); });
    return m;
  }, [d.rows, d.files]);

  // 刪除前先留快照，提供「復原」
  const restore = async (snap) => { for (const [res, list] of snap) for (const x of list) await C(res, x.id, strip(x)); };
  const offerUndo = (text, snap) => say(text, { label: '復原', run: () => { setNotice(null); restore(snap); } });

  const api = {
    rows, owners, planners, machines, settings, plans: d.plans, logs: d.logs, members: memberList, filesByRow,
    mode, live, readOnly, notice, me, profile,
    role,
    canEdit: canEngR && mode !== 'connecting',   // 工程清單、進度紀錄、附件
    canPlan: canPlanR && mode !== 'connecting',  // 機台生產排程
    canAdmin: role === 'admin' && mode !== 'connecting', // 成員／機台清單、共用設定
    canUpload: mode === 'local', // 線上版不存檔案本體，附件一律貼網路磁碟路徑或連結
    setMe(n) { setMeState(n); lsSet('me', n); },
    clearNotice: () => setNotice(null),
    patch(id, p) { return U('rows', id, { ...p, ...who() }); },
    add(extra) {
      const id = uid();
      return C('rows', id, { item: '', owner: '', custOwner: '', machine: '', status: '未開始', due: '', priority: '普通', remark: '', days: 1, order: Date.now(), ...extra, ...who() }).then(() => id);
    },
    async del(id) {
      const row = d.rows.find((r) => r.id === id); if (!row) return;
      const logs = d.logs.filter((x) => x.rowId === id), files = d.files.filter((x) => x.rowId === id);
      // 自建 server 時改由資料庫 ON DELETE CASCADE 處理，下面兩行可拿掉
      for (const l of logs) await X('logs', l.id);
      for (const f of files) await X('files', f.id);
      await X('rows', id);
      offerUndo(`已刪除「${(row.item || '未命名').split('\n')[0].slice(0, 30)}」${logs.length ? `（含 ${logs.length} 則紀錄）` : ''}`, [['rows', [row]], ['logs', logs], ['files', files]]);
    },
    // 成員、機台：一人／一台一筆
    addOwner(name, team = 'engineer') { const n = name.trim(); if (!n || memberList.some((m) => m.name.toLowerCase() === n.toLowerCase())) return; return C('members', 'm' + uid().slice(1), { name: n, sort: d.members.length, team }); },
    setMemberTeam(id, team) { return U('members', id, { team }); },
    // 改名：Owner、紀錄人、更新者一併改；有連帳號的，帳號名稱也一起改
    async renameMember(id, name) {
      const m = memberList.find((x) => x.id === id), n = (name || '').trim();
      if (!m || !n || n === m.name) return true;
      if (memberList.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) { say(`「${n}」已經有人使用`); return false; }
      try {
        if (S.be.rpc) { await S.be.rpc('rename_member', { member_id: id, new_name: n }); await S.be.refresh(); }
        else {
          for (const r of d.rows) { const p = {}; if (r.owner === m.name) p.owner = n; if (r.updatedBy === m.name) p.updatedBy = n; if (Object.keys(p).length) await U('rows', r.id, p); }
          for (const l of d.logs) if (l.author === m.name) await U('logs', l.id, { author: n });
          await U('members', id, { name: n });
          if (S.me === m.name) { setMeState(n); lsSet('me', n); }
        }
        say(`已改名為「${n}」，相關的 Owner、紀錄人、更新者都已更新`);
        return true;
      } catch (e) { say('改名失敗：' + ((e && e.message) || '未知原因')); return false; }
    },
    async linkMember(profileId, memberId) {
      try { await S.be.rpc('link_member', { p_profile: profileId, member_id: memberId }); await S.be.refresh(); return true; }
      catch (e) { say('連結失敗：' + ((e && e.message) || '未知原因')); return false; }
    },
    refresh: () => S.be && S.be.refresh && S.be.refresh(),
    async delOwnerOnly(name) { for (const m of d.members.filter((x) => x.name === name && !x.profileId)) await X('members', m.id); },
    addMachine(name) { const n = name.trim(); if (!n || machines.includes(n)) return; return C('machines', 'k' + uid().slice(1), { name: n }); },
    async delMachine(name) { for (const m of d.machines.filter((x) => x.name === name)) await X('machines', m.id); },
    setSetting(p) { return d.settings.some((x) => x.id === 'app') ? U('settings', 'app', p) : C('settings', 'app', p); },
    // 生產排程
    patchPlan(id, p) { return U('plans', id, { ...p, ...who() }); },
    addPlan(machine, copy) {
      const id = 'p' + uid().slice(1);
      const base = copy ? strip(copy) : { machine: machine || '', group: '', product: '', hw: false, start: '', end: '', remark: '' };
      return C('plans', id, { ...base, ...who() }).then(() => id);
    },
    async delPlan(id) {
      const p = d.plans.find((x) => x.id === id); if (!p) return;
      await X('plans', id);
      offerUndo(`已刪除排程「${p.machine || ''} ${p.product || p.group || ''}」`, [['plans', [p]]]);
    },
    // 進度紀錄
    addLog({ rowId, date, author, text }) {
      const id = 'l' + uid().slice(1), t = stamp();
      return C('logs', id, { rowId, date, author: author || '', text, created: t, updated: t }).then(() => api.patch(rowId, {}));
    },
    patchLog(id, p) { return U('logs', id, { ...p, updated: stamp() }); },
    async delLog(id) {
      const l = d.logs.find((x) => x.id === id); if (!l) return;
      await X('logs', id);
      offerUndo('已刪除一則進度紀錄', [['logs', [l]]]);
    },
    // 附件／連結
    addFile(rowId, f) { const id = 'f' + uid().slice(1); return C('files', id, { rowId, ...f, created: stamp() }).then(() => api.patch(rowId, {})); },
    delFile(rowId, f) {
      if (f.legacy) { const r = d.rows.find((x) => x.id === rowId); return api.patch(rowId, { files: (r.files || []).filter((x) => x.id !== f.id) }); }
      return X('files', f.id).then(() => api.patch(rowId, {}));
    },
    setOrder(id, ord) { return U('rows', id, { order: ord }); },
    async move(id, beforeId) {
      const me = rows.find((r) => r.id === id);
      if (!me) return;
      const oi = rows.findIndex((r) => r.id === id);
      const list = rows.filter((r) => r.id !== id);
      let idx = beforeId ? list.findIndex((r) => r.id === beforeId) : list.length;
      if (idx < 0) idx = list.length;
      if (idx === oi) return;
      const prev = list[idx - 1], next = list[idx];
      const po = prev ? Number(prev.order) : null, no = next ? Number(next.order) : null;
      let ord;
      if (po == null && no == null) ord = 1;
      else if (po == null) ord = no - 1;
      else if (no == null) ord = po + 1;
      else ord = (po + no) / 2;
      const ok = Number.isFinite(ord) && (po == null || ord > po) && (no == null || ord < no);
      if (ok) return api.setOrder(id, ord);
      const seq = [...list.slice(0, idx), me, ...list.slice(idx)];
      for (let i = 0; i < seq.length; i++) {
        const o = (i + 1) * 1024;
        if (seq[i].order !== o) await api.setOrder(seq[i].id, o);
      }
    },
    async removeOwner(name, plan) {
      for (const r of rows.filter((x) => x.owner === name)) {
        const c = plan[r.id];
        if (c === '__del__') {
          for (const l of d.logs.filter((x) => x.rowId === r.id)) await X('logs', l.id);
          for (const f of d.files.filter((x) => x.rowId === r.id)) await X('files', f.id);
          await X('rows', r.id);
        } else await api.patch(r.id, { owner: c || '' });
      }
      await api.delOwnerOnly(name);
    },
    async upload(file) {
      return new Promise((ok, no) => {
        if (file.size > 1.5e6) return no(new Error('too big'));
        const fr = new FileReader();
        fr.onload = () => ok({ name: file.name, url: fr.result });
        fr.onerror = no;
        fr.readAsDataURL(file);
      });
    },
    // 匯出檔案（C3）
    async saveFile(filename, text, type) {
      const blob = new Blob(['﻿' + text], { type: type || 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
    say,
  };
  return api;
}

/* ============================================================
   共用：資料衍生（儀表板用）
   ============================================================ */
// B9：從截止日往回推開始日；workdays=true 時跳過六日
function backDays(due, n, workdays) {
  if (!workdays) return addD(due, -(n - 1));
  let d = new Date(due), left = n - 1;
  while (left > 0) { d = addD(d, -1); if (d.getDay() !== 0 && d.getDay() !== 6) left--; }
  return d;
}
function derive(rowsIn, owners, settings) {
  const wd = !!(settings && settings.workdays);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows = rowsIn.map((r) => {
    const owner = r.owner || UN;
    const due = r.due ? s2d(r.due) : null;
    const days = Math.max(1, Math.ceil(Number(r.days) || 1));
    const start = due ? backDays(due, days, wd) : null;
    const over = !!(due && due < today && !QUIET.includes(r.status));
    const soon = !!(due && !over && !QUIET.includes(r.status) && diff(due, today) <= SOON_DAYS);
    return { ...r, owner, dueD: due, startD: start, dayN: days, over, soon };
  });
  const names = [...new Set([...owners, ...rows.map((r) => r.owner)])].filter((n) => rows.some((r) => r.owner === n));
  // 負責人已不在工程師成員清單（帳號停用／刪除、被移除或移到 Planner 組）
  const gone = new Set(rows.map((r) => r.owner).filter((n) => n && n !== UN && !owners.includes(n)));
  return { today, rows, names, gone };
}

/* ---------- B3：即將到期（3 天內，含今天） ---------- */
const SOON_DAYS = 3;
const SOON = { bd: 'oklch(0.66 0.15 60)', bg: 'oklch(0.95 0.05 75)', fg: 'oklch(0.5 0.13 55)' };
// 回傳 { text, fg }，沒有截止日或已完成則 null
function dueInfo(r, today) {
  if (!r.due || QUIET.includes(r.status)) return null;
  const n = diff(s2d(r.due), today);
  if (n < 0) return { text: `逾期 ${-n} 天`, fg: OVER, kind: 'over' };
  if (n === 0) return { text: '今天到期', fg: SOON.fg, kind: 'soon' };
  if (n <= SOON_DAYS) return { text: `剩 ${n} 天`, fg: SOON.fg, kind: 'soon' };
  return null;
}
// 甘特條顏色：逾期紅、即將到期橘、其餘依狀態
const barTone = (r) => r.over
  ? { bg: 'oklch(0.95 0.03 25)', bd: 'oklch(0.58 0.16 25)', fg: 'oklch(0.45 0.15 25)' }
  : r.soon ? { bg: SOON.bg, bd: SOON.bd, fg: SOON.fg }
  : { bg: STBG[r.status], bd: STC[r.status], fg: STTX[r.status] };

/* ---------- A1：時程圖顯示區間（預設今天前 7 天～後 30 天） ---------- */
const RANGE_BACK = 7, RANGE_STEP = 7;
const RANGES = [[14, '往後 2 週'], [30, '往後 1 個月'], [60, '往後 2 個月'], [90, '往後 3 個月']];
function useRange(key) {
  const lsKey = 'range.' + key;
  const [len, setLenState] = useState(() => { try { const v = Number(localStorage.getItem(lsKey)); if (RANGES.some(([n]) => n === v)) return v; } catch (e) {} return 30; });
  const [off, setOff] = useState(0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lo = addD(today, -RANGE_BACK + off), hi = addD(today, len + off);
  const setLen = (n) => { setLenState(n); try { localStorage.setItem(lsKey, String(n)); } catch (e) {} };
  return { lo, hi, n: diff(hi, lo) + 1, len, off, setLen, prev: () => setOff((o) => o - RANGE_STEP), next: () => setOff((o) => o + RANGE_STEP), home: () => setOff(0) };
}
// 把 [a, b] 夾進區間；整段在區間外回傳 null
function clip(a, b, R) {
  if (b < R.lo || a > R.hi) return null;
  return { a: a < R.lo ? R.lo : a, b: b > R.hi ? R.hi : b, cutL: a < R.lo, cutR: b > R.hi };
}
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
function RangeBar({ R, hidden }) {
  const b = { ...lineBtn, height: 30, padding: '0 10px', fontSize: 12 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <button onClick={R.prev} title={`往前 ${RANGE_STEP} 天`} style={b}>◀ 前 {RANGE_STEP} 天</button>
      <button onClick={R.home} disabled={R.off === 0} title="回到預設區間" style={{ ...b, opacity: R.off === 0 ? 0.5 : 1 }}>今天</button>
      <button onClick={R.next} title={`往後 ${RANGE_STEP} 天`} style={b}>後 {RANGE_STEP} 天 ▶</button>
      <select value={R.len} onChange={(e) => R.setLen(Number(e.target.value))} style={{ ...b, padding: '0 6px' }}>
        {RANGES.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
      </select>
      <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted2, marginLeft: 4 }}>{md(R.lo)} – {md(R.hi)}</span>
      {hidden > 0 && <span style={{ fontSize: 12, color: V.muted2 }}>・另有 {hidden} 筆不在這個區間</span>}
    </div>
  );
}

/* ============================================================
   小元件
   ============================================================ */
function CellText({ value, onCommit, placeholder, style, multiline, disabled, list, rows, className, grow, enterBlur }) {
  const [v, setV] = useState(value || '');
  const ta = useRef(null);
  const fit = () => { const e = ta.current; if (grow && e) { e.style.height = 'auto'; e.style.height = e.scrollHeight + 2 + 'px'; } };
  useEffect(fit, [v]);
  useEffect(() => { const e = ta.current; if (!grow || !e || !window.ResizeObserver) return; let w = e.offsetWidth; const ro = new ResizeObserver(() => { if (e.offsetWidth !== w) { w = e.offsetWidth; fit(); } }); ro.observe(e); return () => ro.disconnect(); }, [grow]);
  useEffect(() => { if (!grow) return; window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, [grow]);
  const focused = useRef(false);
  const dirty = useRef(false);
  useEffect(() => { if (!focused.current) setV(value || ''); }, [value]);
  const commit = () => {
    focused.current = false;
    if (dirty.current && v !== (value || '')) onCommit(v);
    dirty.current = false;
  };
  const p = {
    value: v, placeholder, disabled, list, style, className,
    onFocus: () => { focused.current = true; },
    onChange: (e) => { dirty.current = true; setV(e.target.value); },
    onBlur: commit,
  };
  return multiline
    ? <textarea ref={ta} rows={rows || 1} {...p} onKeyDown={enterBlur ? (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } } : undefined} />
    : <input {...p} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

function Avatar({ name, size = 22 }) {
  const a = av(name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, flex: 'none', background: a.avBg, color: a.avFg }}>
      {a.initial}
    </div>
  );
}

const darkBtn = { height: 32, padding: '0 14px', border: 'none', background: V.btnBg, color: V.btnFg, borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const lineBtn = { height: 32, padding: '0 12px', border: `1px solid ${V.line2}`, background: V.surface, borderRadius: 7, cursor: 'pointer', fontSize: 13 };

/* ============================================================
   工程清單
   ============================================================ */
function RemoveOwnerModal({ name, rows, others, onConfirm, onCancel }) {
  const [plan, setPlan] = useState(() => Object.fromEntries(rows.map((r) => [r.id, others[0] || ''])));
  const open = rows.filter((r) => r.status !== '已完成').length;
  const setAll = (v) => setPlan(Object.fromEntries(rows.map((r) => [r.id, v])));
  const sel = { height: 28, border: `1px solid ${V.line2}`, borderRadius: 6, background: V.surface, padding: '0 6px', fontSize: 12, cursor: 'pointer', maxWidth: 150 };
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(20,19,17,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>移除成員「{name}」</div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: V.muted }}>
            這位成員名下有 <b style={{ color: open ? OVER : V.ink }}>{rows.length} 筆</b> 工作
            {open ? <>，其中 <b style={{ color: OVER }}>{open} 筆尚未完成</b></> : null}。
            移除前請逐筆決定要改派給誰，或直接刪除。
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: V.muted }}>
            全部設為
            <select onChange={(e) => { if (e.target.value !== '__keep__') setAll(e.target.value); e.target.value = '__keep__'; }} defaultValue="__keep__" style={sel}>
              <option value="__keep__">選擇…</option>
              {others.map((o) => <option key={o} value={o}>改派給 {o}</option>)}
              <option value="">設為未指派</option>
              <option value="__del__">全部刪除</option>
            </select>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', borderTop: `1px solid ${V.line}`, borderBottom: `1px solid ${V.line}` }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: `1px solid ${V.line}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.item || '（未命名）'}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: V.faint }}>{r.due || '未設日期'}</div>
              </div>
              <span style={{ fontSize: 11, borderRadius: 10, padding: '2px 8px', background: ST[r.status][0], color: ST[r.status][1] }}>{r.status}</span>
              <select value={plan[r.id]} onChange={(e) => setPlan((p) => ({ ...p, [r.id]: e.target.value }))} style={{ ...sel, color: plan[r.id] === '__del__' ? OVER : 'inherit' }}>
                {others.map((o) => <option key={o} value={o}>改派給 {o}</option>)}
                <option value="">設為未指派</option>
                <option value="__del__">刪除此工作</option>
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px' }}>
          <button onClick={onCancel} style={lineBtn}>取消</button>
          <button onClick={() => onConfirm(plan)} style={darkBtn}>套用並移除成員</button>
        </div>
      </div>
    </div>
  );
}

function RowDelete({ onDelete, disabled }) {
  const [ask, setAsk] = useState(false);
  return (
    <div style={{ display: 'grid', placeItems: 'center' }} onMouseLeave={() => setAsk(false)}>
      {ask ? (
        <button onClick={() => { onDelete(); setAsk(false); }} title="再按一次確認刪除"
          style={{ height: 26, padding: '0 7px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>確認</button>
      ) : (
        <button className="del" disabled={disabled} onClick={() => setAsk(true)} title="刪除此列"
          style={{ width: 26, height: 26, border: 'none', background: 'transparent', borderRadius: 5, cursor: disabled ? 'default' : 'pointer', color: V.faint, fontSize: 15 }}>×</button>
      )}
    </div>
  );
}

const SORTS = [
  ['order', '自訂順序（可拖曳）'], ['due', '截止日'], ['priority', '優先度'], ['status', '狀態'],
  ['owner', '負責人'], ['days', '預計天數'], ['updated', '更新時間'],
];

// 欄位：順序, Item, Owner, Customer, Machine, Status, Due, 時間軸, Priority, Remark, Log, File, Update, 刪除
const COLW0 = [128, 320, 110, 140, 112, 104, 126, 112, 92, 240, 240, 160, 126, 36];
const COLMIN = [128, 100, 70, 80, 70, 80, 110, 90, 80, 100, 140, 100, 100, 36];
const gridOf = (w) => w.map((x) => x + 'px').join(' ');
const COLS_KEY = 'worklist.cols.v3';
// 欄寬可拖曳調整（記在各人瀏覽器）；fixed = 不可調的欄位索引
function useCols(key, W0, MIN, fixed = []) {
  const [cols, setCols] = useState(() => { try { const a = JSON.parse(localStorage.getItem(key)); if (Array.isArray(a) && a.length === W0.length) return a.map((x, i) => fixed.includes(i) ? W0[i] : Math.max(MIN[i], Number(x) || W0[i])); } catch (e) {} return W0; });
  const save = (w) => { try { localStorage.setItem(key, JSON.stringify(w)); } catch (e) {} };
  const start = (i, e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = cols[i]; let cur = cols;
    const mv = (ev) => { cur = cols.map((w, j) => j === i ? Math.max(MIN[i], w0 + ev.clientX - x0) : w); setCols(cur); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); document.body.style.userSelect = ''; save(cur); };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const reset = (i) => { const w = cols.map((x, j) => j === i ? W0[i] : x); setCols(w); save(w); };
  return [cols, start, reset];
}
const cin = (extra) => ({ height: 30, width: '100%', minWidth: 0, border: '1px solid transparent', borderRadius: 6, background: 'transparent', padding: '0 8px', fontSize: 13, ...extra });
const mvBtn = { border: 'none', background: 'transparent', color: V.faint, fontSize: 15, lineHeight: 1, width: 20, height: 30, borderRadius: 6, padding: 0, cursor: 'pointer' };
const HEADS = [['順序', ''], ['Item', '工作項目'], ['Owner', '負責人'], ['Customer', '客戶 Owner'], ['Machine', '機台'], ['Status', '狀態'], ['Due date', '截止日'], ['時間軸', '預計天數'], ['Priority', '優先度'], ['Remark', '備註'], ['Log', '進度紀錄'], ['File', '附件'], ['Update', '更新時間'], ['', '']];

const FILE_OK = 'PDF、圖片（png/jpg/gif/webp/svg）、影片（mp4/webm）、字型，以及 csv / md / json / txt / log';
function uploadMsg(name, err) {
  const c = err && err.code, n = `「${name}」`;
  if (c === 'unsupported_type') return `${n}無法上傳：不支援這種檔案格式。目前只支援 ${FILE_OK}。Excel、Word、壓縮檔請先轉成 csv 或 PDF。`;
  if (c === 'too_large') return `${n}無法上傳：檔案太大（一般檔案上限 20 MB，svg 2 MB）。`;
  if (c === 'quota_or_state') return `${n}無法上傳：這份頁面的附件儲存空間已滿。`;
  if (c === 'not_granted' || c === 'capability_disabled' || c === 'capability_removed') return `${n}無法上傳：目前這個檢視沒有上傳權限（僅有編輯權限的人可以上傳附件）。`;
  if (c === 'rate_limited') return `${n}上傳太頻繁，請稍後再試。`;
  if (c === 'store_unavailable' || c === 'upstream_error') return `${n}上傳失敗：平台暫時異常，請稍後再試。`;
  if (c === 'invalid_request') return `${n}無法上傳：檔案是空的，或文字檔不是 UTF-8 編碼。`;
  if (err && err.message === 'too big') return `${n}無法上傳：本機模式附件上限約 1.5 MB。`;
  return `${n}上傳失敗${c ? '（' + c + '）' : ''}。`;
}

const CLASH = 'oklch(0.55 0.15 300)';
const FSEL = { height: 30, padding: '0 8px', border: `1px solid ${V.line2}`, background: V.surface, borderRadius: 7, cursor: 'pointer', fontSize: 12 };
const FON = { borderColor: V.btnBg, background: V.btnBg, color: V.btnFg };
const dstr = (d) => stamp(d).slice(0, 10);
// B8：工程項目（機台＋開始～截止）與生產排程同機台、日期重疊
function engPlanClash(drows, plans) {
  const m = new Map(), vp = plans.filter(validPlan);
  drows.forEach((r) => {
    if (!r.machine || !r.dueD || QUIET.includes(r.status)) return;
    const a = dstr(r.startD), b = r.due;
    const hit = vp.filter((p) => p.machine === r.machine && p.start <= b && a <= p.end);
    if (hit.length) m.set(r.id, hit);
  });
  return m;
}
// A4：從機台清單移除，仍有資料使用時先確認
function MachineDel({ engN, planN, onDel, disabled }) {
  const [ask, setAsk] = useState(false);
  const used = engN + planN > 0;
  if (ask) return (
    <span onMouseLeave={() => setAsk(false)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10.5, color: OVER, whiteSpace: 'nowrap' }}>{engN ? `${engN} 工程` : ''}{engN && planN ? '・' : ''}{planN ? `${planN} 排程` : ''}使用中</span>
      <button onClick={() => { setAsk(false); onDel(); }} style={{ height: 22, padding: '0 6px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>確認移除</button>
    </span>
  );
  return <button disabled={disabled} onClick={() => (used ? setAsk(true) : onDel())} title={used ? '從清單移除（已填的工作與排程仍保留此機台名稱）' : '移除'} style={{ border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', color: V.faint, fontSize: 14 }}>×</button>;
}
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } };
const addChip = { display: 'flex', alignItems: 'center', height: 22, padding: '0 7px', border: `1px dashed ${V.line3}`, borderRadius: 4, fontSize: 11, color: V.muted2, cursor: 'pointer', background: 'transparent' };
// C5：貼連結（docx / xlsx / 網路磁碟等不能上傳的檔案）
function LinkAdd({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const ok = /^https?:\/\/\S+$/i.test(url.trim()) || /^\\\\\S+/.test(url.trim());
  const add = () => {
    if (!ok) return;
    const u = url.trim();
    let n = name.trim();
    if (!n) { try { const x = new URL(u); n = decodeURIComponent(x.pathname.split('/').filter(Boolean).pop() || x.hostname); } catch (e) { n = u.split(/[\\/]/).filter(Boolean).pop() || u; } }
    onAdd({ kind: 'link', name: n.slice(0, 120), url: u }); setUrl(''); setName(''); setOpen(false);
  };
  return (
    <div style={{ position: 'relative' }}>
      <button className="file-add" onClick={() => setOpen((o) => !o)} title="貼上檔案連結" style={addChip}>＋ 連結</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
          <div style={{ position: 'absolute', top: 26, right: 0, width: 300, zIndex: 20, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>貼上檔案連結</div>
            <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setOpen(false); }} placeholder="https://… 或 \\server\share\…" style={{ ...fld, fontSize: 12 }} />
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="顯示名稱（可留空）" style={{ ...fld, fontSize: 12 }} />
            {url.trim() && !ok && <span style={{ fontSize: 11, color: OVER }}>請貼完整網址（http:// 或 https:// 開頭），或網路磁碟路徑（\\ 開頭）</span>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button onClick={() => setOpen(false)} style={{ ...lineBtn, height: 28, fontSize: 12 }}>取消</button>
              <button onClick={add} disabled={!ok} style={{ ...darkBtn, height: 28, fontSize: 12, opacity: ok ? 1 : 0.5 }}>加入</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WorkCard({ r, rank, S, ro, dnd, canDrag, first, last, dragging, over, cols, logs, onLogs, clash }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const set = (k) => (v) => S.patch(r.id, { [k]: v });
  const [stBg, stFg] = ST[r.status] || ST['未開始'];
  const [prBg, prFg, prBd] = PR[r.priority] || PR['普通'];
  let startLabel = '', dueFg = 'inherit';
  if (r.due) {
    const due = s2d(r.due);
    if (r.days) { const st = backDays(due, Math.max(1, Math.ceil(Number(r.days))), !!S.settings.workdays); startLabel = `${st.getMonth() + 1}/${st.getDate()} 起`; }
  }
  const dinfo = dueInfo(r, today);
  if (dinfo) dueFg = dinfo.fg;
  const lastLog = logs && logs[0];
  const ownerGone = !!r.owner && !S.owners.includes(r.owner) && r.status !== '已完成';
  const ownerOpts = r.owner && !S.owners.includes(r.owner) ? [...S.owners, r.owner] : S.owners;
  const files = S.filesByRow.get(r.id) || [];
  const machineOpts = [...new Set([...(S.machines || []), ...(r.machine ? [r.machine] : [])])].sort(byName);
  const why = ro ? '唯讀狀態無法調整順序' : '請先把排序改成「自訂順序」並清除篩選／搜尋，才能調整順序';
  const line = { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, background: V.accent, zIndex: 5 };
  const cell = { padding: '4px 4px', minWidth: 0, display: 'flex', alignItems: 'center' };

  return (
    <div data-card="1" onDragOver={(e) => dnd.over(e, r)} onDrop={(e) => dnd.drop(e, r)} style={{ position: 'relative', opacity: dragging ? 0.4 : 1 }}>
      {over === 'before' && <div style={{ ...line, top: -5 }} />}
      <div className="wcard" style={{ display: 'grid', gridTemplateColumns: gridOf(cols), alignItems: 'stretch', background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, minHeight: 46 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 2px 0 0', background: V.tint, borderRight: `1px solid ${V.line}`, borderRadius: '8px 0 0 8px' }}>
          <div className={canDrag ? 'grip' : ''} draggable={canDrag} title={canDrag ? '按住拖曳，調整順序' : why}
            onDragStart={(e) => dnd.start(e, r.id)} onDragEnd={dnd.end}
            style={{ cursor: canDrag ? 'grab' : 'not-allowed', padding: '8px 0 8px 4px', marginRight: 10, fontSize: 24, letterSpacing: -5, lineHeight: 1, userSelect: 'none', color: canDrag ? V.muted : V.faint }}>⋮⋮</div>
          <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 500, minWidth: 28, marginRight: 0 }}><span style={{ fontSize: 10, color: V.faint }}>#</span>{rank}</span>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
            <button className="mv" disabled={!canDrag || first} onClick={() => dnd.step(r.id, -1)} title="上移一格" style={mvBtn}>▲</button>
            <button className="mv" disabled={!canDrag || last} onClick={() => dnd.step(r.id, 1)} title="下移一格" style={mvBtn}>▼</button>
          </div>
        </div>
        <div style={cell}>
          <CellText multiline grow enterBlur className="cin" value={r.item} onCommit={set('item')} disabled={ro} placeholder="工作項目" style={cin({ fontWeight: 600, height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' })} />
        </div>
        <div style={cell}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
            <select className="cin" value={r.owner || ''} disabled={ro} onChange={(e) => set('owner')(e.target.value)} style={cin({ cursor: ro ? 'default' : 'pointer', ...(ownerGone ? { color: OVER } : null) })}>
              <option value="">—</option>
              {ownerOpts.map((o) => <option key={o} value={o}>{o}{o === r.owner && ownerGone ? '（已不在成員清單）' : ''}</option>)}
            </select>
            {ownerGone && <span title="這位負責人已不在工程師成員清單（帳號已停用或刪除，或已被移除），請改派給其他人" style={{ fontSize: 10.5, color: OVER, padding: '0 6px', lineHeight: 1.2, fontWeight: 500, cursor: 'help', whiteSpace: 'nowrap' }}>⚠ 已不在清單</span>}
          </div>
        </div>
        <div style={cell}>
          <CellText multiline grow enterBlur className="cin" value={r.custOwner} onCommit={set('custOwner')} disabled={ro} placeholder="客戶窗口" style={cin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', wordBreak: 'break-word' })} />
        </div>
        <div style={cell}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
            <select className="cin" value={r.machine || ''} disabled={ro} onChange={(e) => set('machine')(e.target.value)} style={cin({ cursor: ro ? 'default' : 'pointer', fontFamily: MONO, fontSize: 12 })}>
              <option value="">—</option>
              {machineOpts.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {clash && clash.length > 0 && <span title={'與生產排程時間重疊：\n' + clash.map((p) => `${p.start} → ${p.end}  ${[p.group, p.product].filter(Boolean).join(' · ').replace(/\n/g, ' ')}`).join('\n')} style={{ fontSize: 10.5, color: CLASH, padding: '0 6px', lineHeight: 1.2, fontWeight: 500, cursor: 'help' }}>⚠ 生產重疊 {clash.length}</span>}
          </div>
        </div>
        <div style={{ ...cell, padding: '4px 6px' }}>
          <select value={r.status} disabled={ro} onChange={(e) => set('status')(e.target.value)}
            style={{ width: '100%', height: 26, border: 'none', borderRadius: 13, padding: '0 8px', fontSize: 12, fontWeight: 500, cursor: ro ? 'default' : 'pointer', background: stBg, color: stFg }}>
            {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={cell}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
            <input className="cin" type="date" value={r.due || ''} disabled={ro} onChange={(e) => set('due')(e.target.value)} style={cin({ fontFamily: MONO, fontSize: 12, color: dueFg, padding: '0 4px', fontWeight: dinfo ? 600 : 400 })} />
            {dinfo && <span style={{ fontSize: 10.5, color: dinfo.fg, padding: '0 5px', lineHeight: 1.2, fontWeight: 500 }}>{dinfo.kind === 'soon' ? '⏰ ' : ''}{dinfo.text}</span>}
          </div>
        </div>
        <div style={{ ...cell, gap: 6 }}>
          <CellText className="cin" value={String(r.days ?? '')} disabled={ro} onCommit={(v) => set('days')(v === '' ? '' : Number(v))}
            style={cin({ width: 52, fontFamily: MONO, fontSize: 12, textAlign: 'right', padding: '0 6px' })} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span style={{ fontSize: 11, color: V.muted }}>{S.settings.workdays ? '工作天' : '天'}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: V.faint, whiteSpace: 'nowrap' }}>{startLabel}</span>
          </div>
        </div>
        <div style={{ ...cell, padding: '4px 6px' }}>
          <select value={r.priority} disabled={ro} onChange={(e) => set('priority')(e.target.value)}
            style={{ width: '100%', height: 26, border: `1px solid ${prBd}`, borderRadius: 5, padding: '0 6px', fontSize: 12, cursor: ro ? 'default' : 'pointer', background: prBg, color: prFg }}>
            {PRIO.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={cell}>
          <CellText multiline grow className="cin" value={r.remark} onCommit={set('remark')} disabled={ro} placeholder="備註"
            style={cin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', color: V.ink2 })} />
        </div>
        <div style={{ ...cell, padding: '4px 6px' }}>
          <button className="logcell" onClick={onLogs} title={logs.length ? '查看／新增進度紀錄' : '新增進度紀錄'}
            style={{ width: '100%', minHeight: 30, textAlign: 'left', border: `1px solid ${lastLog ? V.line : 'transparent'}`, background: lastLog ? V.tint : 'transparent', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, color: V.ink2 }}>
            {lastLog ? (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: V.muted2, width: '100%' }}>
                  <span style={{ fontFamily: MONO }}>{lastLog.date ? lastLog.date.slice(5).replace('-', '/') : ''}</span>
                  {lastLog.author && <span>{lastLog.author}</span>}
                  <span style={{ marginLeft: 'auto', fontFamily: MONO, color: V.faint }}>共 {logs.length} 則</span>
                </span>
                <span style={{ fontSize: 12, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{lastLog.text}</span>
              </>
            ) : <span style={{ fontSize: 12, color: V.faint }}>{ro ? '—' : '＋ 紀錄'}</span>}
          </button>
        </div>
        <div style={{ ...cell, flexWrap: 'wrap', gap: 4, alignContent: 'center' }}>
          {files.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%', background: V.tint, border: `1px solid ${V.line2}`, borderRadius: 4, padding: '2px 4px 2px 6px', fontSize: 11 }}>
              {f.kind === 'link' && /^\\\\/.test(f.url)
                ? <a href="#" onClick={(e) => { e.preventDefault(); copyText(f.url).then((ok) => S.say(ok ? '已複製網路磁碟路徑，請貼到檔案總管開啟。' : f.url)); }} title={f.url + '\n（點一下複製路徑）'} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>📁 {f.name}</a>
                : <a href={f.url || '/_blob/' + f.assetId} {...(f.kind === 'link' ? {} : { download: f.name })} target="_blank" rel="noreferrer" title={f.kind === 'link' ? f.url : f.name} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{f.kind === 'link' ? '🔗 ' : ''}{f.name}</a>}
              <button disabled={ro} onClick={() => S.delFile(r.id, f)} title="移除" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: V.faint, fontSize: 12, padding: '0 2px', lineHeight: 1 }}>×</button>
            </div>
          ))}
          {S.canUpload && !ro && (
            <label className="file-add" title="夾帶檔案" style={addChip}>
              ＋ 檔案
              <input type="file" multiple style={{ display: 'none' }} onChange={async (e) => {
                const picked = Array.from(e.target.files || []); e.target.value = '';
                for (const f of picked) { try { await S.addFile(r.id, await S.upload(f)); } catch (err) { S.say(uploadMsg(f.name, err)); } }
              }} />
            </label>
          )}
          {!ro && <LinkAdd onAdd={(f) => S.addFile(r.id, f)} />}
          {files.length === 0 && ro && <span style={{ fontSize: 12, color: V.faint }}>—</span>}
        </div>
        <div style={{ ...cell, fontFamily: MONO, fontSize: 11, color: V.muted2, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}>
          <span>{r.updated || '—'}</span>
          {r.updatedBy && <span style={{ fontFamily: 'inherit', fontSize: 10.5, color: V.faint, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.updatedBy}</span>}
        </div>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <RowDelete disabled={ro} onDelete={() => S.del(r.id)} />
        </div>
      </div>
      {over === 'after' && <div style={{ ...line, bottom: -5 }} />}
    </div>
  );
}

/* ============================================================
   C2：進度紀錄（右側抽屜）—— 資料在 logs 資源，rowId 指向工程項目
   ============================================================ */
const todayStr = () => stamp().slice(0, 10);
const sortLogs = (l) => [...l].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || '').localeCompare(a.created || ''));

function LogEntry({ l, S, ro, authors }) {
  const [edit, setEdit] = useState(false);
  const [ask, setAsk] = useState(false);
  const [d, setD] = useState(l.date || '');
  const [a, setA] = useState(l.author || '');
  const [t, setT] = useState(l.text || '');
  const open = () => { setD(l.date || ''); setA(l.author || ''); setT(l.text || ''); setEdit(true); };
  const save = () => { const x = t.trim(); if (!x) return; S.patchLog(l.id, { date: d || todayStr(), author: a, text: x }); setEdit(false); };
  const small = { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: V.muted2, padding: '2px 6px', borderRadius: 4 };
  const opts = a && !authors.includes(a) ? [...authors, a] : authors;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: V.accent, marginTop: 5, flex: 'none' }} />
        <span style={{ flex: 1, width: 1, background: V.line2, marginTop: 4 }} />
      </div>
      <div style={{ paddingBottom: 16, minWidth: 0 }}>
        {edit ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="date" value={d} onChange={(e) => setD(e.target.value)} style={{ ...fld, fontFamily: MONO, fontSize: 12, width: 140 }} />
              <select value={a} onChange={(e) => setA(e.target.value)} style={{ ...fld, flex: 1 }}>
                <option value="">（未填紀錄人）</option>
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <textarea value={t} onChange={(e) => setT(e.target.value)} rows={4} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); if (e.key === 'Escape') { e.stopPropagation(); setEdit(false); } }}
              style={{ ...fld, height: 'auto', padding: '6px 8px', lineHeight: 1.5, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => setEdit(false)} style={{ ...lineBtn, height: 28, fontSize: 12 }}>取消</button>
              <button onClick={save} disabled={!t.trim()} style={{ ...darkBtn, height: 28, fontSize: 12, opacity: t.trim() ? 1 : 0.5 }}>儲存</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{l.date || '—'}</span>
              {l.author && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: V.muted }}><Avatar name={l.author} size={18} />{l.author}</span>}
              {!ro && (
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }} onMouseLeave={() => setAsk(false)}>
                  <button className="mv" onClick={open} style={small}>編輯</button>
                  {ask
                    ? <button onClick={() => S.delLog(l.id)} style={{ ...small, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>確認刪除</button>
                    : <button className="del" onClick={() => setAsk(true)} style={small}>刪除</button>}
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: V.ink }}>{l.text}</div>
            {l.updated && l.updated !== l.created && <div style={{ marginTop: 2, fontFamily: MONO, fontSize: 10, color: V.faint }}>已編輯 {l.updated}</div>}
          </>
        )}
      </div>
    </div>
  );
}
const fld = { height: 32, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 8px', fontSize: 13, background: V.surface, minWidth: 0 };

function LogDrawer({ row, S, ro, onClose }) {
  const logs = sortLogs(S.logs.filter((l) => l.rowId === row.id));
  const [date, setDate] = useState(todayStr);
  const [author, setAuthor] = useState(() => lsGet('log.author') || row.owner || '');
  const [text, setText] = useState('');
  const ta = useRef(null);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { if (!ro && ta.current) ta.current.focus(); }, [row.id]);
  const authors = author && !S.owners.includes(author) ? [...S.owners, author] : S.owners;
  const submit = () => {
    const t = text.trim(); if (!t) return;
    S.addLog({ rowId: row.id, date: date || todayStr(), author, text: t });
    lsSet('log.author', author);
    setText('');
  };
  const [stBg, stFg] = ST[row.status] || ST['未開始'];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,19,17,0.25)', zIndex: 40 }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '96vw', background: V.surface, borderLeft: `1px solid ${V.line2}`, boxShadow: '-16px 0 40px rgba(0,0,0,0.18)', zIndex: 41, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${V.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: V.muted2 }}>進度紀錄</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: V.faint }}>{logs.length} 則</span>
            <button onClick={onClose} title="關閉（Esc）" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: V.muted, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{row.item || '（未命名）'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: V.muted }}>
            <span style={{ fontSize: 11, borderRadius: 10, padding: '2px 8px', background: stBg, color: stFg }}>{row.status}</span>
            {row.owner && <span>{row.owner}</span>}
            {row.machine && <span style={{ fontFamily: MONO }}>{row.machine}</span>}
            {row.custOwner && <span>客戶 {row.custOwner}</span>}
            <span style={{ fontFamily: MONO }}>{row.due ? '截止 ' + row.due : '未設截止日'}</span>
          </div>
        </div>
        {!ro && (
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${V.line}`, display: 'flex', flexDirection: 'column', gap: 8, background: V.surface2 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...fld, fontFamily: MONO, fontSize: 12, width: 140 }} />
              <select value={author} onChange={(e) => setAuthor(e.target.value)} title="紀錄人" style={{ ...fld, flex: 1 }}>
                <option value="">（未填紀錄人）</option>
                {authors.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <textarea ref={ta} value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="做了什麼、遇到什麼問題、下一步…（Ctrl+Enter 送出）"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
              style={{ ...fld, height: 'auto', padding: '6px 8px', lineHeight: 1.5, resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-dark" onClick={submit} disabled={!text.trim()} style={{ ...darkBtn, opacity: text.trim() ? 1 : 0.5 }}>新增紀錄</button>
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {logs.length === 0
            ? <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: V.muted2 }}>還沒有進度紀錄{ro ? '' : '，在上方輸入第一則。'}</div>
            : logs.map((l) => <LogEntry key={l.id} l={l} S={S} ro={ro} authors={S.owners} />)}
        </div>
      </aside>
    </>
  );
}

/* ============================================================
   C3：匯出 CSV（Excel 可直接開，含 BOM）
   ============================================================ */
const csvCell = (v) => { const x = v == null ? '' : String(v); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
const ENG_HEAD = ['順序', '工作項目', '負責人', '客戶 Owner', '機台', '狀態', '截止日', '預計天數', '優先度', '備註', '最新進度', '進度紀錄數', '附件', '更新時間', '更新者'];
const PLAN_HEAD = ['機台名稱', '測試產品 Group', '測試產品名稱', 'HW', '開始日', '結束日', '天數', '備註', '更新時間', '更新者'];
function exportCSV(S, kind, shown) {
  const day = todayStr().replace(/-/g, '');
  const rank = new Map(S.rows.map((r, i) => [r.id, i + 1]));
  const logsOf = (id) => sortLogs(S.logs.filter((l) => l.rowId === id));
  if (kind === 'eng' || kind === 'engAll') {
    const src = kind === 'eng' ? shown : S.rows;
    const body = src.map((r) => { const ls = logsOf(r.id), f = S.filesByRow.get(r.id) || []; return [rank.get(r.id), r.item, r.owner, r.custOwner, r.machine, r.status, r.due, r.days, r.priority, r.remark, ls[0] ? `${ls[0].date} ${ls[0].author ? ls[0].author + '：' : ''}${ls[0].text}` : '', ls.length, f.map((x) => x.name + (x.kind === 'link' ? ` <${x.url}>` : '')).join('；'), r.updated, r.updatedBy]; });
    return S.saveFile(`工程清單_${day}.csv`, toCSV([ENG_HEAD, ...body]));
  }
  if (kind === 'plan') {
    const body = [...S.plans].sort((a, b) => byName(a.machine || '', b.machine || '') || (a.start || '').localeCompare(b.start || '')).map((p) => [p.machine, p.group, p.product, p.hw ? 'Y' : '', p.start, p.end, p.start && p.end ? diff(s2d(p.end), s2d(p.start)) + 1 : '', p.remark, p.updated, p.updatedBy]);
    return S.saveFile(`生產排程_${day}.csv`, toCSV([PLAN_HEAD, ...body]));
  }
  const item = new Map(S.rows.map((r) => [r.id, r]));
  const body = sortLogs(S.logs).map((l) => { const r = item.get(l.rowId) || {}; return [r.item || '（已刪除）', r.machine || '', r.owner || '', l.date, l.author, l.text, l.created]; });
  return S.saveFile(`進度紀錄_${day}.csv`, toCSV([['工作項目', '機台', '負責人', '日期', '紀錄人', '內容', '建立時間'], ...body]));
}

/* ============================================================
   C4：從 Excel 貼上匯入
   ============================================================ */
// 解析 Excel 複製出來的 TSV（含引號包住、內含換行的儲存格）
function parseTSV(text) {
  const out = []; let row = [], cell = '', q = false;
  const t = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim() !== ''));
}
// 2026-10-21 / 2026/10/21 / 10/21（今年）/ Excel 日期序號 → YYYY-MM-DD
function parseDay(v) {
  const x = String(v || '').trim(); if (!x) return '';
  let m = x.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = x.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${new Date().getFullYear()}-${pad(m[1])}-${pad(m[2])}`;
  if (/^\d{5}(\.\d+)?$/.test(x)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(x)) * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  return null; // 看不懂
}
const IMPORT = {
  eng: {
    label: '工程清單',
    fields: [
      ['item', '工作項目', ['item', '工作項目', '項目']], ['owner', '負責人', ['owner', '負責人']], ['custOwner', '客戶 Owner', ['customer', '客戶owner', '客戶窗口', '客戶']],
      ['machine', '機台', ['machine', '機台', '機台名稱']], ['status', '狀態', ['status', '狀態']], ['due', '截止日', ['due', 'duedate', '截止日', '截止']],
      ['days', '預計天數', ['days', '預計天數', '天數', '時間軸']], ['priority', '優先度', ['priority', '優先度', '優先']], ['remark', '備註', ['remark', '備註']],
    ],
    order: ['item', 'owner', 'custOwner', 'machine', 'status', 'due', 'days', 'priority', 'remark'],
  },
  plan: {
    label: '生產排程',
    fields: [
      ['machine', '機台名稱', ['machine', '機台', '機台名稱']], ['group', 'Group', ['group', '測試產品group', '產品group']], ['product', '產品名稱', ['product', '測試產品名稱', '產品名稱', '產品']],
      ['hw', 'HW', ['hw', 'hwteam', 'hw開關']], ['start', '開始日', ['start', '開始日', '開始']], ['end', '結束日', ['end', '結束日', '結束']], ['remark', '備註', ['remark', '備註']],
    ],
    order: ['machine', 'group', 'product', 'hw', 'start', 'end', 'remark'],
  },
};
const normH = (x) => String(x || '').toLowerCase().replace(/[\s_（）()]/g, '');
function mapImport(kind, grid) {
  const cfg = IMPORT[kind];
  if (!grid.length) return { cols: [], items: [], header: false };
  const first = grid[0].map(normH);
  const cols = first.map((h) => { const f = cfg.fields.find(([, , syn]) => syn.some((s) => normH(s) === h)); return f ? f[0] : null; });
  const header = cols.filter(Boolean).length >= 2;
  const use = header ? cols : grid[0].map((_, i) => cfg.order[i] || null);
  const items = (header ? grid.slice(1) : grid).map((cells) => {
    const o = {}, warn = [];
    use.forEach((k, i) => { if (k) o[k] = (cells[i] || '').trim(); });
    if (kind === 'eng') {
      const SYN = { '等客戶': '等客戶回覆', '等待客戶': '等客戶回覆', 'pending customer': '等客戶回覆', 'hold': '暫停', 'on hold': '暫停', '擱置': '暫停', 'wip': '進行中', 'done': '已完成', 'open': '未開始' };
      if (o.status && SYN[o.status.toLowerCase()]) o.status = SYN[o.status.toLowerCase()];
      if (o.status && !STATUS.includes(o.status)) { warn.push(`狀態「${o.status}」改為未開始`); o.status = '未開始'; }
      if (o.priority && !PRIO.includes(o.priority)) { warn.push(`優先度「${o.priority}」改為普通`); o.priority = '普通'; }
      const dd = parseDay(o.due); if (dd === null) { warn.push(`截止日「${o.due}」看不懂，留空`); o.due = ''; } else o.due = dd;
      if (o.days !== undefined) { const n = Number(o.days); o.days = o.days === '' ? 1 : Number.isFinite(n) ? n : 1; }
      if (!o.item) warn.push('沒有工作項目');
    } else {
      o.hw = /^(y|yes|v|✓|✔|true|1|是|需要|on|o)$/i.test(o.hw || '');
      for (const k of ['start', 'end']) { const dd = parseDay(o[k]); if (dd === null) { warn.push(`${k === 'start' ? '開始日' : '結束日'}「${o[k]}」看不懂，留空`); o[k] = ''; } else o[k] = dd; }
      if (o.start && o.end && o.end < o.start) warn.push('結束日早於開始日');
    }
    return { o, warn };
  });
  return { cols: use, items, header };
}

function ImportModal({ S, onClose }) {
  const kinds = Object.keys(IMPORT).filter((k) => (k === 'eng' ? S.canEdit : S.canPlan));
  const [kind, setKind] = useState(kinds[0] || 'eng');
  const [text, setText] = useState('');
  const [addNew, setAddNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const cfg = IMPORT[kind];
  const res = useMemo(() => mapImport(kind, parseTSV(text)), [kind, text]);
  const newOwners = kind === 'eng' ? [...new Set(res.items.map((x) => x.o.owner).filter((n) => n && !S.owners.includes(n)))] : [];
  const newMachines = [...new Set(res.items.map((x) => x.o.machine).filter((n) => n && !S.machines.includes(n)))];
  const go = async () => {
    setBusy(true);
    if (addNew && S.canAdmin) { for (const n of newOwners) await S.addOwner(n); for (const n of newMachines) await S.addMachine(n); }
    let ord = Math.max(0, ...S.rows.map((r) => Number(r.order) || 0));
    for (const { o } of res.items) {
      if (kind === 'eng') { ord += 1024; await S.add({ ...o, order: ord }); }
      else await S.addPlan('', { machine: '', group: '', product: '', hw: false, start: '', end: '', remark: '', ...o });
    }
    S.say(`已匯入 ${res.items.length} 筆${cfg.label}`);
    setBusy(false); onClose();
  };
  const shownCols = cfg.fields.filter(([k]) => res.cols.includes(k));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,19,17,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 920, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>從 Excel 貼上匯入</span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
              {Object.entries(IMPORT).filter(([k]) => kinds.includes(k)).map(([k, c]) => <button key={k} onClick={() => setKind(k)} style={{ ...FSEL, ...(kind === k ? FON : null) }}>匯入到{c.label}</button>)}
            </div>
            <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: V.muted }}>×</button>
          </div>
          <div style={{ fontSize: 12, color: V.muted, lineHeight: 1.6 }}>
            在 Excel 選取多列（建議連標題列一起）複製後貼到下面。有標題列會依欄名對應（{cfg.fields.map((f) => f[1]).join('、')}，中英文欄名都可）；
            沒有標題列則依這個順序對應。日期可用 2026/10/21、2026-10-21 或 10/21。
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus rows={5} placeholder="在這裡貼上（Ctrl+V）" style={{ ...fld, height: 'auto', padding: '8px 10px', fontFamily: MONO, fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', borderTop: `1px solid ${V.line}`, borderBottom: `1px solid ${V.line}`, minHeight: 80 }}>
          {res.items.length === 0 ? <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: V.muted2 }}>貼上後會在這裡預覽</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['#', ...shownCols.map((f) => f[1]), '提醒'].map((h) => <th key={h} style={{ position: 'sticky', top: 0, background: V.head, textAlign: 'left', padding: '6px 8px', fontWeight: 500, color: V.ink2, borderBottom: `1px solid ${V.line2}`, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {res.items.slice(0, 200).map(({ o, warn }, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${V.line}` }}>
                    <td style={{ padding: '5px 8px', fontFamily: MONO, color: V.faint }}>{i + 1}</td>
                    {shownCols.map(([k]) => <td key={k} style={{ padding: '5px 8px', whiteSpace: 'pre-wrap', maxWidth: 260, verticalAlign: 'top' }}>{k === 'hw' ? (o.hw ? 'Y' : '') : String(o[k] ?? '')}</td>)}
                    <td style={{ padding: '5px 8px', color: 'oklch(0.55 0.13 50)', fontSize: 11 }}>{warn.join('；')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: V.muted }}>{res.items.length ? `${res.header ? '已辨識標題列，' : '沒有標題列，依欄位順序對應，'}共 ${res.items.length} 筆` : ''}</span>
          {(newOwners.length > 0 || newMachines.length > 0) && !S.canAdmin && (
            <span style={{ fontSize: 12, color: SOON.fg }}>清單裡沒有的{newOwners.length ? '成員' : ''}{newOwners.length && newMachines.length ? '、' : ''}{newMachines.length ? '機台' : ''}會照樣匯入文字，但要請管理員加入清單才會出現在下拉選單。</span>
          )}
          {(newOwners.length > 0 || newMachines.length > 0) && S.canAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.ink2 }}>
              <input type="checkbox" checked={addNew} onChange={(e) => setAddNew(e.target.checked)} />
              一併加入清單：{[...newOwners.map((n) => '成員 ' + n), ...newMachines.map((n) => '機台 ' + n)].join('、')}
            </label>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={lineBtn}>取消</button>
            <button onClick={go} disabled={!res.items.length || busy} style={{ ...darkBtn, opacity: res.items.length && !busy ? 1 : 0.5 }}>{busy ? '匯入中…' : `匯入 ${res.items.length} 筆`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 團隊成員面板：分「工程師」「Planner」兩組；管理員可改名、換組、移除 ---------- */
const TEAM_LABEL = { engineer: '工程師', planner: 'Planner' };
function MemberRow({ m, S, roA, onRemove, other }) {
  const [edit, setEdit] = useState(false), [v, setV] = useState(m.name);
  const cnt = S.rows.filter((r) => r.owner === m.name).length;
  const save = async () => { if (await S.renameMember(m.id, v)) setEdit(false); };
  return (
    <div className="member-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, fontSize: 13 }}>
      <Avatar name={m.name} size={20} />
      {edit ? (
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEdit(false); setV(m.name); } }}
          style={{ ...fld, height: 26, flex: 1, fontSize: 12.5 }} />
      ) : (
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}{m.profileId && <span title="已連結登入帳號：名稱和組別跟著帳號" style={{ marginLeft: 5, fontSize: 10.5, color: 'oklch(0.5 0.1 155)' }}>● 帳號</span>}</span>
      )}
      {edit ? (
        <>
          <button onClick={save} style={{ ...darkBtn, height: 26, padding: '0 8px', fontSize: 12 }}>儲存</button>
          <button onClick={() => { setEdit(false); setV(m.name); }} style={{ ...lineBtn, height: 26, padding: '0 8px', fontSize: 12 }}>取消</button>
        </>
      ) : (
        <>
          {m.team !== 'planner' && <span style={{ fontFamily: MONO, fontSize: 11, color: V.faint }}>{cnt} 件</span>}
          {!roA && <button className="mv" onClick={() => { setV(m.name); setEdit(true); }} title="改名（Owner、紀錄人、更新者會一起改）" style={{ ...mvBtn, width: 22, fontSize: 12 }}>✎</button>}
          {!roA && !m.profileId && <button className="mv" onClick={() => S.setMemberTeam(m.id, other)} title={other === 'planner' ? '移到 Planner 成員（生產排程頁）' : '移到工程師成員（工程清單頁）'} style={{ ...mvBtn, width: 22, fontSize: 12 }}>⇅</button>}
          {!roA && <button disabled={!!m.profileId} onClick={() => onRemove(m.name)} title={m.profileId ? '已連結帳號的成員，請到「帳號管理」停用' : '移除'} style={{ border: 'none', background: 'transparent', cursor: m.profileId ? 'not-allowed' : 'pointer', color: V.faint, fontSize: 14, opacity: m.profileId ? 0.35 : 1 }}>×</button>}
        </>
      )}
    </div>
  );
}
// team：這個頁面只管哪一組（工程清單頁 → engineer，生產排程頁 → planner）
function MemberPanel({ S, roA, onRemove, onClose, team }) {
  const [name, setName] = useState('');
  const other = team === 'planner' ? 'engineer' : 'planner';
  const add = () => { const n = name.trim(); if (!n) return; const dup = S.members.find((m) => m.name.toLowerCase() === n.toLowerCase()); if (dup) { S.say(`「${n}」已經在${TEAM_LABEL[dup.team]}組裡`); return; } S.addOwner(n, team); setName(''); };
  const list = S.members.filter((m) => (m.team || 'engineer') === team);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
      <div style={{ position: 'absolute', top: 38, right: 0, width: 360, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{team === 'planner' ? 'Planner 成員' : '工程師成員'}</div>
        <div style={{ fontSize: 11.5, color: V.muted2, lineHeight: 1.6 }}>
          {team === 'planner'
            ? '帳號在「帳號管理」核准為 Planner 後會自動加入這裡（標示 ● 帳號）。'
            : '帳號在「帳號管理」核准為工程師或管理員後會自動加入這裡（標示 ● 帳號），工程清單的 Owner 就是這份名單。'}
          {roA && <><br />只有管理員可以新增、改名或移除成員。</>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflow: 'auto' }}>
          {list.length === 0 && <div style={{ fontSize: 12, color: V.faint, padding: '4px 8px' }}>（還沒有成員）</div>}
          {list.map((m) => <MemberRow key={m.id} m={m} S={S} roA={roA} onRemove={onRemove} other={other} />)}
        </div>
        {!roA && (
          <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${V.line}`, paddingTop: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="手動新增（沒有帳號的人）"
              style={{ ...fld, flex: 1, fontSize: 12.5 }} />
            <button onClick={add} style={darkBtn}>新增</button>
          </div>
        )}
      </div>
    </>
  );
}

// 提示列：放在捲動區外面，不會被固定的表頭蓋住
function HintBar({ children }) {
  return <div style={{ flex: 'none', padding: '7px 24px', fontSize: 12, lineHeight: 1.5, color: V.muted, background: V.tint, borderBottom: `1px solid ${V.line}` }}>ⓘ {children}</div>;
}

function WorklistPage({ S, D, picked, setPicked, eview, setEview, openLogs }) {
  const [sortKey, setSortKey] = useState('order');
  const [sortDir, setSortDir] = useState(1);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(null);
  const [hideDone, setHideDoneState] = useState(() => lsGet('list.hideDone') !== '0');
  const setHideDone = (v) => { setHideDoneState(v); lsSet('list.hideDone', v ? '1' : '0'); };
  const [fOwner, setFOwner] = useState(''), [fMachine, setFMachine] = useState(''), [fPrio, setFPrio] = useState(''), [mine, setMine] = useState(false);
  const [showExport, setShowExport] = useState(false), [importing, setImporting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showMachines, setShowMachines] = useState(false);
  const [newMachine, setNewMachine] = useState('');
  const [cols, startResize, resetCol] = useCols(COLS_KEY, COLW0, COLMIN, [0, COLW0.length - 1]);
  const [newOwner, setNewOwner] = useState('');
  const [removing, setRemoving] = useState(null);
  const logsByRow = useMemo(() => { const m = new Map(); sortLogs(S.logs).forEach((l) => { if (!m.has(l.rowId)) m.set(l.rowId, []); m.get(l.rowId).push(l); }); return m; }, [S.logs]);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const scroller = useRef(null);
  const ro = !S.canEdit, roA = !S.canAdmin;

  const q = query.trim().toLowerCase();
  const extra = !!(fOwner || fMachine || fPrio || mine);
  let list = S.rows.filter((r) => (!filter || r.status === filter) && (!hideDone || filter === '已完成' || r.status !== '已完成')
    && (!fOwner || (fOwner === '__none__' ? !r.owner : fOwner === '__gone__' ? (!!r.owner && !S.owners.includes(r.owner)) : r.owner === fOwner)) && (!mine || (!!S.me && r.owner === S.me))
    && (!fMachine || (fMachine === '__none__' ? !r.machine : r.machine === fMachine)) && (!fPrio || r.priority === fPrio)
    && (!q || [r.item, r.owner, r.custOwner, r.machine, r.remark, ...(logsByRow.get(r.id) || []).map((l) => l.text)].join(' ').toLowerCase().includes(q)));
  if (sortKey !== 'order') {
    const k = sortKey;
    const val = (r) => {
      if (k === 'priority') return PRIO.indexOf(r.priority);
      if (k === 'status') return STATUS.indexOf(r.status);
      if (k === 'days') return Number(r.days) || 0;
      if (k === 'due') return r.due || '9999-99-99';
      if (k === 'owner') return r.owner || '\uffff';
      return r[k] || '';
    };
    list = [...list].sort((a, b) => { const x = val(a), y = val(b); return x < y ? -sortDir : x > y ? sortDir : 0; });
  }
  const rankOf = useMemo(() => new Map(S.rows.map((r, i) => [r.id, i + 1])), [S.rows]);
  const machines = [...new Set(S.rows.map((r) => (r.machine || '').trim()).filter(Boolean))].sort();
  const canDrag = !ro && sortKey === 'order' && !filter && !q && !extra;
  const doneN = S.rows.filter((r) => r.status === '已完成').length;
  const goneN = S.rows.filter((r) => r.owner && !S.owners.includes(r.owner) && r.status !== '已完成').length;
  const clashByRow = useMemo(() => engPlanClash(D.rows, S.plans), [D.rows, S.plans]);
  const clearExtra = () => { setFOwner(''); setFMachine(''); setFPrio(''); setMine(false); };

  const clearDrag = () => { setDragId(null); setOver(null); };
  const dnd = {
    start(e, id) {
      const card = e.currentTarget.closest('[data-card]');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      if (card && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(card, 28, 28);
      setTimeout(() => setDragId(id), 0);
    },
    end: clearDrag,
    over(e, r) {
      if (!dragId || !canDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setOver((o) => (o && o.id === r.id && o.pos === pos ? o : { id: r.id, pos }));
    },
    drop(e, r) {
      e.preventDefault();
      const id = dragId, o = over;
      clearDrag();
      if (!id || !o || !canDrag) return;
      const idx = list.findIndex((x) => x.id === r.id);
      const beforeId = o.pos === 'before' ? r.id : (list[idx + 1] ? list[idx + 1].id : null);
      if (beforeId === id) return;
      S.move(id, beforeId);
    },
    step(id, dir) {
      const i = list.findIndex((x) => x.id === id);
      if (dir < 0 && i > 0) S.move(id, list[i - 1].id);
      if (dir > 0 && i < list.length - 1) S.move(id, list[i + 2] ? list[i + 2].id : null);
    },
  };

  const addOwner = () => {
    const n = newOwner.trim();
    if (!n) return;
    S.addOwner(n);
    setNewOwner('');
  };
  const tryRemoveOwner = (n) => {
    const mine = S.rows.filter((r) => r.owner === n);
    if (mine.length === 0) S.delOwnerOnly(n);
    else setRemoving(n);
  };
  const addMachine = () => {
    const n = newMachine.trim();
    if (!n) return;
    S.addMachine(n);
    setNewMachine('');
  };
  const addRow = () => {
    setFilter(null); setQuery(''); setSortKey('order'); clearExtra();
    S.add();
    setTimeout(() => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, 200);
  };
  const lastItem = list[list.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 8, columnGap: 14, padding: '12px 24px', background: V.surface2, borderBottom: `1px solid ${V.line}` }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['list', '列表'], ['gantt', '工程排程']].map(([k, l]) => <button key={k} onClick={() => setEview(k)} style={{ ...lineBtn, background: eview === k ? V.btnBg : V.surface, color: eview === k ? V.btnFg : V.ink, borderColor: eview === k ? V.btnBg : V.line2 }}>{l}</button>)}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted2, display: eview === 'list' ? undefined : 'none' }}>{list.length} / {S.rows.length} 筆</span>
        <div style={{ display: eview === 'list' ? 'flex' : 'none', gap: 6 }}>
          {[null, ...STATUS].map((k) => {
            const on = filter === k;
            const c = k ? S.rows.filter((r) => r.status === k).length : S.rows.length;
            return (
              <button key={k || 'all'} onClick={() => setFilter(k)}
                style={{ height: 28, padding: '0 10px', borderRadius: 14, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${on ? V.btnBg : V.line2}`, background: on ? V.btnBg : V.surface, color: on ? V.btnFg : V.muted }}>
                {k || '全部'}<span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7 }}>{c}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: eview === 'list' ? 'flex' : 'none', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: V.muted2 }}>排序</span>
          <select value={sortKey} onChange={(e) => { setSortKey(e.target.value); setSortDir(1); }} style={{ ...lineBtn, padding: '0 8px', fontSize: 12 }}>
            {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {sortKey !== 'order' && (
            <button onClick={() => setSortDir((d) => -d)} title="切換正序／倒序" style={{ ...lineBtn, padding: '0 9px' }}>{sortDir > 0 ? '▲' : '▼'}</button>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <button className="member-btn" onClick={() => setShowMembers((s) => !s)} style={lineBtn}>工程師成員（{S.owners.length}）</button>
            {showMembers && <MemberPanel S={S} roA={roA} team="engineer" onRemove={tryRemoveOwner} onClose={() => setShowMembers(false)} />}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="member-btn" onClick={() => setShowMachines((s) => !s)} style={lineBtn}>機台清單（{S.machines.length}）</button>
            {showMachines && (
              <>
                <div onClick={() => setShowMachines(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <div style={{ position: 'absolute', top: 38, right: 0, width: 280, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>機台清單</div>
                  {S.machines.length === 0 && <div style={{ fontSize: 12, color: V.muted2 }}>尚未新增機台，新增後即可在 Machine 欄位下拉選擇。</div>}
                  {roA && <div style={{ fontSize: 11.5, color: V.muted2 }}>只有管理員可以新增或移除機台。</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflow: 'auto' }}>
                    {S.machines.map((n) => {
                      const cnt = S.rows.filter((r) => r.machine === n).length;
                      return (
                        <div key={n} className="member-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
                          <span style={{ flex: 1, fontFamily: MONO, fontSize: 12 }}>{n}</span>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: V.faint }}>{cnt} 件</span>
                          <MachineDel disabled={roA} engN={cnt} planN={S.plans.filter((p) => p.machine === n).length} onDel={() => S.delMachine(n)} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={newMachine} disabled={roA} onChange={(e) => setNewMachine(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMachine(); }} placeholder="輸入機台名稱"
                      style={{ flex: 1, minWidth: 0, height: 32, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 10px', fontSize: 13, background: V.surface }} />
                    <button disabled={roA} onClick={addMachine} style={darkBtn}>新增</button>
                  </div>
                </div>
              </>
            )}
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋 item / owner / 客戶 / 機台 / remark / 紀錄"
            style={{ height: 32, width: 220, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 10px', fontSize: 13, background: V.surface }} />
          <button className="btn-dark" disabled={ro} onClick={addRow} style={{ ...darkBtn, opacity: ro ? 0.5 : 1 }}>＋ 新增一筆</button>
        </div>
      </div>

      {eview === 'list' && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 24px', background: V.surface2, borderBottom: `1px solid ${V.line}` }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.ink2, cursor: 'pointer', marginRight: 6 }}>
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />隱藏已完成<span style={{ fontFamily: MONO, color: V.faint }}>{doneN}</span>
          </label>
          <span style={{ fontSize: 12, color: V.muted2 }}>篩選</span>
          <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} style={{ ...FSEL, ...(fOwner ? FON : null) }}>
            <option value="">全部負責人</option>
            {S.owners.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__none__">（未指派）</option>
            {goneN > 0 && <option value="__gone__">⚠ 負責人已不在清單（{goneN}）</option>}
          </select>
          <button onClick={() => setMine((v) => !v)} disabled={!S.me} title={S.me ? `只看 ${S.me} 負責的` : '請先在右上角選擇「我是」'} style={{ ...FSEL, ...(mine ? FON : null), opacity: S.me ? 1 : 0.5 }}>只看我的</button>
          <select value={fMachine} onChange={(e) => setFMachine(e.target.value)} style={{ ...FSEL, ...(fMachine ? FON : null) }}>
            <option value="">全部機台</option>
            {[...new Set([...S.machines, ...machines])].sort(byName).map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="__none__">（未指定機台）</option>
          </select>
          <select value={fPrio} onChange={(e) => setFPrio(e.target.value)} style={{ ...FSEL, ...(fPrio ? FON : null) }}>
            <option value="">全部優先度</option>
            {PRIO.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {extra && <button onClick={clearExtra} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: V.muted2 }}>清除篩選</button>}
          {goneN > 0 && (
            <button onClick={() => setFOwner(fOwner === '__gone__' ? '' : '__gone__')} title="這些工作的負責人帳號已停用或刪除（或已從成員清單移除），請改派" style={{ border: `1px solid oklch(0.85 0.06 25)`, background: fOwner === '__gone__' ? OVER : 'oklch(0.97 0.02 25)', color: fOwner === '__gone__' ? '#fff' : OVER, borderRadius: 7, height: 30, padding: '0 10px', fontSize: 12, cursor: 'pointer', marginLeft: 6 }}>
              ⚠ {goneN} 筆工作的負責人已不在清單{fOwner === '__gone__' ? '（顯示中，點一下取消）' : '，點一下只看這些'}
            </button>
          )}
          {clashByRow.size > 0 && <span style={{ fontSize: 12, color: CLASH, marginLeft: 6 }} title="工程項目的機台與日期，和機台生產排程重疊">⚠ {clashByRow.size} 筆工程項目與生產排程撞機台</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowExport((v) => !v)} style={FSEL}>匯出 CSV ▾</button>
              {showExport && (
                <>
                  <div onClick={() => setShowExport(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                  <div style={{ position: 'absolute', top: 34, right: 0, width: 230, zIndex: 10, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', padding: 6, display: 'flex', flexDirection: 'column' }}>
                    {[['eng', `工程清單（目前顯示的 ${list.length} 筆）`], ['engAll', `工程清單（全部 ${S.rows.length} 筆）`], ['plan', `生產排程（${S.plans.length} 筆）`], ['log', `進度紀錄（${S.logs.length} 則）`]].map(([k, l]) => (
                      <button key={k} className="member-item" onClick={() => { setShowExport(false); exportCSV(S, k, list); }} style={{ textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>{l}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button disabled={!S.canEdit && !S.canPlan} onClick={() => setImporting(true)} title="從 Excel 複製多列後貼上" style={{ ...FSEL, opacity: !S.canEdit && !S.canPlan ? 0.5 : 1 }}>從 Excel 貼上匯入</button>
          </div>
        </div>
      )}
      {eview === 'gantt' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {S.rows.length === 0 ? <div style={{ background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10, padding: 48, textAlign: 'center', fontSize: 14, color: V.muted2 }}>工程清單中還沒有資料。</div> : <Gantt D={D} picked={picked} setPicked={setPicked} />}
        </div>
      )}
      {eview === 'list' && !canDrag && !ro && S.rows.length > 1 && <HintBar>目前是排序／篩選檢視，無法調整順序。把排序改成「自訂順序」並清除篩選與搜尋後，就能拖曳每列左側的 ⋮⋮ 換位置。</HintBar>}
      <div ref={scroller} style={{ flex: 1, overflow: 'auto', padding: '18px 24px 40px', display: eview === 'list' ? undefined : 'none' }}>
        <div style={{ width: cols.reduce((a, b) => a + b, 0) + 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridOf(cols), position: 'sticky', top: 0, zIndex: 6, background: V.head, border: `1px solid ${V.line3}`, borderRadius: 8, boxShadow: `0 -18px 0 ${V.bg}` }}>
            {HEADS.map(([en, zh], i) => (
              <div key={i} style={{ position: 'relative', padding: '8px 10px', fontSize: 12, fontWeight: 500, color: V.ink2, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <span>{en}</span><span style={{ fontSize: 10, color: V.faint }}>{zh}</span>
                {i > 0 && i < HEADS.length - 1 && <div className="colgrip" title="左右拖曳調整寬度（連點兩下還原）" onPointerDown={(e) => startResize(i, e)} onDoubleClick={() => resetCol(i)} />}
              </div>
            ))}
          </div>
          {list.map((r, i) => (
            <WorkCard key={r.id} r={r} rank={rankOf.get(r.id)} S={S} ro={ro} dnd={dnd} canDrag={canDrag}
              cols={cols} first={i === 0} last={i === list.length - 1} dragging={dragId === r.id}
              over={over && over.id === r.id ? over.pos : null} logs={logsByRow.get(r.id) || []} onLogs={() => openLogs(r.id)} clash={clashByRow.get(r.id)} />
          ))}
          {list.length === 0 && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: V.muted2, background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10 }}>{S.rows.length === 0 ? '還沒有任何工作，按「＋ 新增一筆」開始。' : '沒有符合條件的資料'}</div>}
          {dragId && lastItem && (
            <div onDragOver={(e) => { if (canDrag) { e.preventDefault(); setOver({ id: lastItem.id, pos: 'after' }); } }} onDrop={(e) => dnd.drop(e, lastItem)} style={{ height: 36 }} />
          )}
          {!ro && list.length > 0 && <div className="add-row" onClick={addRow} style={{ padding: '10px 14px', fontSize: 13, color: V.muted2, cursor: 'pointer', borderRadius: 8, border: `1px dashed ${V.line3}`, textAlign: 'center' }}>＋ 新增一筆</div>}
        </div>
      </div>

      {importing && <ImportModal S={S} onClose={() => setImporting(false)} />}
      {removing && (
        <RemoveOwnerModal
          name={removing}
          rows={S.rows.filter((r) => r.owner === removing)}
          others={S.owners.filter((o) => o !== removing)}
          onCancel={() => setRemoving(null)}
          onConfirm={async (plan) => { const n = removing; setRemoving(null); await S.removeOwner(n, plan); }}
        />
      )}
    </div>
  );
}

/* ============================================================
   儀表板：總覽／個人甘特圖／卡片看板
   ============================================================ */
const card = { background: V.surface, border: `1px solid ${V.line}`, borderRadius: 10 };

const PCOLS = 'minmax(0,1fr) 56px 56px 64px 50px 60px';
// B7：生產排程統計
function planParts(S, today) {
  const ts = dstr(today), t7 = dstr(addD(today, 7)), H = 30, hiS = dstr(addD(today, H - 1));
  const vp = S.plans.filter(validPlan);
  const now = vp.filter((p) => p.start <= ts && ts <= p.end);
  const soon = vp.filter((p) => p.start > ts && p.start <= t7);
  const hw = vp.filter((p) => p.hw && p.end >= ts);
  const clash = new Set();
  vp.forEach((a) => vp.forEach((b) => { if (a.id !== b.id && a.machine && a.machine === b.machine && a.start <= b.end && b.start <= a.end && a.end >= ts) clash.add(a.id); }));
  const mset = [...new Set([...S.machines, ...vp.map((p) => p.machine).filter(Boolean)])].sort(byName);
  const rows = mset.map((m) => {
    const l = vp.filter((p) => p.machine === m);
    const days = new Set();
    l.forEach((p) => { let d = s2d(p.start < ts ? ts : p.start); const e = s2d(p.end > hiS ? hiS : p.end); while (d <= e) { days.add(dstr(d)); d = addD(d, 1); } });
    const cur = l.filter((p) => p.start <= ts && ts <= p.end);
    const next = l.filter((p) => p.start > ts).sort((a, b) => a.start.localeCompare(b.start))[0];
    return { m, used: days.size, cur, next, hw: l.some((p) => p.hw && p.end >= ts) };
  });
  const kpis = [
    { label: '今天生產中', value: now.length, sub: `${new Set(now.map((p) => p.machine)).size} 台機台` },
    { label: '未來 7 天開始', value: soon.length, sub: soon.length ? soon.map((p) => p.machine).filter(Boolean).slice(0, 3).join('、') + (soon.length > 3 ? '…' : '') : '—' },
    { label: '需 HW team 協助', value: hw.length, sub: '進行中或尚未開始', fg: hw.length ? 'oklch(0.55 0.15 50)' : V.ink },
    { label: '日期重疊', value: clash.size, sub: '同機台排程重疊（未結束）', fg: clash.size ? 'oklch(0.55 0.13 50)' : V.ink },
  ];
  const th = { fontSize: 11, color: V.muted2, background: V.tint, borderTop: `1px solid ${V.line}`, borderBottom: `1px solid ${V.line}` };
  const G = 'minmax(0,0.7fr) minmax(0,1.6fr) 150px';
  return {
    kpis: (
      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>生產排程</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: V.tint, border: `1px solid ${V.line}`, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: V.muted }}>{k.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, lineHeight: 1.1, color: k.fg || V.ink }}>{k.value}</span>
            <span style={{ fontSize: 12, color: V.muted2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</span>
          </div>
        ))}
      </div>
      </div>
    ),
    table: (
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 8 }}><h2 style={{ margin: 0, fontSize: 15 }}>各機台生產排程</h2><span style={{ fontSize: 12, color: V.muted2 }}>{rows.length} 台</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: G, padding: '8px 20px', gap: 12, ...th }}>
          <span>機台</span><span>今天／下一筆</span><span>未來 {H} 天已排</span>
        </div>
        {rows.length === 0 && <div style={{ padding: '20px', fontSize: 13, color: V.muted2 }}>還沒有機台或生產排程</div>}
        {rows.map((r) => (
          <div key={r.m} style={{ display: 'grid', gridTemplateColumns: G, gap: 12, padding: '9px 20px', fontSize: 13, borderBottom: `1px solid ${V.line}`, alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, display: 'flex', alignItems: 'center', gap: 6 }}>{r.m}{r.hw && <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: 'oklch(0.62 0.15 50)', color: '#fff', fontFamily: 'inherit' }}>HW</span>}</span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.4 }}>
              <span style={{ color: r.cur.length ? V.ink : V.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.cur.length ? r.cur.map((p) => [p.group, p.product].filter(Boolean).join(' · ').replace(/\n/g, ' ')).join('；') : '閒置'}</span>
              {r.next && <span style={{ fontSize: 11.5, color: V.muted2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>下一筆 {r.next.start.slice(5).replace('-', '/')} {[r.next.group, r.next.product].filter(Boolean).join(' · ').replace(/\n/g, ' ')}</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, height: 8, background: V.head, borderRadius: 4, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: (r.used / H) * 100 + '%', background: 'oklch(0.7 0.13 150)', borderRadius: 4 }} /></span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted, width: 48, textAlign: 'right' }}>{r.used} 天</span>
            </span>
          </div>
        ))}
      </div>
    ),
  };
}
// 總覽：全寬排版；寬螢幕三欄、較窄時兩欄
function useWinW() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}
function Overview({ D, S, goGantt }) {
  const w = useWinW();
  const e = engParts(D, goGantt), pl = planParts(S, D.today);
  const cols = w >= 1500 ? 3 : 2;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {e.kpis}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 14, alignItems: 'stretch' }}>
        {e.status}{e.prio}{pl.kpis}
        {e.people}{e.machines}{pl.table}
      </div>
    </div>
  );
}
function engParts(D, goGantt) {
  const { rows, names } = D;
  const total = rows.length, done = rows.filter((r) => r.status === '已完成').length, overdue = rows.filter((r) => r.over).length, soonN = rows.filter((r) => r.soon).length;
  const mm = {};
  rows.forEach((r) => { const m = (r.machine || '').trim(); if (m) (mm[m] = mm[m] || []).push(r); });
  const machines = Object.keys(mm).sort().map((k) => { const l = mm[k]; return { name: k, count: l.length, open: l.filter((r) => r.status !== '已完成').length, owners: [...new Set(l.map((r) => r.owner))].join('、') }; });
  const kpis = [
    { label: '工作總數', value: total, sub: `${rows.filter((r) => r.status === '進行中').length} 件進行中・${rows.filter((r) => r.status === '等客戶回覆').length} 件等客戶・${rows.filter((r) => r.status === '暫停').length} 件暫停`, fg: V.ink },
    { label: '已完成', value: done, sub: total ? `完成率 ${Math.round((done / total) * 100)}%` : '—', fg: STTX['已完成'] },
    { label: '未完成', value: total - done, sub: <>逾期 <b style={{ color: overdue ? OVER : 'inherit' }}>{overdue}</b> 件・3 天內到期 <b style={{ color: soonN ? SOON.fg : 'inherit' }}>{soonN}</b> 件</>, fg: overdue ? OVER : V.ink },
    { label: '參與人員', value: names.filter((n) => n !== UN).length, sub: names.includes(UN) ? `另有 ${rows.filter((r) => r.owner === UN).length} 件未指派` : '全部已指派', fg: V.ink },
    { label: '已安排機台', value: machines.length, sub: `${rows.filter((r) => (r.machine || '').trim()).length} 件工作使用機台`, fg: V.ink },
  ];
  const statusBars = STATUS.map((k) => { const c = rows.filter((r) => r.status === k).length; return { label: k, count: c, pct: total ? (c / total) * 100 + '%' : '0%', fg: STC[k] }; });
  const maxP = Math.max(1, ...PRIO.map((p) => rows.filter((r) => r.priority === p).length));
  const prioBars = PRIO.map((p) => { const l = rows.filter((r) => r.priority === p); return { label: p, count: l.length, open: l.filter((r) => r.status !== '已完成').length, pct: (l.length / maxP) * 100 + '%', bar: PRBAR[p], fg: p === '擱置' ? V.muted2 : p === '最優先' ? 'oklch(0.58 0.16 25)' : V.ink2 }; });
  const people = names.map((n) => { const l = rows.filter((r) => r.owner === n); const o = l.filter((r) => r.over).length; return { name: n, count: l.length, done: l.filter((r) => r.status === '已完成').length, over: o, soon: l.filter((r) => r.soon).length, days: l.reduce((a, r) => a + (Number(r.days) || 0), 0) }; });
  const th = { fontSize: 11, color: V.muted2, background: V.tint, borderTop: `1px solid ${V.line}`, borderBottom: `1px solid ${V.line}` };
  return {
    kpis: (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: V.muted }}>{k.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 34, fontWeight: 500, lineHeight: 1.1, color: k.fg }}>{k.value}</span>
            <span style={{ fontSize: 12, color: V.muted2 }}>{k.sub}</span>
          </div>
        ))}
      </div>
    ),
    status: (
        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>完成狀況</h2>
          <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: V.head }}>
            {statusBars.map((s) => <div key={s.label} title={s.label} style={{ height: '100%', width: s.pct, background: s.fg }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATUS.length},minmax(0,1fr))`, gap: 10 }}>
            {statusBars.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.muted }}><span style={{ width: 8, height: 8, borderRadius: 2, background: s.fg }} />{s.label}</div>
                <span style={{ fontFamily: MONO, fontSize: 20 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
    ),
    prio: (
        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>優先度分布</h2>
          {prioBars.map((p) => (
            <div key={p.label} style={{ display: 'grid', gridTemplateColumns: '60px minmax(0,1fr) 90px', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: p.fg }}>{p.label}</span>
              <div style={{ height: 10, background: V.head, borderRadius: 5, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 5, width: p.pct, background: p.bar }} /></div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted, textAlign: 'right' }}>{p.count} 件・{p.open} 未完</span>
            </div>
          ))}
        </div>
    ),
    people: (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 8 }}><h2 style={{ margin: 0, fontSize: 15 }}>參與人員</h2><span style={{ fontSize: 12, color: V.muted2 }}>{names.filter((n) => n !== UN).length} 人</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: PCOLS, padding: '8px 20px', ...th }}>
            <span>人員</span><span style={{ textAlign: 'right' }}>工作數</span><span style={{ textAlign: 'right' }}>已完成</span><span style={{ textAlign: 'right' }}>即將到期</span><span style={{ textAlign: 'right' }}>逾期</span><span style={{ textAlign: 'right' }}>總天數</span>
          </div>
          {people.map((p) => (
            <div key={p.name} className="person-row" onClick={() => goGantt(p.name)} style={{ display: 'grid', gridTemplateColumns: PCOLS, padding: '10px 20px', fontSize: 13, borderBottom: `1px solid ${V.line}`, cursor: 'pointer', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><Avatar name={p.name} size={24} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>{D.gone.has(p.name) && <span title="已不在工程師成員清單（帳號停用或刪除）" style={{ fontSize: 10.5, color: OVER, flex: 'none' }}>⚠ 已不在清單</span>}</div>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{p.count}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{p.done}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right', color: p.soon ? SOON.fg : V.ink2 }}>{p.soon}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right', color: p.over ? OVER : V.ink2 }}>{p.over}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{p.days}</span>
            </div>
          ))}
        </div>
    ),
    machines: (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 8 }}><h2 style={{ margin: 0, fontSize: 15 }}>已安排機台</h2><span style={{ fontSize: 12, color: V.muted2 }}>{machines.length} 台</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 60px 70px minmax(0,1.2fr)', padding: '8px 20px', ...th }}>
            <span>機台</span><span style={{ textAlign: 'right' }}>工作數</span><span style={{ textAlign: 'right' }}>未完成</span><span style={{ paddingLeft: 16 }}>負責人</span>
          </div>
          {machines.length === 0 && <div style={{ padding: '24px 20px', fontSize: 13, color: V.muted2 }}>尚未有工作填寫機台</div>}
          {machines.map((m) => (
            <div key={m.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 60px 70px minmax(0,1.2fr)', padding: '10px 20px', fontSize: 13, borderBottom: `1px solid ${V.line}`, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO }}>{m.name}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{m.count}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{m.open}</span>
              <span style={{ paddingLeft: 16, color: V.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.owners}</span>
            </div>
          ))}
        </div>
    ),
  };
}

function Gantt({ D, picked, setPicked }) {
  const { rows, names, today } = D;
  const anyPicked = Object.values(picked).some(Boolean);
  const [by, setBy] = useState('machine');
  const F = useFocus();
  const R = useRange('eng');
  const gStart = R.lo, nDays = R.n;
  const inRange = (r) => !r.dueD || !!clip(r.startD, r.dueD, R);
  const gDays = Array.from({ length: nDays }, (_, i) => {
    const d = addD(gStart, i); const t = diff(d, today) === 0; const we = d.getDay() === 0 || d.getDay() === 6;
    return { day: d.getDate(), wd: t ? '今天' : WD[d.getDay()], month: i === 0 || d.getDate() === 1 ? d.getMonth() + 1 + '月' : '', fg: t ? 'var(--accent)' : we ? V.faint : V.ink2, weight: t ? 700 : 400, headBg: t ? V.todayHead : 'transparent' };
  });
  const gBg = Array.from({ length: nDays }, (_, i) => {
    const d = addD(gStart, i); const t = diff(d, today) === 0; const we = d.getDay() === 0 || d.getDay() === 6;
    return { col: i + 2, bg: t ? V.todayBg : we ? V.tint : 'transparent' };
  });
  const mkeys = [...new Set(rows.map((r) => r.machine || '').filter(Boolean))].sort(byName).concat(rows.some((r) => !r.machine) ? [''] : []);
  const keys = by === 'owner' ? names : mkeys;
  const keyOf = (r) => (by === 'owner' ? r.owner : r.machine || '');
  const groups = keys.map((k) => {
    const l = rows.filter((r) => keyOf(r) === k && (!anyPicked || picked[r.owner]) && inRange(r)).sort((x, y) => (x.dueD ? 0 : 1) - (y.dueD ? 0 : 1) || (x.startD || 0) - (y.startD || 0) || (x.item < y.item ? -1 : 1));
    return {
      name: k, label: by === 'owner' ? k : (k || '（未指定機台）'), count: l.length,
      rows: l.map((r) => {
        const tentative = !r.dueD;
        const c = tentative ? null : clip(r.startD, r.dueD, R);
        const a = c ? diff(c.a, gStart) : 0, b = c ? diff(c.b, gStart) : 0;
        const tone = barTone(r);
        return {
          cutL: c && c.cutL, cutR: c && c.cutR, soon: r.soon,
          id: r.id, tentative, item: r.item || '（未命名）',
          machineLabel: tentative ? '日期未定' : (by === 'owner' ? (r.machine ? '機台 ' + r.machine : '') : (r.owner === UN ? '未指派' : r.owner)),
          span: `${a + 2} / ${b + 3}`, days: r.dayN, status: r.status, urgent: r.priority === '最優先',
          bg: tone.bg, fg: tone.bd, textFg: tone.fg,
          tip: `${r.item}｜${r.owner === UN ? '未指派' : r.owner}｜${r.priority}｜${tentative ? '日期未定' : '截止 ' + r.due + (r.over ? '（逾期）' : r.soon ? '（3 天內到期）' : '')}`,
        };
      }),
    };
  }).filter((g) => g.rows.length);
  const undated = rows.filter((r) => !r.dueD && (!anyPicked || picked[r.owner])).length;
  const hidden = rows.filter((r) => (!anyPicked || picked[r.owner]) && !inRange(r)).length;
  const [boxRef, boxW] = useBoxW();
  const gCols = `${GANTT_LW}px repeat(${nDays},${fitDW(boxW, nDays)}px)`;
  const legend = STATUS.map((k) => ({ label: k, fg: STC[k] })).concat([{ label: '3 天內到期', fg: SOON.bd }, { label: '逾期', fg: 'oklch(0.58 0.16 25)' }]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: V.muted }}>分組</span>
        {[['machine', '機台'], ['owner', '人員']].map(([k, l]) => <button key={k} onClick={() => setBy(k)} style={{ ...lineBtn, background: by === k ? V.btnBg : V.surface, color: by === k ? V.btnFg : V.ink, borderColor: by === k ? V.btnBg : V.line2 }}>{l}</button>)}
        <span style={{ fontSize: 13, color: V.muted, margin: '0 4px 0 12px' }}>人員篩選</span>
        {names.map((n) => {
          const on = !!picked[n];
          return (
            <button key={n} onClick={() => setPicked({ ...picked, [n]: !picked[n] })}
              style={{ height: 30, padding: '0 12px 0 4px', borderRadius: 15, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${on ? V.btnBg : V.line2}`, background: on ? V.btnBg : V.surface, color: on ? V.btnFg : V.ink2 }}>
              <Avatar name={n} />{n}
            </button>
          );
        })}
        {anyPicked && <button onClick={() => setPicked({})} style={{ height: 30, padding: '0 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: V.muted2 }}>清除篩選</button>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12, color: V.muted }}>
          {legend.map((l) => <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 2, background: l.fg }} />{l.label}</div>)}
        </div>
      </div>
      <RangeBar R={R} hidden={hidden} />
      <div ref={boxRef} style={{ background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, overflow: 'auto', maxHeight: 'calc(100vh - 236px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gCols, position: 'sticky', top: 0, zIndex: 3, background: V.head, borderBottom: `1px solid ${V.line3}`, width: 'max-content', minWidth: '100%' }}>
          <div style={{ position: 'sticky', left: 0, zIndex: 4, background: V.head, padding: '8px 14px', fontSize: 12, color: V.muted, borderRight: `1px solid ${V.line3}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, alignItems: 'flex-start' }}><span>工作項目 / 機台</span>{focusHint(F)}</div>
          {gDays.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 6px', borderRight: `1px solid ${V.line}`, background: d.headBg }}>
              <span style={{ fontSize: 10, color: V.muted2, height: 13 }}>{d.month}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: d.weight, color: d.fg }}>{d.day}</span>
              <span style={{ fontSize: 10, color: d.fg }}>{d.wd}</span>
            </div>
          ))}
        </div>
        {groups.map((g) => (
          <React.Fragment key={g.name || 'none'}>
            <div onClick={() => F.group(g.name || 'none')} style={{ display: 'grid', gridTemplateColumns: gCols, background: V.tint, borderBottom: `1px solid ${V.line}`, width: 'max-content', minWidth: '100%', cursor: 'pointer', boxShadow: F.gOn(g.name || 'none') ? FOCUS_BAR : undefined, ...(F.gDim(g.name || 'none') ? DIM : null) }}>
              <div style={{ position: 'sticky', left: 0, zIndex: 2, background: V.tint, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderRight: `1px solid ${V.line3}` }}>
                {by === 'owner' ? <><Avatar name={g.name} /><span style={{ fontSize: 13, fontWeight: 500 }}>{g.label}</span></> : <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>{g.label}</span>}
                <span style={{ fontFamily: MONO, fontSize: 11, color: V.muted2 }}>{g.count} 件</span>
              </div>
              <div style={{ gridColumn: '2 / -1' }} />
            </div>
            {g.rows.map((r) => (
              <div key={r.id} onClick={() => F.row(g.name || 'none', r.id)} style={{ display: 'grid', gridTemplateColumns: gCols, gridTemplateRows: '40px', borderBottom: `1px solid ${V.line}`, width: 'max-content', minWidth: '100%', cursor: 'pointer', boxShadow: F.rOn(r.id) ? FOCUS_BAR : undefined, ...(F.rDim(g.name || 'none', r.id) ? DIM : null) }}>
                <div style={{ gridRow: 1, gridColumn: 1, position: 'sticky', left: 0, zIndex: 2, background: V.surface, padding: '0 14px 0 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: `1px solid ${V.line3}`, minWidth: 0 }}>
                  <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.item}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: V.faint }}>{r.machineLabel}</span>
                </div>
                {gBg.map((b) => <div key={b.col} style={{ gridRow: 1, gridColumn: b.col, borderRight: `1px solid ${V.line}`, background: b.bg }} />)}
                {!r.tentative && (
                <div title={r.tip} style={{ gridRow: 1, gridColumn: r.span, zIndex: 1, margin: '8px 2px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', overflow: 'hidden', background: r.bg, border: `1px solid ${r.fg}` }}>
                  {r.cutL && <span style={{ fontSize: 11, color: r.textFg, flex: 'none' }} title="開始日在區間之前">‹</span>}
                  {r.urgent && <span style={{ width: 6, height: 6, borderRadius: '50%', flex: 'none', background: 'oklch(0.58 0.17 25)' }} />}
                  <span style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: r.textFg }}>{r.soon ? '⏰ ' : ''}{r.days}天・{r.status}</span>
                  {r.cutR && <span style={{ marginLeft: 'auto', fontSize: 11, color: r.textFg, flex: 'none' }} title="截止日在區間之後">›</span>}
                </div>
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      {undated > 0 && <span style={{ fontSize: 12, color: V.muted2 }}>其中 {undated} 件尚未設定截止日（日期未定），只列在清單中，不畫在時間軸上；填入截止日後才會出現橫條。</span>}
    </div>
  );
}

function Board({ D, S, openLogs }) {
  const { rows, today } = D;
  const nLog = new Map(); S.logs.forEach((l) => nLog.set(l.rowId, (nLog.get(l.rowId) || 0) + 1));
  const [drag, setDrag] = useState(null), [overCol, setOverCol] = useState(null);
  const can = S.canEdit;
  const cols = STATUS.map((k) => {
    const cards = rows.filter((r) => r.status === k)
      .sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority) || (a.due || '9').localeCompare(b.due || '9'));
    return { label: k, fg: STC[k], cards };
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATUS.length},minmax(210px,1fr))`, gap: 12, alignItems: 'start' }}>
      {cols.map((col) => (
        <div key={col.label}
          onDragOver={(e) => { if (!drag) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overCol !== col.label) setOverCol(col.label); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
          onDrop={(e) => { e.preventDefault(); const t = rows.find((x) => x.id === drag); setDrag(null); setOverCol(null); if (t && t.status !== col.label) S.patch(t.id, { status: col.label }); }}
          style={{ background: V.head, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 240, outline: overCol === col.label ? `2px dashed ${V.accent}` : 'none', outlineOffset: -2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: col.fg }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{col.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted2 }}>{col.cards.length}</span>
          </div>
          {col.cards.map((t) => {
            const [prBg, prFg, prBd] = PR[t.priority] || PR['普通'];
            const m = (t.machine || '').trim();
            const nf = (t.files || []).length;
            const di = dueInfo(t, today), nl = nLog.get(t.id) || 0;
            return (
              <div key={t.id} className="wcard" draggable={can} onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); setTimeout(() => setDrag(t.id), 0); }} onDragEnd={() => { setDrag(null); setOverCol(null); }}
                onClick={() => openLogs(t.id)} title={can ? '拖到其他欄可改狀態；點一下看進度紀錄' : '點一下看進度紀錄'}
                style={{ background: V.surface, border: `1px solid ${t.soon ? SOON.bd : V.line}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, cursor: can ? 'grab' : 'pointer', opacity: drag === t.id ? 0.4 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, borderRadius: 4, padding: '2px 7px', background: prBg, color: prFg, border: `1px solid ${prBd}` }}>{t.priority}</span>
                  {m && <span style={{ fontFamily: MONO, fontSize: 11, color: V.muted, background: V.tint, borderRadius: 4, padding: '2px 7px' }}>{m}</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.45, textWrap: 'pretty' }}>{t.item || '（未命名）'}</div>
                {(t.remark || '').trim() && <div style={{ fontSize: 12, lineHeight: 1.5, color: V.muted }}>{t.remark}</div>}
                {(t.custOwner || '').trim() && <div style={{ fontSize: 11, color: V.muted2 }}>客戶 Owner：{t.custOwner}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: `1px solid ${V.line}` }}>
                  <Avatar name={t.owner} />
                  <span style={{ fontSize: 12, color: V.ink2 }}>{t.owner}</span>
                  {nf > 0 && <span style={{ fontSize: 11, color: V.muted2 }}>附件 {nf}</span>}
                  {nl > 0 && <span style={{ fontSize: 11, color: V.muted2 }}>紀錄 {nl}</span>}
                  <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: di ? di.fg : V.muted, fontWeight: di ? 600 : 400 }}>{t.due ? (di ? di.text + ' · ' : '') + t.due.slice(5).replace('-', '/') : '未設日期'}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   外框
   ============================================================ */
/* ============================================================
   機台生產排程（Planner team）
   ============================================================ */
const PGRID = [150, 150, 240, 100, 132, 132, 64, 300, 126, 64];
const PGMIN = [100, 80, 120, 70, 110, 110, 56, 100, 100, 64];
const PHEADS = [['Machine', '機台名稱'], ['Group', '測試產品 Group'], ['Product', '測試產品名稱'], ['HW', 'HW team'], ['Start', '開始日'], ['End', '結束日'], ['Days', '天數'], ['Remark', '備註'], ['Update', '更新時間'], ['', '']];
const pCell = { padding: '4px 4px', minWidth: 0, display: 'flex', alignItems: 'center' };
const pin = (extra) => ({ height: 30, width: '100%', minWidth: 0, border: '1px solid transparent', borderRadius: 6, background: 'transparent', padding: '0 8px', fontSize: 13, ...extra });

function HwSwitch({ on, onChange, disabled }) {
  return (
    <button role="switch" aria-checked={!!on} disabled={disabled} onClick={() => onChange(!on)} title={on ? '需要 HW team 協助（點一下取消）' : '點一下標記為需要 HW team 協助'}
      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', padding: 2, cursor: disabled ? 'default' : 'pointer', background: on ? 'oklch(0.62 0.15 50)' : V.line3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .15s' }}>
      <span style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
    </button>
  );
}

function PlanRow({ p, S, ro, clash, machineOpts, cols }) {
  const set = (k) => (v) => S.patchPlan(p.id, { [k]: v });
  const days = p.start && p.end ? diff(s2d(p.end), s2d(p.start)) + 1 : '';
  const bad = p.start && p.end && days < 1;
  const opts = [...new Set([...machineOpts, ...(p.machine ? [p.machine] : [])])].sort(byName);
  const dateStyle = (c) => pin({ fontFamily: MONO, fontSize: 12, padding: '0 4px', color: c || 'inherit' });
  return (
    <div className="wcard" style={{ display: 'grid', gridTemplateColumns: gridOf(cols), alignItems: 'stretch', background: V.surface, border: `1px solid ${clash ? 'oklch(0.7 0.12 50)' : V.line2}`, borderRadius: 8, minHeight: 46, boxShadow: p.hw ? 'inset 4px 0 0 oklch(0.62 0.15 50)' : undefined }}>
      <div style={pCell}>
        <select className="cin" value={p.machine || ''} disabled={ro} onChange={(e) => set('machine')(e.target.value)} style={pin({ cursor: ro ? 'default' : 'pointer', fontFamily: MONO, fontSize: 12, fontWeight: 600 })}>
          <option value="">—</option>
          {opts.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div style={pCell}><CellText multiline grow enterBlur className="cin" value={p.group} onCommit={set('group')} disabled={ro} placeholder="Group" style={pin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', wordBreak: 'break-word' })} /></div>
      <div style={pCell}><CellText multiline grow enterBlur className="cin" value={p.product} onCommit={set('product')} disabled={ro} placeholder="產品名稱" style={pin({ fontWeight: 600, height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', wordBreak: 'break-word' })} /></div>
      <div style={{ ...pCell, justifyContent: 'center' }}><HwSwitch on={p.hw} disabled={ro} onChange={set('hw')} /></div>
      <div style={pCell}><input className="cin" type="date" value={p.start || ''} disabled={ro} onChange={(e) => set('start')(e.target.value)} style={dateStyle()} /></div>
      <div style={pCell}><input className="cin" type="date" value={p.end || ''} disabled={ro} onChange={(e) => set('end')(e.target.value)} style={dateStyle(bad ? 'oklch(0.55 0.17 25)' : null)} /></div>
      <div style={{ ...pCell, fontFamily: MONO, fontSize: 12, color: bad ? 'oklch(0.55 0.17 25)' : V.muted, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}>
        <span>{bad ? '日期有誤' : days}</span>
        {clash && !bad && <span title="同一台機台有日期重疊的排程" style={{ fontSize: 10, color: 'oklch(0.55 0.13 50)', fontFamily: 'inherit' }}>⚠ 重疊</span>}
      </div>
      <div style={pCell}><CellText multiline grow className="cin" value={p.remark} onCommit={set('remark')} disabled={ro} placeholder="備註" style={pin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', color: V.ink2 })} /></div>
      <div style={{ ...pCell, fontFamily: MONO, fontSize: 11, color: V.muted2, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}><span>{p.updated || '—'}</span>{p.updatedBy && <span style={{ fontSize: 10.5, color: V.faint }}>{p.updatedBy}</span>}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <button className="mv" disabled={ro} onClick={() => S.addPlan('', p)} title="複製一筆（同樣內容，可再改機台或日期）" style={{ ...mvBtn, fontSize: 13, width: 24 }}>⧉</button>
        <RowDelete disabled={ro} onDelete={() => S.delPlan(p.id)} />
      </div>
    </div>
  );
}

/* ============================================================
   每日一格時程圖（生產排程、複合排程共用）
   ============================================================ */
// 甘特圖：左欄寬度、每天最小寬度；實際每天寬度依畫面撐滿
const GANTT_LW = 320, MIN_DW = 44;
function useBoxW() {
  // callback ref：元素晚出現（例如原本沒資料）也能量到寬度
  const [el, setEl] = useState(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const f = () => setW(el.clientWidth);
    f();
    if (!window.ResizeObserver) { window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, [el]);
  return [setEl, w];
}
const fitDW = (boxW, n) => (boxW ? Math.max(MIN_DW, Math.floor((boxW - GANTT_LW - 2) / n)) : MIN_DW);
const DIM = { opacity: 0.28, filter: 'grayscale(1)', transition: 'opacity .15s' };
function useFocus() {
  const [f, setF] = useState(null); // {m, id}
  useEffect(() => { if (!f) return; const k = (e) => { if (e.key === 'Escape') setF(null); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [f]);
  return {
    f, clear: () => setF(null),
    group: (m) => setF((c) => (c && c.m === m && !c.id ? null : { m })),
    row: (m, id) => setF((c) => (c && c.id === id ? { m } : { m, id })),
    gDim: (m) => !!f && f.m !== m,
    rDim: (m, id) => !!f && (f.m !== m || (!!f.id && f.id !== id)),
    gOn: (m) => !!f && f.m === m && !f.id,
    rOn: (id) => !!f && f.id === id,
  };
}
const FOCUS_BAR = 'inset 4px 0 0 var(--accent)';
const focusHint = (F) => F.f
  ? <button onClick={F.clear} style={{ border: `1px solid ${V.line3}`, background: V.surface, borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: V.ink2 }}>✕ 取消重點（Esc）</button>
  : <span style={{ fontSize: 10, color: V.faint }}>點機台或項目可重點顯示</span>;
function DailyGrid({ groups: allGroups, headLabel, rangeKey }) {
  const F = useFocus();
  const R = useRange(rangeKey);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [boxRef, boxW] = useBoxW();
  const lo = R.lo, n = R.n, LW = GANTT_LW, DW = fitDW(boxW, n), W = n * DW;
  // 只留在區間內的橫條；整列都在區間外就先隱藏（日期未定的列照常顯示）
  let hidden = 0;
  const groups = allGroups.map((g) => ({
    ...g,
    rows: g.rows.map((r) => ({ ...r, bars: r.bars.map((b) => { const c = clip(b.a, b.b, R); return c && { ...b, a: c.a, b: c.b, cutL: c.cutL, cutR: c.cutR }; }).filter(Boolean), had: r.bars.length }))
      .filter((r) => { const keep = r.bars.length > 0 || r.had === 0; if (!keep) hidden++; return keep; }),
  })).filter((g) => g.rows.length);
  const days = Array.from({ length: n }, (_, i) => { const d = addD(lo, i); return { d, t: diff(d, today) === 0, we: d.getDay() === 0 || d.getDay() === 6 }; });
  const grid = `repeating-linear-gradient(to right, transparent 0, transparent ${DW - 1}px, ${V.line} ${DW - 1}px, ${V.line} ${DW}px)`;
  const shades = days.map((x, i) => (x.t || x.we) ? <div key={i} style={{ position: 'absolute', left: i * DW, width: DW, top: 0, bottom: 0, background: x.t ? V.todayBg : V.tint }} /> : null);
  const lines = `repeating-linear-gradient(to right, transparent 0, transparent ${DW - 1}px, rgba(255,255,255,0.75) ${DW - 1}px, rgba(255,255,255,0.75) ${DW}px)`;
  if (groups.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <RangeBar R={R} hidden={hidden} />
      <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: V.muted2, background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10 }}>{hidden ? '這個區間沒有排程，可用上方 ◀ ▶ 切換日期' : '沒有可以畫在時程上的資料（需要起訖日期）'}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <RangeBar R={R} hidden={hidden} />
    <div ref={boxRef} style={{ background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
      <div style={{ width: LW + W, minWidth: '100%' }}>
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5, background: V.head, borderBottom: `1px solid ${V.line3}` }}>
          <div style={{ width: LW, flex: 'none', position: 'sticky', left: 0, zIndex: 6, background: V.head, padding: '8px 14px', fontSize: 12, color: V.muted, borderRight: `1px solid ${V.line3}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, alignItems: 'flex-start' }}><span>{headLabel}</span>{focusHint(F)}</div>
          <div style={{ display: 'flex', width: W }}>
            {days.map((x, i) => (
              <div key={i} style={{ width: DW, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 6px', borderRight: `1px solid ${V.line}`, background: x.t ? V.todayHead : 'transparent' }}>
                <span style={{ fontSize: 10, color: V.muted2, height: 13, whiteSpace: 'nowrap' }}>{i === 0 || x.d.getDate() === 1 ? x.d.getMonth() + 1 + '月' : ''}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: x.t ? 700 : 400, color: x.t ? 'var(--accent)' : x.we ? V.faint : V.ink2 }}>{x.d.getDate()}</span>
                <span style={{ fontSize: 10, color: x.t ? 'var(--accent)' : x.we ? V.faint : V.ink2 }}>{x.t ? '今天' : WD[x.d.getDay()]}</span>
              </div>
            ))}
          </div>
        </div>
        {groups.map((g) => (
          <React.Fragment key={g.key}>
            <div onClick={() => F.group(g.key)} style={{ display: 'flex', background: V.tint, borderBottom: `1px solid ${V.line}`, cursor: 'pointer', boxShadow: F.gOn(g.key) ? FOCUS_BAR : undefined, ...(F.gDim(g.key) ? DIM : null) }}>
              <div style={{ width: LW, flex: 'none', position: 'sticky', left: 0, zIndex: 2, background: V.tint, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderRight: `1px solid ${V.line3}` }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>{g.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: V.muted2 }}>{g.rows.length} 件</span>
              </div>
            </div>
            {g.rows.map((r) => (
              <div key={r.id} onClick={() => F.row(g.key, r.id)} style={{ display: 'flex', height: 42, borderBottom: `1px solid ${V.line}`, cursor: 'pointer', boxShadow: F.rOn(r.id) ? FOCUS_BAR : undefined, ...(F.rDim(g.key, r.id) ? DIM : null) }}>
                <div style={{ width: LW, flex: 'none', position: 'sticky', left: 0, zIndex: 2, background: V.surface, padding: '0 14px 0 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: `1px solid ${V.line3}`, minWidth: 0 }}>
                  <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tag && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, marginRight: 6, background: r.tagBg, color: r.tagFg, verticalAlign: 1 }}>{r.tag}</span>}{r.hw && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, marginRight: 6, background: 'oklch(0.62 0.15 50)', color: '#fff', verticalAlign: 1 }}>HW</span>}{r.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: V.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</span>
                </div>
                <div style={{ position: 'relative', width: W, flex: 'none', backgroundImage: grid }}>
                  {shades}
                  {r.bars.map((b, k) => (
                    <div key={k} title={b.tip} style={{ position: 'absolute', left: diff(b.a, lo) * DW, width: (diff(b.b, b.a) + 1) * DW, top: 7, height: 28, borderRadius: 5, backgroundColor: b.bg, backgroundImage: b.tent ? 'repeating-linear-gradient(135deg, transparent 0, transparent 5px, rgba(0,0,0,0.07) 5px, rgba(0,0,0,0.07) 8px)' : lines, border: `1px ${b.tent ? 'dashed' : 'solid'} ${b.bd}`, color: b.fg, fontSize: 11.5, lineHeight: '26px', padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box', zIndex: 1 }}>{b.cutL ? '‹ ' : ''}{b.text}{b.cutR ? ' ›' : ''}</div>
                  ))}
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
    </div>
  );
}

const planBar = (p) => { const h = hue(p.group || p.product || 'x'); return { a: s2d(p.start), b: s2d(p.end), bg: `oklch(0.9 0.07 ${h})`, bd: `oklch(0.68 0.11 ${h})`, fg: `oklch(0.32 0.1 ${h})`, text: `${p.hw ? '🔧HW · ' : ''}${p.group ? p.group + ' · ' : ''}${p.product || ''}`, tip: `${p.hw ? '【需 HW team 協助】\n' : ''}${p.machine}｜${p.group || ''} ${p.product || ''}\n${p.start} → ${p.end}${p.remark ? '\n' + p.remark : ''}` }; };
const planRowOf = (p, tag) => ({ id: 'p' + p.id, label: `${p.group ? p.group + ' · ' : ''}${p.product || '（未命名）'}`, sub: `${p.start.slice(5)} → ${p.end.slice(5)}${p.remark ? '｜' + p.remark : ''}`, tag, hw: !!p.hw, tagBg: 'oklch(0.9 0.09 150)', tagFg: 'oklch(0.36 0.1 150)', bars: [planBar(p)], a: p.start });
const validPlan = (p) => p.start && p.end && s2d(p.end) >= s2d(p.start);

function PlanTimeline({ plans, machineNames }) {
  const groups = machineNames.map((m) => ({ key: m, label: m, rows: plans.filter((p) => p.machine === m && validPlan(p)).map((p) => planRowOf(p)).sort((x, y) => (x.a < y.a ? -1 : 1)) })).filter((g) => g.rows.length);
  return <DailyGrid groups={groups} headLabel="機台 / 測試產品" rangeKey="plan" />;
}

function ComboPage({ S, D }) {
  const [mode, setMode] = useState('both');
  const [mf, setMf] = useState('');
  const [hwOnly, setHwOnly] = useState(false);
  const showE = mode !== 'plan', showP = mode !== 'eng';
  const eng = D.rows;
  const plans = S.plans.filter(validPlan);
  const NONE = '（未指定機台）';
  const mset = [...new Set([...S.machines, ...D.rows.map((r) => r.machine).filter(Boolean), ...S.plans.map((p) => p.machine).filter(Boolean)])].sort(byName);
  const keys = [...mset, ''];
  const clashM = engPlanClash(D.rows, S.plans);
  const engRow = (r0) => { const r = { ...r0, tentative: !r0.dueD }; return { id: 'e' + r.id, label: (clashM.has(r.id) ? '⚠ ' : '') + (r.item || '（未命名）'), sub: `${r.owner === UN ? '未指派' : r.owner}｜${r.status}｜${r.priority}${r.tentative ? '｜日期未定' : ''}${clashM.has(r.id) ? '｜與生產排程重疊' : ''}`, tag: '工程', tagBg: 'oklch(0.9 0.12 90)', tagFg: 'oklch(0.38 0.09 80)', a: r.startD ? dstr(r.startD) : '9999', bars: r.tentative ? [] : [{ a: r.startD, b: r.dueD, ...barTone(r), text: `${r.soon ? '⏰ ' : ''}${r.owner === UN ? '' : r.owner + ' · '}${r.item || ''}`, tip: `${r.item}｜${r.owner}｜${r.status}｜截止 ${r.due}${r.over ? '（逾期）' : r.soon ? '（3 天內到期）' : ''}` }] }; };
  const groups = keys.filter((m) => !mf || m === mf).map((m) => {
    const rows = [
      ...(showE ? eng.filter((r) => (r.machine || '') === m).map(engRow) : []),
      ...(showP ? plans.filter((p) => (p.machine || '') === m && (!hwOnly || p.hw)).map((p) => planRowOf(p, '生產')) : []),
    ].sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : 0));
    return { key: m || 'none', label: m || NONE, rows };
  }).filter((g) => g.rows.length);
  const noDateE = D.rows.filter((r) => !r.dueD).length, noDateP = S.plans.length - plans.length;
  const btn = (k, label) => <button key={k} onClick={() => setMode(k)} style={{ ...lineBtn, background: mode === k ? V.btnBg : V.surface, color: mode === k ? V.btnFg : V.ink, borderColor: mode === k ? V.btnBg : V.line2 }}>{label}</button>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>{btn('eng', '工程排程')}{btn('plan', '生產排程')}{btn('both', '工程排程＋生產排程')}</div>
        <button onClick={() => setHwOnly((v) => !v)} style={{ ...lineBtn, background: hwOnly ? 'oklch(0.62 0.15 50)' : V.surface, color: hwOnly ? '#fff' : V.ink, borderColor: hwOnly ? 'oklch(0.62 0.15 50)' : V.line2 }}>生產排程只看 HW 相關</button>
        <select value={mf} onChange={(e) => setMf(e.target.value)} style={{ height: 32, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 8px', fontSize: 13, background: V.surface }}>
          <option value="">全部機台</option>
          {mset.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12, color: V.muted, alignItems: 'center' }}>
          {showE && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 2, background: 'oklch(0.82 0.14 90)' }} />工程（顏色＝狀態，橘＝3 天內到期，紅＝逾期）</span>}
          {showP && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 2, background: 'oklch(0.7 0.13 150)' }} />生產（顏色＝產品 Group）</span>}
        </div>
      </div>
      {((showE && noDateE > 0) || (showP && noDateP > 0)) && <div style={{ fontSize: 12, color: V.muted2 }}>{showE && noDateE > 0 ? `${noDateE} 筆工程項目日期未定，只列在清單、不畫橫條　` : ''}{showP && noDateP > 0 ? `${noDateP} 筆生產排程日期未填或有誤，未顯示` : ''}</div>}
      <DailyGrid groups={groups} headLabel="機台 / 項目" rangeKey="combo" />
    </div>
  );
}

function PlanPage({ S }) {
  const [showPM, setShowPM] = useState(false);
  const ro = !S.canPlan;
  const [mode, setMode] = useState('list');
  const [mf, setMf] = useState('');
  const [q, setQ] = useState('');
  const [hwOnly, setHwOnly] = useState(false);
  const machineOpts = S.machines;
  const used = [...new Set([...S.machines, ...S.plans.map((p) => p.machine).filter(Boolean)])].sort(byName);
  const sorted = [...S.plans].sort((a, b) => byName(a.machine || '￿', b.machine || '￿') || ((a.start || '9') < (b.start || '9') ? -1 : (a.start || '9') > (b.start || '9') ? 1 : 0));
  const clashIds = new Set();
  sorted.forEach((a) => sorted.forEach((b) => { if (a.id !== b.id && a.machine && a.machine === b.machine && a.start && a.end && b.start && b.end && a.start <= b.end && b.start <= a.end) clashIds.add(a.id); }));
  const ql = q.trim().toLowerCase();
  const list = sorted.filter((p) => (!mf || p.machine === mf) && (!hwOnly || p.hw) && (!ql || [p.machine, p.group, p.product, p.remark].some((x) => (x || '').toLowerCase().includes(ql))));
  const [pcols, startPResize, resetPCol] = useCols('plan.cols.v1', PGRID, PGMIN);
  const total = pcols.reduce((a, b) => a + b, 0) + 2;
  const tabBtn = (k, label) => <button key={k} onClick={() => setMode(k)} style={{ ...lineBtn, background: mode === k ? V.btnBg : V.surface, color: mode === k ? V.btnFg : V.ink, borderColor: mode === k ? V.btnBg : V.line2 }}>{label}</button>;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderBottom: `1px solid ${V.line}`, flex: 'none' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted2 }}>{list.length} / {S.plans.length} 筆</span>
        {clashIds.size > 0 && <span style={{ fontSize: 12, color: 'oklch(0.55 0.13 50)' }}>⚠ {clashIds.size} 筆排程日期重疊</span>}
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>{tabBtn('list', '列表')}{tabBtn('time', '時程圖')}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <button className="member-btn" onClick={() => setShowPM((v) => !v)} style={lineBtn}>Planner 成員（{S.planners.length}）</button>
            {showPM && <MemberPanel S={S} roA={!S.canAdmin} team="planner" onRemove={(n) => S.delOwnerOnly(n)} onClose={() => setShowPM(false)} />}
          </div>
          <button onClick={() => setHwOnly((v) => !v)} style={{ ...lineBtn, background: hwOnly ? 'oklch(0.62 0.15 50)' : V.surface, color: hwOnly ? '#fff' : V.ink, borderColor: hwOnly ? 'oklch(0.62 0.15 50)' : V.line2 }}>只看 HW 相關（{S.plans.filter((p) => p.hw).length}）</button>
          <select value={mf} onChange={(e) => setMf(e.target.value)} style={{ height: 32, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 8px', fontSize: 13, background: V.surface }}>
            <option value="">全部機台</option>
            {used.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋 機台 / group / 產品 / 備註" style={{ height: 32, width: 240, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 10px', fontSize: 13, background: V.surface }} />
          <button className="btn-dark" disabled={ro} onClick={() => S.addPlan(mf)} style={{ ...darkBtn, opacity: ro ? 0.5 : 1 }}>＋ 新增排程</button>
        </div>
      </div>
      {S.machines.length === 0 && <HintBar>機台名稱來自「工程清單」頁的「機台清單」，請先在那裡建立機台。</HintBar>}
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px 40px' }}>
        {mode === 'time' ? <PlanTimeline plans={list} machineNames={used} /> : (
          <div style={{ width: total, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridOf(pcols), position: 'sticky', top: 0, zIndex: 6, background: V.head, border: `1px solid ${V.line3}`, borderRadius: 8, boxShadow: `0 -18px 0 ${V.bg}` }}>
              {PHEADS.map(([en, zh], i) => (
                <div key={i} style={{ position: 'relative', padding: '8px 10px', fontSize: 12, fontWeight: 500, color: V.ink2, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span>{en}</span><span style={{ fontSize: 10, color: V.faint }}>{zh}</span>
                  {i < PHEADS.length - 1 && <div className="colgrip" title="左右拖曳調整寬度（連點兩下還原）" onPointerDown={(e) => startPResize(i, e)} onDoubleClick={() => resetPCol(i)} />}
                </div>
              ))}
            </div>
            {list.map((p) => <PlanRow key={p.id} p={p} S={S} ro={ro} clash={clashIds.has(p.id)} machineOpts={machineOpts} cols={pcols} />)}
            {list.length === 0 && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: V.muted2, background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10 }}>{S.plans.length === 0 ? '還沒有任何排程，按「＋ 新增排程」開始。' : '沒有符合條件的資料'}</div>}
            {!ro && <div className="add-row" onClick={() => S.addPlan(mf)} style={{ padding: '10px 14px', fontSize: 13, color: V.muted2, cursor: 'pointer', borderRadius: 8, border: `1px dashed ${V.line3}`, textAlign: 'center' }}>＋ 新增排程</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   C1：每日視圖 —— 選一天，看每個人手上的工作、逾期、當天紀錄，以及當天機台生產排程
   ============================================================ */
function DailyPage({ S, D, openLogs }) {
  const [day, setDay] = useState(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; });
  const ds = dstr(day);
  const isToday = diff(day, D.today) === 0;
  const active = D.rows.filter((r) => r.dueD && r.startD <= day && day <= r.dueD);
  const overdue = D.rows.filter((r) => r.dueD && r.dueD < day && !QUIET.includes(r.status));
  const dayLogs = S.logs.filter((l) => l.date === ds);
  const rowOf = new Map(S.rows.map((r) => [r.id, r]));
  const plans = S.plans.filter((p) => validPlan(p) && p.start <= ds && ds <= p.end).sort((a, b) => byName(a.machine || '', b.machine || ''));
  const people = [...new Set([...S.owners, ...active.map((r) => r.owner), ...overdue.map((r) => r.owner)])]
    .map((n) => ({
      name: n,
      act: active.filter((r) => r.owner === n).sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority)),
      over: overdue.filter((r) => r.owner === n),
      logs: dayLogs.filter((l) => l.author === n || (!l.author && (rowOf.get(l.rowId) || {}).owner === n)),
    }))
    .sort((a, b) => (b.name === S.me) - (a.name === S.me) || (a.name === UN) - (b.name === UN) || (b.act.length + b.over.length) - (a.act.length + a.over.length));
  const shift = (n) => setDay((d) => addD(d, n));
  const b = { ...lineBtn, height: 30, padding: '0 10px', fontSize: 12 };
  const ItemLine = ({ r, overdueMode }) => {
    const di = dueInfo(r, overdueMode ? day : D.today);
    const [stBg, stFg] = ST[r.status] || ST['未開始'];
    const nl = S.logs.filter((l) => l.rowId === r.id).length;
    return (
      <div className="member-item" onClick={() => openLogs(r.id)} title="點一下看進度紀錄" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', borderLeft: `3px solid ${r.priority === '最優先' ? 'oklch(0.58 0.17 25)' : r.priority === '優先' ? PRBAR['優先'] : 'transparent'}` }}>
        <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.item || '（未命名）'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, color: V.muted }}>
          <span style={{ borderRadius: 9, padding: '1px 7px', background: stBg, color: stFg }}>{r.status}</span>
          {r.machine && <span style={{ fontFamily: MONO }}>{r.machine}</span>}
          <span style={{ fontFamily: MONO }}>{md(r.startD)}–{md(r.dueD)}</span>
          {overdueMode ? <span style={{ color: OVER, fontWeight: 500 }}>逾期 {diff(day, r.dueD)} 天</span> : di && <span style={{ color: di.fg, fontWeight: 500 }}>{di.text}</span>}
          {nl > 0 && <span style={{ color: V.faint }}>紀錄 {nl}</span>}
        </span>
      </div>
    );
  };
  const sec = (t, n, fg) => <div style={{ fontSize: 11, color: fg || V.muted2, padding: '8px 8px 2px', display: 'flex', gap: 6 }}>{t}<span style={{ fontFamily: MONO }}>{n}</span></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => shift(-1)} style={b}>◀ 前一天</button>
        <button onClick={() => setDay(new Date(D.today))} disabled={isToday} style={{ ...b, opacity: isToday ? 0.5 : 1 }}>今天</button>
        <button onClick={() => shift(1)} style={b}>後一天 ▶</button>
        <input type="date" value={ds} onChange={(e) => e.target.value && setDay(s2d(e.target.value))} style={{ ...b, fontFamily: MONO }} />
        <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 8 }}>{day.getMonth() + 1} 月 {day.getDate()} 日（{WD[day.getDay()]}）{isToday && <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 6 }}>今天</span>}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: V.muted }}>進行中工作 <b>{active.length}</b>・逾期未完成 <b style={{ color: overdue.length ? OVER : 'inherit' }}>{overdue.length}</b>・當天紀錄 <b>{dayLogs.length}</b>・生產排程 <b>{plans.length}</b></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
          {people.map((p) => (
            <div key={p.name} style={{ ...card, padding: 10, display: 'flex', flexDirection: 'column', gap: 2, borderColor: p.name === S.me ? 'var(--accent)' : V.line }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 6px', borderBottom: `1px solid ${V.line}` }}>
                <Avatar name={p.name} size={26} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                {D.gone.has(p.name) && <span title="已不在工程師成員清單（帳號停用或刪除），請改派他的工作" style={{ fontSize: 10.5, color: OVER }}>⚠ 已不在清單</span>}
                {p.name === S.me && <span style={{ fontSize: 10, color: 'var(--accent)' }}>我</span>}
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: V.muted2 }}>{p.act.length} 件{p.over.length ? `・逾期 ${p.over.length}` : ''}</span>
              </div>
              {p.act.length === 0 && p.over.length === 0 && p.logs.length === 0 && <div style={{ padding: '14px 8px', fontSize: 12, color: V.faint }}>這天沒有排定的工作</div>}
              {p.act.length > 0 && <>{sec('這天的工作', p.act.length)}{p.act.map((r) => <ItemLine key={r.id} r={r} />)}</>}
              {p.over.length > 0 && <>{sec('逾期未完成', p.over.length, OVER)}{p.over.map((r) => <ItemLine key={r.id} r={r} overdueMode />)}</>}
              {p.logs.length > 0 && <>{sec('這天的進度紀錄', p.logs.length)}{p.logs.map((l) => (
                <div key={l.id} className="member-item" onClick={() => openLogs(l.rowId)} style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, lineHeight: 1.5 }}>
                  <div style={{ color: V.muted2, fontSize: 11 }}>{((rowOf.get(l.rowId) || {}).item || '（已刪除）').split('\n')[0]}</div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.text}</div>
                </div>
              ))}</>}
            </div>
          ))}
        </div>
        <div style={{ ...card, overflow: 'hidden', position: 'sticky', top: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${V.line}`, display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 600 }}>這天的機台生產排程</span><span style={{ fontFamily: MONO, fontSize: 11, color: V.muted2 }}>{plans.length} 筆</span></div>
          {plans.length === 0 && <div style={{ padding: '18px 14px', fontSize: 12, color: V.faint }}>這天沒有生產排程</div>}
          {plans.map((p) => (
            <div key={p.id} style={{ padding: '8px 14px', borderBottom: `1px solid ${V.line}`, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: p.hw ? 'inset 3px 0 0 oklch(0.62 0.15 50)' : undefined }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{p.machine || '（未指定）'}</span>
                {p.hw && <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: 'oklch(0.62 0.15 50)', color: '#fff' }}>HW</span>}
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, color: V.faint }}>{p.start.slice(5)} → {p.end.slice(5)}</span>
              </span>
              <span style={{ fontSize: 12, color: V.ink2, whiteSpace: 'pre-wrap' }}>{[p.group, p.product].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const THEMES = [['light', '淺色'], ['dark', '深色'], ['auto', '跟隨電腦設定']];
const applyTheme = (t) => { const r = document.documentElement; if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); };
function SettingsMenu({ S }) {
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(() => lsGet('theme') || 'light');
  const setTheme = (t) => { setThemeState(t); lsSet('theme', t); applyTheme(t); };
  const wd = !!S.settings.workdays;
  const opt = (v, t, sub) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 4px', cursor: S.canAdmin ? 'pointer' : 'default', fontSize: 13 }}>
      <input type="radio" name="wd" checked={wd === v} disabled={!S.canAdmin} onChange={() => S.setSetting({ workdays: v })} style={{ marginTop: 3 }} />
      <span>{t}<div style={{ fontSize: 11, color: V.muted2 }}>{sub}</div></span>
    </label>
  );
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} title="設定" style={{ ...FSEL, height: 28 }}>⚙ 設定</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'absolute', top: 34, right: 0, width: 280, zIndex: 30, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>預計天數怎麼算（全體共用{S.canAdmin ? '' : '，只有管理員能改'}）</div>
            {opt(false, '日曆天', '含週末，從截止日往回推')}
            {opt(true, '只算工作天', '跳過週六、週日，從截止日往回推')}
            <div style={{ fontSize: 12, fontWeight: 500, margin: '10px 0 6px', paddingTop: 10, borderTop: `1px solid ${V.line}` }}>外觀（只影響這台電腦）</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {THEMES.map(([k, l]) => <button key={k} onClick={() => setTheme(k)} style={{ ...FSEL, flex: 1, height: 28, ...(theme === k ? FON : null) }}>{l}</button>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   帳號：登入／註冊／待核准／帳號管理（Supabase Auth）
   ============================================================ */
const ROLE_LABEL = { viewer: '只能看', engineer: '工程師', planner: 'Planner', admin: '管理員' };
const ROLE_HINT = { viewer: '全部只能看', engineer: '改工程清單、進度紀錄；生產排程只能看', planner: '改機台生產排程；工程清單只能看', admin: '全部都能改，含帳號、成員、機台、設定' };
const authErr = (e) => {
  const m = (e && e.message) || '';
  if (/Invalid login credentials/i.test(m)) return 'email 或密碼錯誤。';
  if (/Email not confirmed/i.test(m)) return '這個帳號還沒完成 email 確認。請管理員到 Supabase 關閉「Confirm email」，或在後台手動確認這個帳號。';
  if (/already registered|already exists/i.test(m)) return '這個 email 已經註冊過了，請直接登入。';
  if (/Password should be at least/i.test(m)) return '密碼至少要 6 個字元。';
  if (/rate limit/i.test(m)) return '嘗試太多次，請過幾分鐘再試。';
  if (/fetch|network/i.test(m)) return '連不到伺服器，請檢查網路。';
  return m || '發生錯誤，請再試一次。';
};
function AuthShell({ children }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 16, overflow: 'auto' }}>
      <div style={{ width: 380, maxWidth: '100%', ...card, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>團隊工程清單與排程</div>
        {children}
      </div>
    </div>
  );
}
function AuthPage({ sb }) {
  const [tab, setTab] = useState('in');
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [name, setName] = useState('');
  const [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (tab === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else {
        if (!name.trim()) throw { message: '請填顯示名稱' };
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: '註冊成功。這個 Supabase 專案有開啟 email 確認，請先到信箱點確認連結再登入。' });
      }
    } catch (err) { setMsg({ ok: false, text: authErr(err) }); }
    setBusy(false);
  };
  const tb = (k, l) => <button type="button" onClick={() => { setTab(k); setMsg(null); }} style={{ ...FSEL, flex: 1, height: 34, fontSize: 13, ...(tab === k ? FON : null) }}>{l}</button>;
  return (
    <AuthShell>
      <div style={{ display: 'flex', gap: 6 }}>{tb('in', '登入')}{tb('up', '註冊新帳號')}</div>
      <form onSubmit={go} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'up' && (
          <label style={lbl}>顯示名稱<input value={name} onChange={(e) => setName(e.target.value)} placeholder="建議跟團隊成員名稱相同" style={fld} /></label>
        )}
        <label style={lbl}>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={fld} /></label>
        <label style={lbl}>密碼<input type="password" autoComplete={tab === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} style={fld} /></label>
        {tab === 'up' && <div style={{ fontSize: 11.5, color: V.muted2, lineHeight: 1.6 }}>請不要用公司電腦的開機密碼。註冊後要等管理員核准才看得到資料。</div>}
        {msg && <div style={{ fontSize: 12.5, lineHeight: 1.6, color: msg.ok ? 'oklch(0.45 0.1 155)' : OVER }}>{msg.text}</div>}
        <button type="submit" disabled={busy} className="btn-dark" style={{ ...darkBtn, height: 36, opacity: busy ? 0.6 : 1 }}>{busy ? '處理中…' : tab === 'in' ? '登入' : '註冊'}</button>
      </form>
      {tab === 'in' && <div style={{ fontSize: 11.5, color: V.muted2 }}>忘記密碼請聯絡管理員。</div>}
    </AuthShell>
  );
}
const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: V.muted };
function PendingPage({ sb, profile }) {
  const st = profile.role === 'none' ? 'none' : profile.status;
  const msg = {
    pending: { title: '帳號尚未核准', body: '你的帳號已經註冊，正在等待管理員核准。核准後這個頁面會自動進入，不用重新登入。', fg: SOON.fg },
    disabled: { title: '帳號已被停用', body: '這個帳號目前無法使用。如果需要恢復，請聯絡管理員。', fg: OVER },
    none: { title: '找不到帳號資料', body: '這個帳號可能已被刪除。如果需要使用，請聯絡管理員。', fg: OVER },
  }[st] || { title: '帳號無法使用', body: '請聯絡管理員。', fg: OVER };
  return (
    <AuthShell>
      <div style={{ fontSize: 16, fontWeight: 700, color: msg.fg }}>{msg.title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{profile.name && <>你好，<b>{profile.name}</b>。</>}{msg.body}</div>
      <div style={{ fontSize: 12, color: V.muted2 }}>{profile.email}</div>
      <button onClick={() => sb.auth.signOut()} style={lineBtn}>登出</button>
    </AuthShell>
  );
}
function useProfiles(sb, on) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!sb || !on) return;
    let alive = true;
    const load = () => sb.from('profiles').select('*').order('created_at').then(({ data }) => { if (alive && data) setList(data); });
    load();
    const ch = sb.channel('rt-profiles-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load).subscribe();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); sb.removeChannel(ch); };
  }, [sb, on]);
  return [list, setList];
}
const STATUS_LABEL = { pending: '待核准', active: '使用中', disabled: '已停用' };
const STATUS_TONE = { pending: [SOON.bg, SOON.fg], active: ['oklch(0.94 0.04 155)', 'oklch(0.4 0.1 155)'], disabled: ['oklch(0.93 0.01 80)', 'oklch(0.45 0.01 80)'] };
const dbErr = (e) => {
  const m = (e && e.message) || '';
  if (/至少要保留/.test(m)) return '至少要保留一位管理員。';
  if (/最高管理員/.test(m)) return m.replace(/^.*?(最高管理員)/, '$1') + '。';
  if (/只有最高管理員/.test(m)) return '只有最高管理員可以刪除帳號。';
  return m || '未知原因';
};
function AccountRow({ p, S, sb, isMe, canDelete, onErr, reload, G }) {
  const [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  const upd = async (patch) => {
    onErr('');
    const { error } = await sb.from('profiles').update(patch).eq('id', p.id);
    if (error) onErr(dbErr(error)); else { reload(); setTimeout(() => S.refresh(), 300); }
  };
  const setName = async (name) => { const n = name.trim(); if (n && n !== p.name) await upd({ name: n }); };
  const del = async () => {
    setBusy(true); onErr('');
    const { error } = await sb.rpc('delete_account', { target: p.id, remove_member: true });
    setBusy(false); setAsk(false);
    if (error) onErr('刪除失敗：' + dbErr(error)); else { reload(); setTimeout(() => S.refresh(), 300); S.say(`已刪除帳號「${p.name}」`); }
  };
  const m = S.members.find((x) => x.profileId === p.id);
  const free = S.members.filter((x) => !x.profileId);
  const [tBg, tFg] = STATUS_TONE[p.status] || STATUS_TONE.pending;
  const sbtn = (label, onClick, tone) => <button onClick={onClick} style={{ ...FSEL, height: 28, ...(tone === 'go' ? { background: 'oklch(0.5 0.12 155)', borderColor: 'oklch(0.5 0.12 155)', color: '#fff' } : tone === 'stop' ? { color: OVER, borderColor: 'oklch(0.8 0.08 25)' } : null) }}>{label}</button>;
  return (
    <div style={{ borderBottom: `1px solid ${V.line}`, background: p.status === 'pending' ? SOON.bg : p.status === 'disabled' ? V.tint : undefined }}>
      <div style={{ display: 'grid', gridTemplateColumns: G, gap: 10, padding: '8px 16px', alignItems: 'center', opacity: p.status === 'disabled' ? 0.75 : 1 }}>
        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {p.is_owner ? <span style={{ fontSize: 11, color: V.faint }}>—</span> : (
            <>
              {p.status === 'pending' && sbtn('核准', () => upd({ status: 'active' }), 'go')}
              {p.status === 'active' && !isMe && sbtn('停用', () => upd({ status: 'disabled' }), 'stop')}
              {p.status === 'disabled' && sbtn('恢復', () => upd({ status: 'active' }), 'go')}
              {canDelete && !isMe && !ask && <button className="del" onClick={() => setAsk(true)} title="永久刪除這個登入帳號（只有最高管理員能做）" style={{ ...FSEL, height: 28, color: V.muted2 }}>刪除</button>}
            </>
          )}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <CellText className="cin" value={p.name} onCommit={setName} style={cin({ fontWeight: 500 })} />
          {p.is_owner && <span title="最高管理員：唯一可以刪除帳號的人，不能被降級或停用" style={{ flex: 'none', fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: 'oklch(0.93 0.05 85)', color: 'oklch(0.45 0.1 70)' }}>★ 最高管理員</span>}
        </span>
        <span style={{ fontSize: 12, color: V.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}{isMe ? '（你）' : ''}</span>
        <span style={{ justifySelf: 'start', fontSize: 11.5, padding: '2px 9px', borderRadius: 10, background: tBg, color: tFg, fontWeight: 500 }}>{STATUS_LABEL[p.status] || p.status}</span>
        <select value={p.role} disabled={p.is_owner} onChange={(e) => upd({ role: e.target.value })} title={p.status === 'pending' ? '核准時會給這個權限' : ''} style={{ ...FSEL, height: 30 }}>
          {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          {!ROLE_LABEL[p.role] && <option value={p.role}>{p.role}</option>}
        </select>
        {m ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'oklch(0.45 0.1 155)', minWidth: 0 }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✓ {m.name}<span style={{ color: V.muted2, marginLeft: 6 }}>{TEAM_LABEL[m.team] || ''}組</span></span>
            {free.length > 0 && (
              <select value="" title="連錯人了？改連到清單裡的另一位成員（原本自動建立、沒有資料的成員會刪掉）" onChange={(e) => e.target.value && S.linkMember(p.id, e.target.value).then((ok) => ok && reload())} style={{ ...FSEL, height: 26, fontSize: 11, color: V.muted2, maxWidth: 80 }}>
                <option value="">改連到…</option>
                {free.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
          </span>
        ) : (
          <select value="" onChange={(e) => e.target.value && S.linkMember(p.id, e.target.value).then((ok) => ok && reload())} style={{ ...FSEL, height: 30, color: V.muted }}>
            <option value="">{p.status === 'active' && p.role !== 'viewer' ? '（未連結）連結到既有成員…' : p.role === 'viewer' ? '只能看：不加入成員清單' : '核准後自動加入；或先連結到…'}</option>
            {free.map((x) => <option key={x.id} value={x.id}>{x.name}（{TEAM_LABEL[x.team] || '工程師'}）</option>)}
          </select>
        )}
        <span style={{ fontFamily: MONO, fontSize: 11, color: V.muted2, textAlign: 'right' }}>{(p.created_at || '').slice(0, 16).replace('T', ' ')}</span>
      </div>
      {ask && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 16px 10px', background: 'oklch(0.97 0.02 25)', borderTop: `1px dashed oklch(0.85 0.06 25)`, fontSize: 12.5 }}>
          <span style={{ color: OVER, fontWeight: 500 }}>確定要永久刪除「{p.name}」（{p.email}）的帳號？</span>
          <span style={{ color: V.muted }}>刪除後無法登入、無法復原，也會從成員清單移除；他負責的工作會保留，並在工程清單顯示「負責人已不在清單」提醒改派。</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setAsk(false)} style={{ ...lineBtn, height: 28, fontSize: 12 }}>取消</button>
            <button onClick={del} disabled={busy} style={{ ...darkBtn, height: 28, fontSize: 12, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>{busy ? '刪除中…' : '確定刪除'}</button>
          </span>
        </div>
      )}
    </div>
  );
}
function AccountsPage({ sb, S, profiles, reload }) {
  const [err, setErr] = useState('');
  const order = { pending: 0, active: 1, disabled: 2 };
  const sorted = [...profiles].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (b.is_owner ? 1 : 0) - (a.is_owner ? 1 : 0) || (a.created_at || '').localeCompare(b.created_at || ''));
  const G = '150px minmax(0,1.3fr) minmax(0,1.2fr) 78px 120px minmax(0,1.3fr) 118px';
  const cnt = (s) => profiles.filter((p) => p.status === s).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: V.muted, lineHeight: 1.75 }}>
        同事在登入頁「註冊新帳號」後會出現在最上面（待核准）。先選好<b>權限</b>，再按<b>核准</b>。要暫停某人使用請按<b>停用</b>，之後按<b>恢復</b>即可回到原本的權限。<br />
        {Object.entries(ROLE_LABEL).map(([k, l]) => <span key={k} style={{ marginRight: 14 }}><b>{l}</b>：{ROLE_HINT[k]}</span>)}<br />
        核准為工程師、Planner 或管理員後，會自動加入團隊成員（工程師／管理員 → 工程師組，Planner → Planner 組）；清單裡已有這個人時，請在「對應團隊成員」選他。在這裡改名稱，Owner、紀錄人、更新者都會一起改。<br />
        <b>停用</b>或<b>刪除</b>的帳號會從成員清單移除；他負責的工作會保留，並在工程清單顯示「⚠ 負責人已不在清單」提醒改派（恢復帳號後會自動回到清單）。<b>刪除帳號</b>只有 ★ 最高管理員能操作。
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: V.muted2 }}>
        <span>待核准 <b style={{ color: cnt('pending') ? SOON.fg : 'inherit' }}>{cnt('pending')}</b></span><span>使用中 <b>{cnt('active')}</b></span><span>已停用 <b>{cnt('disabled')}</b></span>
      </div>
      {err && <div style={{ fontSize: 13, color: OVER }}>{err}</div>}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: G, gap: 10, padding: '8px 16px', fontSize: 11, color: V.muted2, background: V.tint, borderBottom: `1px solid ${V.line}` }}>
          <span>操作</span><span>顯示名稱</span><span>Email</span><span>狀態</span><span>權限</span><span>對應團隊成員</span><span style={{ textAlign: 'right' }}>註冊時間</span>
        </div>
        {sorted.map((p) => <AccountRow key={p.id} p={p} S={S} sb={sb} G={G} isMe={p.id === S.profile.id} canDelete={!!S.profile.is_owner} onErr={setErr} reload={reload} />)}
        {sorted.length === 0 && <div style={{ padding: 20, fontSize: 13, color: V.muted2 }}>讀取中…</div>}
      </div>
    </div>
  );
}
function UserMenu({ sb, S }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...FSEL, height: 30, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Avatar name={S.me || '?'} size={20} />{S.me}<span style={{ fontSize: 10.5, color: V.muted2 }}>{S.profile.is_owner ? '★ 最高管理員' : ROLE_LABEL[S.role] || S.profile.role}</span>▾
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'absolute', top: 36, right: 0, width: 220, zIndex: 30, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', padding: 6, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 10px', fontSize: 11.5, color: V.muted2 }}>{S.profile.email}</div>
            <div style={{ padding: '2px 10px 6px', fontSize: 11, color: V.faint }}>顯示名稱由管理員在「帳號管理」修改</div>
            <button className="member-item" onClick={() => sb.auth.signOut()} style={menuItem}>登出</button>
          </div>
        </>
      )}
    </div>
  );
}
const menuItem = { textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer' };

function RootSB() {
  const sb = sbClient;
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  const uidv = session && session.user.id;
  useEffect(() => {
    if (!uidv) { setProfile(session === null ? null : undefined); return; }
    setProfile(undefined);
    let alive = true;
    const load = () => sb.from('profiles').select('*').eq('id', uidv).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error) setProfile((p) => p || { role: 'none', name: '', email: session.user.email });
      else setProfile(data || { role: 'none', name: '', email: session.user.email });
    });
    load();
    const ch = sb.channel('rt-me').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uidv}` }, load).subscribe();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); sb.removeChannel(ch); };
  }, [uidv]);
  if (session === undefined || (session && !profile)) return <AuthShell><div style={{ fontSize: 13, color: V.muted2 }}>連線中…</div></AuthShell>;
  if (!session) return <AuthPage sb={sb} />;
  const active = profile.status ? profile.status === 'active' : ['viewer', 'engineer', 'planner', 'editor', 'admin'].includes(profile.role);
  if (!active || profile.role === 'none') return <PendingPage sb={sb} profile={profile} />;
  return <App sb={sb} profile={profile} />;
}

function App({ sb = null, profile = null }) {
  const S = useStore(sb, profile);
  const isAdmin = !!profile && profile.role === 'admin';
  const [profiles, setProfilesList] = useProfiles(sb, isAdmin);
  const reloadProfiles = () => sb.from('profiles').select('*').order('created_at').then(({ data }) => data && setProfilesList(data));
  const pendingN = profiles.filter((p) => p.status === 'pending').length;
  const [view, setView] = useState('overview');
  useEffect(() => { if (view === 'accounts' && isAdmin) reloadProfiles(); }, [view]);
  const [picked, setPicked] = useState({});
  const [eview, setEview] = useState('list');
  const [logRowId, setLogRowId] = useState(null);
  const closeLogs = useCallback(() => setLogRowId(null), []);
  const logRow = logRowId && S.rows.find((r) => r.id === logRowId);
  const D = useMemo(() => derive(S.rows, S.owners, S.settings), [S.rows, S.owners, S.settings]);
  // 最後更新：工程清單、生產排程、進度紀錄、附件裡最新的一筆
  const last = useMemo(() => {
    let best = { t: '', who: '', what: '' };
    const see = (t, who, what) => { if (t && t > best.t) best = { t, who: who || '', what }; };
    S.rows.forEach((r) => see(r.updated, r.updatedBy, '工程清單'));
    S.plans.forEach((p) => see(p.updated, p.updatedBy, '生產排程'));
    S.logs.forEach((l) => { see(l.created, l.author, '進度紀錄'); see(l.updated, l.author, '進度紀錄'); });
    S.filesByRow.forEach((fs) => fs.forEach((f) => see(f.created, '', '附件')));
    return best;
  }, [S.rows, S.plans, S.logs, S.filesByRow]);
  const tabs = [['overview', '總覽'], ['daily', '每日'], ['combo', '複合排程'], ['list', '工程清單'], ['plan', '生產排程'], ['board', '卡片看板'], ...(isAdmin ? [['accounts', '帳號管理']] : [])];
  const badge =
    S.mode === 'connecting' ? ['連線中…', V.muted2] :
    S.readOnly ? ['唯讀（可瀏覽，無法修改）', 'oklch(0.55 0.12 70)'] :
    S.mode === 'sb' ? (S.live ? ['● 線上共用・即時同步', 'oklch(0.55 0.11 155)'] : ['● 線上共用・每 20 秒更新', 'oklch(0.55 0.1 120)']) :
    ['僅存在這台裝置（未連線）', 'oklch(0.55 0.12 70)'];
  const noData = S.rows.length === 0;
  const meOpts = S.me && !S.owners.includes(S.me) ? [...S.owners, S.me] : S.owners;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 1100 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px', height: 60, background: V.surface2, borderBottom: `1px solid ${V.line}`, flex: 'none' }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>團隊工程清單與排程{!sb && <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5, background: V.todayBg, color: 'var(--accent)' }}>本機試用</span>}</h1>
        <nav style={{ display: 'flex', gap: 2, height: '100%' }}>
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ height: '100%', padding: '0 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', borderBottom: `2px solid ${view === k ? V.ink : 'transparent'}`, color: view === k ? V.ink : V.muted, fontWeight: view === k ? 500 : 400 }}>{label}{k === 'accounts' && pendingN > 0 && <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 9, background: SOON.bd, color: '#fff' }}>{pendingN}</span>}</button>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {sb ? <UserMenu sb={sb} S={S} /> : <label title="選你自己，修改紀錄與「只看我的」會用這個名字（記在這台瀏覽器）" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.muted }}>
            我是
            <select value={S.me} onChange={(e) => S.setMe(e.target.value)} style={{ ...FSEL, height: 28, ...(S.me ? null : { borderColor: 'oklch(0.66 0.15 60)', color: 'oklch(0.5 0.13 55)' }) }}>
              <option value="">（請選擇）</option>
              {meOpts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>}
          <SettingsMenu S={S} />
          <span style={{ fontSize: 12, color: badge[1], whiteSpace: 'nowrap' }}>{badge[0]}</span>
          <span title={last.t ? `最後一筆修改：${last.what}${last.who ? '・' + last.who : ''}（${last.t}）` : '還沒有任何修改'} style={{ fontSize: 11, color: V.muted2, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', lineHeight: 1.25, alignItems: 'flex-end' }}>
            <span>最後更新 <span style={{ fontFamily: MONO }}>{last.t ? last.t.slice(5) : '—'}</span></span>
            {last.t && <span style={{ fontSize: 10.5, color: V.faint }}>{last.what}{last.who ? '・' + last.who : ''}</span>}
          </span>
        </div>
      </header>

      {view === 'list' ? (
        <WorklistPage S={S} D={D} picked={picked} setPicked={setPicked} eview={eview} setEview={setEview} openLogs={setLogRowId} />
      ) : view === 'plan' ? (
        <PlanPage S={S} />
      ) : view === 'combo' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}><ComboPage S={S} D={D} /></div>
      ) : view === 'accounts' && isAdmin ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}><AccountsPage sb={sb} S={S} profiles={profiles} reload={reloadProfiles} /></div>
      ) : view === 'daily' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}><DailyPage S={S} D={D} openLogs={setLogRowId} /></div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {noData ? (
            <div style={{ background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10, padding: 48, textAlign: 'center', fontSize: 14, color: V.muted2 }}>
              工程清單中還沒有資料。<a href="#" onClick={(e) => { e.preventDefault(); setView('list'); }}>前往新增</a>
            </div>
          ) : view === 'overview' ? (
            <Overview D={D} S={S} goGantt={(n) => { setPicked({ [n]: true }); setEview('gantt'); setView('list'); }} />
          ) : (
            <Board D={D} S={S} openLogs={setLogRowId} />
          )}
        </div>
      )}

      {logRow && <LogDrawer key={logRow.id} row={logRow} S={S} ro={!S.canEdit} onClose={closeLogs} />}
      {S.notice && (
        <div style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', background: V.btnBg, color: V.btnFg, padding: '8px 10px 8px 16px', borderRadius: 8, fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 60, display: 'flex', alignItems: 'center', gap: 12, maxWidth: '80vw' }}>
          <span>{S.notice.text}</span>
          {S.notice.action && <button onClick={S.notice.action.run} style={{ border: `1px solid ${V.btnFg}`, background: 'transparent', color: V.btnFg, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{S.notice.action.label}</button>}
          <button onClick={S.clearNotice} title="關閉" style={{ border: 'none', background: 'transparent', color: V.btnFg, cursor: 'pointer', fontSize: 15, opacity: 0.7 }}>×</button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(sbClient ? <RootSB /> : <App />);
