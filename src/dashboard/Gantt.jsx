import React, { useState } from 'react';
import { MONO, SOON, STATUS, STC, UN, V, WD } from '../lib/theme';
import { addD, byName, diff, holName, isOff, ymd } from '../lib/util';
import { RangeBar, barTone, clip, useRange } from '../data/derive';
import { Avatar, lineBtn } from '../ui/common';
import { DIM, FOCUS_BAR, GANTT_LW, fitDW, focusHint, useBoxW, useFocus } from '../plan/timeline';

/* 工程排程甘特圖（時程圖 → 工程排程；客戶帳號在工程清單切換）
   cust：客戶帳號——不顯示優先度（最優先紅點、提示文字） */
function Gantt({ D, picked, setPicked, cust, onOpen }) {
  const { rows, names, today } = D;
  const anyPicked = Object.values(picked).some(Boolean);
  const [by, setBy] = useState('machine');
  const F = useFocus();
  const R = useRange('eng');
  const gStart = R.lo, nDays = R.n;
  const inRange = (r) => !r.dueD || !!clip(r.startD, r.dueD, R);
  const gDays = Array.from({ length: nDays }, (_, i) => {
    const d = addD(gStart, i); const t = diff(d, today) === 0; const we = isOff(d), hn = holName(d);
    return { day: d.getDate(), wd: t ? '今天' : hn ? hn.slice(0, 2) : WD[d.getDay()], tip: hn ? `${ymd(d)} ${hn}` : '', month: i === 0 || d.getDate() === 1 ? d.getMonth() + 1 + '月' : '', fg: t ? 'var(--accent)' : we ? V.holFg : V.ink2, mfg: we && !t ? V.holFg : V.muted2, weight: t || hn ? 700 : 400, headBg: t ? V.todayHead : we ? V.holHead : 'transparent' };
  });
  const gBg = Array.from({ length: nDays }, (_, i) => {
    const d = addD(gStart, i); const t = diff(d, today) === 0; const we = isOff(d);
    return { col: i + 2, bg: t ? V.todayBg : we ? V.holBody : 'transparent' };
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
          span: `${a + 2} / ${b + 3}`, days: r.dayN, status: r.status, urgent: !cust && r.priority === '最優先',
          bg: tone.bg, fg: tone.bd, textFg: tone.fg,
          tip: `${r.item}｜${r.owner === UN ? '未指派' : r.owner}｜${cust ? '' : r.priority + '｜'}${tentative ? '日期未定' : '截止 ' + r.due + (r.over ? '（逾期）' : r.soon ? '（3 天內到期）' : '')}`,
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
            <div key={i} title={d.tip} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 6px', borderRight: `1px solid ${V.line}`, background: d.headBg }}>
              <span style={{ fontSize: 10, color: d.mfg, height: 13 }}>{d.month}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: d.weight, color: d.fg }}>{d.day}</span>
              <span style={{ fontSize: 10, color: d.fg, whiteSpace: 'nowrap' }}>{d.wd}</span>
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
              <div key={r.id} title="點一下開啟詳情" onClick={() => { if (!F.rOn(r.id)) F.row(g.name || 'none', r.id); if (onOpen) onOpen(r.id); }} style={{ display: 'grid', gridTemplateColumns: gCols, gridTemplateRows: '40px', borderBottom: `1px solid ${V.line}`, width: 'max-content', minWidth: '100%', cursor: 'pointer', boxShadow: F.rOn(r.id) ? FOCUS_BAR : undefined, ...(F.rDim(g.name || 'none', r.id) ? DIM : null) }}>
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

export { Gantt };
