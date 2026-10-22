import React, { useState } from 'react';
import { MONO, OVER, V } from '../lib/theme';
import { FSEL, darkBtn, fld, lineBtn } from './common';

/* ============================================================
   A6：客戶分頁（工程清單、生產排程共用）
   ============================================================ */
const NO_TAB = '__none__';   // 不屬於任何看得到的分頁（舊版網頁新增的、或分頁被刪掉）
// 只取目前分頁的資料；新增時自動帶入目前分頁
function scopeStore(S, tab, part) {
  if (!tab) return S;
  const known = new Set(S.customers.map((c) => c.id));
  const inTab = (x) => (tab === NO_TAB ? !known.has(x.customer) : x.customer === tab);
  const val = tab === NO_TAB ? '' : tab;
  const o = { ...S, tab };
  if (part === 'rows') { o.rows = S.rows.filter(inTab); o.add = (extra) => S.add({ customer: val, ...extra }); }
  if (part === 'plans') o.plans = S.plans.filter(inTab);
  o.addPlan = (m, copy, extra) => S.addPlan(m, copy, { customer: copy && copy.customer ? copy.customer : val, ...extra });
  return o;
}
const tabName = (S, id) => (S.customers.find((c) => c.id === id) || {}).name || '未分類';
function TabMove({ S, cur, onMove, disabled }) {
  const others = S.customers.filter((c) => c.id !== cur);
  if (!others.length) return null;
  return (
    <select value="" disabled={disabled} title="移到其他分頁" onChange={(e) => e.target.value && onMove(e.target.value)}
      style={{ width: 22, height: 22, padding: 0, border: 'none', background: 'transparent', color: V.faint, cursor: disabled ? 'default' : 'pointer', fontSize: 12, appearance: 'none', WebkitAppearance: 'none', textAlign: 'center' }}>
      <option value="">⇄</option>
      <option value="" disabled>移到其他分頁：</option>
      {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}
const tabBtn = (on) => ({ height: 30, padding: '0 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${on ? V.btnBg : V.line2}`, background: on ? V.btnBg : V.surface, color: on ? V.btnFg : V.ink2, fontWeight: on ? 600 : 400 });
function TabBar({ S, tab, setTab, keys, count }) {
  const [adding, setAdding] = useState(false), [nv, setNv] = useState(''), [renaming, setRenaming] = useState(false);
  const admin = S.canAdmin;
  const cur = S.customers.find((c) => c.id === tab);
  const add = async () => { const id = await S.addTab(nv); setNv(''); setAdding(false); if (id) setTab(id); };
  const mini = { ...FSEL, height: 26, padding: '0 7px', fontSize: 12 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 24px', background: V.surface, borderBottom: `1px solid ${V.line}`, flex: 'none' }}>
      <span style={{ fontSize: 12, color: V.muted2, marginRight: 4 }}>{S.isCust ? '客戶' : '分頁'}</span>
      {keys.map((k) => {
        const c = S.customers.find((x) => x.id === k);
        const n = count(k);
        return (
          <button key={k} onClick={() => setTab(k)} style={{ ...tabBtn(tab === k), ...(k === NO_TAB ? { borderStyle: 'dashed', color: tab === k ? V.btnFg : OVER } : null) }}>
            {c ? c.name : '⚠ 未分類'}
            {c && c.internal && <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 4, background: tab === k ? 'rgba(255,255,255,0.2)' : V.tint, color: tab === k ? V.btnFg : V.muted2 }} title="內部分頁：客戶帳號看不到">內部</span>}
            {!S.isCust && <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7 }}>{n}</span>}
          </button>
        );
      })}
      {admin && cur && !renaming && (
        <span style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
          <button onClick={() => setRenaming(true)} title="改名" style={mini}>✎</button>
          <button onClick={() => S.shiftTab(cur.id, -1)} title="往左移" style={mini}>◀</button>
          <button onClick={() => S.shiftTab(cur.id, 1)} title="往右移" style={mini}>▶</button>
          <button onClick={() => S.delTab(cur.id)} title="刪除這個分頁（裡面要沒有資料）" style={{ ...mini, color: V.muted2 }}>刪除</button>
        </span>
      )}
      {admin && cur && renaming && (
        <form onSubmit={(e) => { e.preventDefault(); S.renameTab(cur.id, e.target.elements.n.value); setRenaming(false); }} style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
          <input name="n" defaultValue={cur.name} autoFocus maxLength={40} style={{ ...fld, height: 28, width: 140 }} />
          <button type="submit" style={{ ...darkBtn, height: 28, fontSize: 12 }}>儲存</button>
          <button type="button" onClick={() => setRenaming(false)} style={{ ...lineBtn, height: 28, fontSize: 12 }}>取消</button>
        </form>
      )}
      {admin && (adding ? (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <input value={nv} onChange={(e) => setNv(e.target.value)} autoFocus maxLength={40} placeholder="客戶名稱" style={{ ...fld, height: 28, width: 140 }} />
          <button type="submit" disabled={!nv.trim()} style={{ ...darkBtn, height: 28, fontSize: 12, opacity: nv.trim() ? 1 : 0.5 }}>新增</button>
          <button type="button" onClick={() => setAdding(false)} style={{ ...lineBtn, height: 28, fontSize: 12 }}>取消</button>
        </form>
      ) : <button onClick={() => setAdding(true)} style={{ ...mini, marginLeft: 'auto' }}>＋ 新增分頁</button>)}
    </div>
  );
}
// 客戶帳號看得到的欄位（工程清單 HEADS／生產排程 PHEADS 的索引）
const CUST_ENG_COLS = new Set([1, 2, 3, 4, 5, 6, 9]);
const CUST_PLAN_COLS = new Set([0, 1, 2, 4, 5, 6]);
const visCols = (S, cols, set) => (S.isCust ? cols.filter((_, i) => set.has(i)) : cols);

export { NO_TAB, scopeStore, tabName, TabMove, tabBtn, TabBar, CUST_ENG_COLS, CUST_PLAN_COLS, visCols };
