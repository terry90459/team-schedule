import React from 'react';
import { MONO, V } from '../lib/theme';
import { byName, diff, s2d } from '../lib/util';
import { CellText, RowDelete, mvBtn } from '../ui/common';
import { TabMove, tabName } from '../ui/tabs';

/* ============================================================
   外框
   ============================================================ */
/* ============================================================
   機台生產排程（Planner team）
   ============================================================ */
// Remark 欄（客戶看不到備註時改 Product 欄）是「最小寬度＋撐滿剩餘空間」
const PGRID = [140, 140, 200, 100, 132, 132, 64, 200, 126, 64];
const PGMIN = [100, 80, 120, 70, 110, 110, 56, 120, 100, 64];
const planTemplate = (idx, cols) => { const flex = idx.includes(7) ? 7 : 2; return idx.map((i) => (i === flex ? `minmax(${cols[i]}px,1fr)` : `${cols[i]}px`)).join(' '); };
const PHEADS = [['Machine', '機台'], ['Group', 'Group'], ['Product', '產品'], ['HW', '需 HW 協助'], ['Start', '開始日'], ['End', '結束日'], ['Days', '天數'], ['Remark', '備註'], ['Update', '更新時間'], ['', '']];
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

function PlanRow({ p, S, ro, clash, machineOpts, cols, tpl }) {
  const set = (k) => (v) => S.patchPlan(p.id, { [k]: v });
  const days = p.start && p.end ? diff(s2d(p.end), s2d(p.start)) + 1 : '';
  const bad = p.start && p.end && days < 1;
  const opts = [...new Set([...machineOpts, ...(p.machine ? [p.machine] : [])])].sort(byName);
  const cu = S.isCust;
  const dateStyle = (c) => pin({ fontFamily: MONO, fontSize: 12, padding: '0 4px', color: c || 'inherit' });
  return (
    <div className="wcard" style={{ display: 'grid', gridTemplateColumns: tpl, alignItems: 'stretch', background: V.surface, border: `1px solid ${clash && !cu ? 'oklch(0.7 0.12 50)' : V.line2}`, borderRadius: 8, minHeight: 46, boxShadow: p.hw && !cu ? 'inset 4px 0 0 oklch(0.62 0.15 50)' : undefined }}>
      <div style={pCell}>
        <select className="cin" value={p.machine || ''} disabled={ro} onChange={(e) => set('machine')(e.target.value)} style={pin({ cursor: ro ? 'default' : 'pointer', fontFamily: MONO, fontSize: 12, fontWeight: 600 })}>
          <option value="">—</option>
          {opts.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div style={pCell}><CellText multiline grow enterBlur className="cin" value={p.group} onCommit={set('group')} disabled={ro} placeholder="Group" style={pin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', wordBreak: 'break-word' })} /></div>
      <div style={pCell}><CellText multiline grow enterBlur className="cin" value={p.product} onCommit={set('product')} disabled={ro} placeholder="產品名稱" style={pin({ fontWeight: 600, height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', wordBreak: 'break-word' })} /></div>
      {!cu && <div style={{ ...pCell, justifyContent: 'center' }}><HwSwitch on={p.hw} disabled={ro} onChange={set('hw')} /></div>}
      <div style={pCell}><input className="cin" type="date" value={p.start || ''} disabled={ro} onChange={(e) => set('start')(e.target.value)} style={dateStyle()} /></div>
      <div style={pCell}><input className="cin" type="date" value={p.end || ''} disabled={ro} onChange={(e) => set('end')(e.target.value)} style={dateStyle(bad ? 'oklch(0.55 0.17 25)' : null)} /></div>
      <div style={{ ...pCell, fontFamily: MONO, fontSize: 12, color: bad ? 'oklch(0.55 0.17 25)' : V.muted, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}>
        <span>{bad ? '日期有誤' : days}</span>
        {clash && !bad && !cu && <span title="同一台機台有日期重疊的排程" style={{ fontSize: 10, color: 'oklch(0.55 0.13 50)', fontFamily: 'inherit' }}>⚠ 重疊</span>}
      </div>
      {!cu && <>
      <div style={pCell}><CellText multiline grow className="cin" value={p.remark} onCommit={set('remark')} disabled={ro} placeholder="備註" style={pin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', color: V.ink2 })} /></div>
      <div style={{ ...pCell, fontFamily: MONO, fontSize: 11, color: V.muted2, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}><span>{p.updated || '—'}</span>{p.updatedBy && <span style={{ fontSize: 10.5, color: V.faint }}>{p.updatedBy}</span>}</div>
      <div className="row-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <button className="mv" disabled={ro} onClick={() => S.addPlan('', p)} title="複製一筆（同樣內容，可再改機台或日期）" style={{ ...mvBtn, fontSize: 13, width: 24 }}>⧉</button>
        {!ro && <TabMove S={S} cur={p.customer} onMove={(t) => S.movePlanTab(p.id, t).then(() => S.say(`已移到「${tabName(S, t)}」`))} />}
        <RowDelete disabled={ro} onDelete={() => S.delPlan(p.id)} />
      </div>
      </>}
    </div>
  );
}

export { PGRID, PGMIN, PHEADS, planTemplate, pCell, pin, HwSwitch, PlanRow };
