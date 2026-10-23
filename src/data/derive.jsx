import React, { useState } from 'react';
import { MONO, OVER, QUIET, SOON, STBG, STC, STTX, UN, V } from '../lib/theme';
import { addD, diff, isOff, md, s2d } from '../lib/util';
import { lineBtn } from '../ui/common';

/* ============================================================
   共用：資料衍生（儀表板用）
   ============================================================ */
// B9：從截止日往回推開始日；workdays=true 時跳過週末與國定假日（補班日算工作天）
function backDays(due, n, workdays) {
  if (!workdays) return addD(due, -(n - 1));
  let d = new Date(due), left = n - 1;
  while (left > 0) { d = addD(d, -1); if (!isOff(d)) left--; }
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

export { backDays, derive, SOON_DAYS, dueInfo, barTone, RANGE_BACK, RANGE_STEP, RANGES, useRange, clip, RangeBar };
