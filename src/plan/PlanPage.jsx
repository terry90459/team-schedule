import React, { useState } from 'react';
import { V } from '../lib/theme';
import { byName } from '../lib/util';
import { HintBar, gridOf, useCols } from '../ui/common';
import { CUST_PLAN_COLS, visCols } from '../ui/tabs';
import { PGMIN, PGRID, PHEADS, PlanRow, planTemplate } from './PlanRow';
import { PlanTimeline } from './timeline';

/* 機台生產排程頁 */
function PlanPage({ S, goTimeline }) {
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
  const [pcols, startPResize, resetPCol] = useCols('plan.cols.v2', PGRID, PGMIN);
  const pidx = PHEADS.map((_, i) => i).filter((i) => !cu || CUST_PLAN_COLS.has(i));
  const ptpl = planTemplate(pidx, pcols);
  const vp = visCols(S, pcols, CUST_PLAN_COLS);
  const total = vp.reduce((a, b) => a + b, 0) + 2;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* P3：工具列一排；Planner 成員移到「⚙ 管理 → 成員」；時程圖統一在「時程圖」頁（客戶帳號仍在這裡切換） */}
      <div className="toolbar flat">
        <input className="field search" type="search" aria-label="搜尋" value={q} onChange={(e) => setQ(e.target.value)} placeholder={cu ? '搜尋機台、group、產品…' : '搜尋機台、group、產品、備註…'} style={{ width: 230 }} />
        <select className="field" aria-label="機台" value={mf} onChange={(e) => setMf(e.target.value)} style={mf ? { borderColor: V.btnBg } : null}>
          <option value="">全部機台</option>
          {used.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {!cu && <button className={'chip' + (hwOnly ? ' on' : '')} aria-pressed={hwOnly} onClick={() => setHwOnly((v) => !v)} style={hwOnly ? { background: 'oklch(0.62 0.15 50)', borderColor: 'oklch(0.62 0.15 50)', color: '#fff' } : null}>只看需 HW 協助<span className="n">{S.plans.filter((p) => p.hw).length}</span></button>}
        {!cu && clashIds.size > 0 && <span style={{ fontSize: 12, color: 'oklch(0.55 0.13 50)' }}>⚠ {clashIds.size} 筆排程日期重疊</span>}
        <span className="grow" />
        {cu
          ? <div className="seg" role="group" aria-label="顯示方式">{[['list', '列表'], ['time', '時程圖']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}</div>
          : <button className="btn btn-sm" onClick={() => goTimeline('plan')} title="到「時程圖」看生產排程">📅 時程圖</button>}
        {!cu && <button className="btn btn-primary" disabled={ro} onClick={() => S.addPlan(mf)}>＋ 新增排程</button>}
      </div>
      {!cu && S.machines.length === 0 && <HintBar>還沒有機台。{S.canAdmin ? '請到「⚙ 管理 → 機台」新增。' : '請管理員到「⚙ 管理 → 機台」新增。'}</HintBar>}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px 40px' }}>
        {mode === 'time' ? <PlanTimeline plans={list} machineNames={used} /> : (
          <div style={{ minWidth: total, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tbl">
            <div className="tbl-head" style={{ gridTemplateColumns: ptpl }}>
              {PHEADS.map(([en, zh], i) => cu && !CUST_PLAN_COLS.has(i) ? null : (
                <div key={i}>
                  <span>{zh || en}</span>
                  {i < PHEADS.length - 1 && <div className="colgrip" title="左右拖曳調整寬度（連點兩下還原）" onPointerDown={(e) => startPResize(i, e)} onDoubleClick={() => resetPCol(i)} />}
                </div>
              ))}
            </div>
            {list.map((p) => <PlanRow key={p.id} p={p} S={S} ro={ro} clash={clashIds.has(p.id)} machineOpts={machineOpts} cols={pcols} tpl={ptpl} />)}
            {list.length === 0 && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: V.muted2 }}>{S.plans.length === 0 ? (cu ? '目前沒有資料。' : '還沒有任何排程，按「＋ 新增排程」開始。') : '沒有符合條件的資料'}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!ro && <button className="btn btn-sm btn-ghost" onClick={() => S.addPlan(mf)}>＋ 新增排程</button>}
              <span className="mono muted" style={{ marginLeft: 'auto', fontSize: 11.5 }}>顯示 {list.length} / {S.plans.length} 筆</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { PlanPage };
