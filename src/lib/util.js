import { UN } from './theme';

/* ============================================================
   小工具
   ============================================================ */
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const s2d = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diff = (a, b) => Math.round((a - b) / 86400000);


const byName = (a, b) => String(a).localeCompare(String(b), 'zh-Hant-TW', { numeric: true, sensitivity: 'base' });
const sortRows = (l) => [...l].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || (a.id < b.id ? -1 : 1));
const uniqNames = (l) => [...new Set(l.map((x) => (x.name || '').trim()).filter(Boolean))];
const strip = ({ id, ...body }) => body;
const dstr = (d) => stamp(d).slice(0, 10);
const todayStr = () => stamp().slice(0, 10);
const validPlan = (p) => p.start && p.end && s2d(p.end) >= s2d(p.start);
const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } };
/* ============================================================
   台灣放假日（行政院人事行政總處「政府行政機關辦公日曆表」）
   每年 6 月左右公布隔年日曆，請把隔年的日期加進來（TW_WORK = 補行上班的週六）
   ============================================================ */
const TW_OFF = {
  '2026-01-01': '開國紀念日', '2026-02-15': '小年夜', '2026-02-16': '農曆除夕', '2026-02-17': '春節',
  '2026-02-18': '春節', '2026-02-19': '春節', '2026-02-20': '補假', '2026-02-27': '補假',
  '2026-02-28': '和平紀念日', '2026-04-03': '補假', '2026-04-04': '兒童節', '2026-04-05': '清明節',
  '2026-04-06': '補假', '2026-05-01': '勞動節', '2026-06-19': '端午節', '2026-09-25': '中秋節',
  '2026-09-28': '教師節', '2026-10-09': '補假', '2026-10-10': '國慶日', '2026-10-25': '光復節',
  '2026-10-26': '補假', '2026-12-25': '行憲紀念日', '2027-01-01': '開國紀念日', '2027-02-04': '小年夜',
  '2027-02-05': '農曆除夕', '2027-02-06': '春節', '2027-02-07': '春節', '2027-02-08': '春節',
  '2027-02-09': '補假', '2027-02-10': '補假', '2027-02-28': '和平紀念日', '2027-03-01': '補假',
  '2027-04-04': '兒童節', '2027-04-05': '清明節', '2027-04-06': '補假', '2027-04-30': '補假',
  '2027-05-01': '勞動節', '2027-06-09': '端午節', '2027-09-15': '中秋節', '2027-09-28': '教師節',
  '2027-10-10': '國慶日', '2027-10-11': '補假', '2027-10-25': '光復節', '2027-12-24': '補假',
  '2027-12-25': '行憲紀念日', '2027-12-31': '補假',
};
const TW_WORK = new Set([]);
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
// 放假日：週末（補班日除外）＋國定假日、補假
const isOff = (d) => { const k = ymd(d); return TW_WORK.has(k) ? false : isWeekend(d) || k in TW_OFF; };
const holName = (d) => TW_OFF[ymd(d)] || (TW_WORK.has(ymd(d)) ? '補班' : '');
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

export { pad, stamp, s2d, addD, diff, byName, sortRows, uniqNames, strip, dstr, todayStr, validPlan, md, copyText, TW_OFF, TW_WORK, ymd, isWeekend, isOff, holName, hue, av, lsGet, lsSet, uid, SEED };
