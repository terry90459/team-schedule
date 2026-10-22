import React, { useState } from 'react';
import { MONO, OVER, PRBAR, PRIO, QUIET, ST, UN, V, WD } from '../lib/theme';
import { addD, byName, diff, dstr, md, s2d, validPlan } from '../lib/util';
import { dueInfo } from '../data/derive';
import { Avatar, card, lineBtn } from '../ui/common';

/* ============================================================
   C1：每日視圖 —— 選一天，看每個人手上的工作、逾期、當天紀錄，以及當天機台生產排程
   ============================================================ */
function DailyPage({ S, D, openLogs }) {
  const [day, setDay] = useState(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; });
  const ds = dstr(day);
  const isToday = diff(day, D.today) === 0;
  const active = D.rows.filter((r) => r.dueD && r.startD <= day && day <= r.dueD);
  const overdue = D.rows.filter((r) => r.dueD && r.dueD < day && !QUIET.includes(r.status));
  const dayLogs = S.logs.filter((l) => l.date === ds);
  const rowOf = new Map(S.rows.map((r) => [r.id, r]));
  const plans = S.plans.filter((p) => validPlan(p) && p.start <= ds && ds <= p.end).sort((a, b) => byName(a.machine || '', b.machine || ''));
  const people = [...new Set([...S.owners, ...active.map((r) => r.owner), ...overdue.map((r) => r.owner)])]
    .map((n) => ({
      name: n,
      act: active.filter((r) => r.owner === n).sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority)),
      over: overdue.filter((r) => r.owner === n),
      logs: dayLogs.filter((l) => l.author === n || (!l.author && (rowOf.get(l.rowId) || {}).owner === n)),
    }))
    .sort((a, b) => (b.name === S.me) - (a.name === S.me) || (a.name === UN) - (b.name === UN) || (b.act.length + b.over.length) - (a.act.length + a.over.length));
  const shift = (n) => setDay((d) => addD(d, n));
  const b = { ...lineBtn, height: 30, padding: '0 10px', fontSize: 12 };
  const ItemLine = ({ r, overdueMode }) => {
    const di = dueInfo(r, overdueMode ? day : D.today);
    const [stBg, stFg] = ST[r.status] || ST['未開始'];
    const nl = S.logs.filter((l) => l.rowId === r.id).length;
    return (
      <div className="member-item" onClick={() => openLogs(r.id)} title="點一下看進度紀錄" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', borderLeft: `3px solid ${r.priority === '最優先' ? 'oklch(0.58 0.17 25)' : r.priority === '優先' ? PRBAR['優先'] : 'transparent'}` }}>
        <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.item || '（未命名）'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, color: V.muted }}>
          <span style={{ borderRadius: 9, padding: '1px 7px', background: stBg, color: stFg }}>{r.status}</span>
          {r.machine && <span style={{ fontFamily: MONO }}>{r.machine}</span>}
          <span style={{ fontFamily: MONO }}>{md(r.startD)}–{md(r.dueD)}</span>
          {overdueMode ? <span style={{ color: OVER, fontWeight: 500 }}>逾期 {diff(day, r.dueD)} 天</span> : di && <span style={{ color: di.fg, fontWeight: 500 }}>{di.text}</span>}
          {nl > 0 && <span style={{ color: V.faint }}>紀錄 {nl}</span>}
        </span>
      </div>
    );
  };
  const sec = (t, n, fg) => <div style={{ fontSize: 11, color: fg || V.muted2, padding: '8px 8px 2px', display: 'flex', gap: 6 }}>{t}<span style={{ fontFamily: MONO }}>{n}</span></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => shift(-1)} style={b}>◀ 前一天</button>
        <button onClick={() => setDay(new Date(D.today))} disabled={isToday} style={{ ...b, opacity: isToday ? 0.5 : 1 }}>今天</button>
        <button onClick={() => shift(1)} style={b}>後一天 ▶</button>
        <input type="date" value={ds} onChange={(e) => e.target.value && setDay(s2d(e.target.value))} style={{ ...b, fontFamily: MONO }} />
        <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 8 }}>{day.getMonth() + 1} 月 {day.getDate()} 日（{WD[day.getDay()]}）{isToday && <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 6 }}>今天</span>}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: V.muted }}>進行中工作 <b>{active.length}</b>・逾期未完成 <b style={{ color: overdue.length ? OVER : 'inherit' }}>{overdue.length}</b>・當天紀錄 <b>{dayLogs.length}</b>・生產排程 <b>{plans.length}</b></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
          {people.map((p) => (
            <div key={p.name} style={{ ...card, padding: 10, display: 'flex', flexDirection: 'column', gap: 2, borderColor: p.name === S.me ? 'var(--accent)' : V.line }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 6px', borderBottom: `1px solid ${V.line}` }}>
                <Avatar name={p.name} size={26} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                {D.gone.has(p.name) && <span title="已不在工程師成員清單（帳號停用或刪除），請改派他的工作" style={{ fontSize: 10.5, color: OVER }}>⚠ 已不在清單</span>}
                {p.name === S.me && <span style={{ fontSize: 10, color: 'var(--accent)' }}>我</span>}
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: V.muted2 }}>{p.act.length} 件{p.over.length ? `・逾期 ${p.over.length}` : ''}</span>
              </div>
              {p.act.length === 0 && p.over.length === 0 && p.logs.length === 0 && <div style={{ padding: '14px 8px', fontSize: 12, color: V.faint }}>這天沒有排定的工作</div>}
              {p.act.length > 0 && <>{sec('這天的工作', p.act.length)}{p.act.map((r) => <ItemLine key={r.id} r={r} />)}</>}
              {p.over.length > 0 && <>{sec('逾期未完成', p.over.length, OVER)}{p.over.map((r) => <ItemLine key={r.id} r={r} overdueMode />)}</>}
              {p.logs.length > 0 && <>{sec('這天的進度紀錄', p.logs.length)}{p.logs.map((l) => (
                <div key={l.id} className="member-item" onClick={() => openLogs(l.rowId)} style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, lineHeight: 1.5 }}>
                  <div style={{ color: V.muted2, fontSize: 11 }}>{((rowOf.get(l.rowId) || {}).item || '（已刪除）').split('\n')[0]}</div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.text}</div>
                </div>
              ))}</>}
            </div>
          ))}
        </div>
        <div style={{ ...card, overflow: 'hidden', position: 'sticky', top: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${V.line}`, display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 600 }}>這天的機台生產排程</span><span style={{ fontFamily: MONO, fontSize: 11, color: V.muted2 }}>{plans.length} 筆</span></div>
          {plans.length === 0 && <div style={{ padding: '18px 14px', fontSize: 12, color: V.faint }}>這天沒有生產排程</div>}
          {plans.map((p) => (
            <div key={p.id} style={{ padding: '8px 14px', borderBottom: `1px solid ${V.line}`, display: 'flex', flexDirection: 'column', gap: 2, boxShadow: p.hw ? 'inset 3px 0 0 oklch(0.62 0.15 50)' : undefined }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{p.machine || '（未指定）'}</span>
                {p.hw && <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: 'oklch(0.62 0.15 50)', color: '#fff' }}>HW</span>}
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, color: V.faint }}>{p.start.slice(5)} → {p.end.slice(5)}</span>
              </span>
              <span style={{ fontSize: 12, color: V.ink2, whiteSpace: 'pre-wrap' }}>{[p.group, p.product].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { DailyPage };
