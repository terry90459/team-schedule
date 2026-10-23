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
export { NO_TAB, scopeStore, tabName, TabAdmin };
