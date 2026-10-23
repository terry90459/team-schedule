import React, { useState } from 'react';
import { MONO, OVER, V } from '../lib/theme';


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
// 工程清單、生產排程上方的分頁列（只負責切換；新增／改名／排序／刪除在「⚙ 管理 → 客戶分頁」）
function TabBar({ S, tab, setTab, keys, count }) {
  return (
    <div className="scope" role="tablist" aria-label={S.isCust ? '客戶' : '客戶分頁'}>
      <span className="lab">{S.isCust ? '客戶' : '客戶'}</span>
      {keys.map((k) => {
        const c = S.customers.find((x) => x.id === k);
        return (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} style={k === NO_TAB ? { color: OVER } : null}>
            {c ? c.name : '⚠ 未分類'}
            {c && c.internal && <span title="內部分頁：客戶帳號看不到" style={{ fontSize: 10, padding: '0 5px', borderRadius: 4, background: V.tint, color: V.muted2, fontWeight: 400 }}>內部</span>}
            {!S.isCust && <span className="n">{count(k)}</span>}
          </button>
        );
      })}
    </div>
  );
}
// ⚙ 管理 → 客戶分頁：新增、改名、排序、刪除（空的才能刪）
function TabAdmin({ S }) {
  const [nv, setNv] = useState(''), [edit, setEdit] = useState(null);
  const add = async () => { if (!nv.trim()) return; await S.addTab(nv); setNv(''); };
  const cnt = (id) => S.rows.filter((r) => r.customer === id).length + S.plans.filter((p) => p.customer === id).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 }}>
      {S.customers.map((c, i) => (
        <div key={c.id} className="member-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
          {edit === c.id ? (
            <form onSubmit={(e) => { e.preventDefault(); S.renameTab(c.id, e.target.elements.n.value); setEdit(null); }} style={{ display: 'flex', gap: 6, flex: 1 }}>
              <input name="n" className="field" defaultValue={c.name} autoFocus maxLength={40} style={{ flex: 1, height: 28 }} onKeyDown={(e) => { if (e.key === 'Escape') setEdit(null); }} />
              <button type="submit" className="btn btn-sm btn-primary">儲存</button>
              <button type="button" className="btn btn-sm" onClick={() => setEdit(null)}>取消</button>
            </form>
          ) : (
            <>
              <span style={{ flex: 1, minWidth: 0 }}>{c.name}{c.internal && <span style={{ marginLeft: 6, fontSize: 10.5, padding: '0 5px', borderRadius: 4, background: V.tint, color: V.muted2 }}>內部</span>}</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{cnt(c.id)} 筆</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setEdit(c.id)} title="改名" aria-label={`把「${c.name}」改名`}>✎</button>
              <button className="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => S.shiftTab(c.id, -1)} title="往前移" aria-label={`把「${c.name}」往前移`}>▲</button>
              <button className="btn btn-sm btn-ghost" disabled={i === S.customers.length - 1} onClick={() => S.shiftTab(c.id, 1)} title="往後移" aria-label={`把「${c.name}」往後移`}>▼</button>
              <button className="btn btn-sm btn-ghost" disabled={cnt(c.id) > 0} onClick={() => S.delTab(c.id)} title={cnt(c.id) ? '裡面還有資料，要先移走或刪除才能刪分頁' : '刪除這個分頁'} aria-label={`刪除「${c.name}」`}>×</button>
            </>
          )}
        </div>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: `1px solid ${V.line}` }}>
        <input className="field" value={nv} onChange={(e) => setNv(e.target.value)} maxLength={40} placeholder="新客戶名稱" style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primary" disabled={!nv.trim()}>＋ 新增分頁</button>
      </form>
    </div>
  );
}
// 客戶帳號看得到的欄位（工程清單 HEADS／生產排程 PHEADS 的索引）；7＝預計天數（v4 起開放）
const CUST_ENG_COLS = new Set([1, 2, 3, 4, 5, 6, 7, 9]);
const CUST_PLAN_COLS = new Set([0, 1, 2, 4, 5, 6]);
const visCols = (S, cols, set) => (S.isCust ? cols.filter((_, i) => set.has(i)) : cols);

export { NO_TAB, scopeStore, tabName, TabMove, tabBtn, TabBar, TabAdmin, CUST_ENG_COLS, CUST_PLAN_COLS, visCols };
