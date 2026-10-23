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
const OVER = 'var(--over)';   // 逾期紅：淺色／深色主題各有一組（build.mjs）

// 色票 → CSS 變數（淺色／深色主題由 CSS 切換）
const V = {
  bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface2)', tint: 'var(--tint)',
  line: 'var(--line)', line2: 'var(--line2)', line3: 'var(--line3)',
  ink: 'var(--ink)', ink2: 'var(--ink2)', muted: 'var(--muted)', muted2: 'var(--muted2)', faint: 'var(--faint)',
  head: 'var(--head)', btnBg: 'var(--btnBg)', btnFg: 'var(--btnFg)',
  todayBg: 'var(--todayBg)', todayHead: 'var(--todayHead)', accent: 'var(--accent)',
  holHead: 'var(--holHead)', holFg: 'var(--holFg)', holBody: 'var(--holBody)',
};
const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";



const SOON = { bd: 'oklch(0.66 0.15 60)', bg: 'oklch(0.95 0.05 75)', fg: 'oklch(0.5 0.13 55)' };

export { STATUS, QUIET, ST, STC, STBG, STTX, PRIO, PR, PRBAR, WD, UN, OVER, V, MONO, SOON };
