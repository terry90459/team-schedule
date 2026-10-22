import React, { useState } from 'react';
import { MONO, V } from '../lib/theme';
import { byName } from '../lib/util';
import { HintBar, darkBtn, gridOf, lineBtn, useCols } from '../ui/common';
import { MemberPanel } from '../worklist/members';
import { CUST_PLAN_COLS, tabBtn, visCols } from '../ui/tabs';
import { PGMIN, PGRID, PHEADS, PlanRow } from './PlanRow';
import { PlanTimeline } from './timeline';

/* 機台生產排程頁 */
function PlanPage({ S }) {
  const [showPM, setShowPM] = useState(false);
  const ro = !S.canPlan, cu = S.isCust;
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
  const vp = visCols(S, pcols, CUST_PLAN_COLS);
  const total = vp.reduce((a, b) => a + b, 0) + 2;
  const tabBtn = (k, label) => <button key={k} onClick={() => setMode(k)} style={{ ...lineBtn, background: mode === k ? V.btnBg : V.surface, color: mode === k ? V.btnFg : V.ink, borderColor: mode === k ? V.btnBg : V.line2 }}>{label}</button>;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderBottom: `1px solid ${V.line}`, flex: 'none' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted2 }}>{list.length} / {S.plans.length} 筆</span>
        {!cu && clashIds.size > 0 && <span style={{ fontSize: 12, color: 'oklch(0.55 0.13 50)' }}>⚠ {clashIds.size} 筆排程日期重疊</span>}
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>{tabBtn('list', '列表')}{tabBtn('time', '時程圖')}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {!cu && <div style={{ position: 'relative' }}>
            <button className="member-btn" onClick={() => setShowPM((v) => !v)} style={lineBtn}>Planner 成員（{S.planners.length}）</button>
            {showPM && <MemberPanel S={S} roA={!S.canAdmin} team="planner" onRemove={(n) => S.delOwnerOnly(n)} onClose={() => setShowPM(false)} />}
          </div>}
          {!cu && <button onClick={() => setHwOnly((v) => !v)} style={{ ...lineBtn, background: hwOnly ? 'oklch(0.62 0.15 50)' : V.surface, color: hwOnly ? '#fff' : V.ink, borderColor: hwOnly ? 'oklch(0.62 0.15 50)' : V.line2 }}>只看 HW 相關（{S.plans.filter((p) => p.hw).length}）</button>}
          <select value={mf} onChange={(e) => setMf(e.target.value)} style={{ height: 32, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 8px', fontSize: 13, background: V.surface }}>
            <option value="">全部機台</option>
            {used.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={cu ? '搜尋 機台 / group / 產品' : '搜尋 機台 / group / 產品 / 備註'} style={{ height: 32, width: 240, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 10px', fontSize: 13, background: V.surface }} />
          {!cu && <button className="btn-dark" disabled={ro} onClick={() => S.addPlan(mf)} style={{ ...darkBtn, opacity: ro ? 0.5 : 1 }}>＋ 新增排程</button>}
        </div>
      </div>
      {!cu && S.machines.length === 0 && <HintBar>機台名稱來自「工程清單」頁的「機台清單」，請先在那裡建立機台。</HintBar>}
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px 40px' }}>
        {mode === 'time' ? <PlanTimeline plans={list} machineNames={used} /> : (
          <div style={{ width: total, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridOf(vp), position: 'sticky', top: 0, zIndex: 6, background: V.head, border: `1px solid ${V.line3}`, borderRadius: 8, boxShadow: `0 -18px 0 ${V.bg}` }}>
              {PHEADS.map(([en, zh], i) => cu && !CUST_PLAN_COLS.has(i) ? null : (
                <div key={i} style={{ position: 'relative', padding: '8px 10px', fontSize: 12, fontWeight: 500, color: V.ink2, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span>{en}</span><span style={{ fontSize: 10, color: V.faint }}>{zh}</span>
                  {i < PHEADS.length - 1 && <div className="colgrip" title="左右拖曳調整寬度（連點兩下還原）" onPointerDown={(e) => startPResize(i, e)} onDoubleClick={() => resetPCol(i)} />}
                </div>
              ))}
            </div>
            {list.map((p) => <PlanRow key={p.id} p={p} S={S} ro={ro} clash={clashIds.has(p.id)} machineOpts={machineOpts} cols={pcols} />)}
            {list.length === 0 && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: V.muted2, background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10 }}>{S.plans.length === 0 ? (cu ? '目前沒有資料。' : '還沒有任何排程，按「＋ 新增排程」開始。') : '沒有符合條件的資料'}</div>}
            {!ro && <div className="add-row" onClick={() => S.addPlan(mf)} style={{ padding: '10px 14px', fontSize: 13, color: V.muted2, cursor: 'pointer', borderRadius: 8, border: `1px dashed ${V.line3}`, textAlign: 'center' }}>＋ 新增排程</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export { PlanPage };
