import React, { useState } from 'react';
import { MONO, PR, PRIO, SOON, STATUS, STC, V } from '../lib/theme';
import { dueInfo } from '../data/derive';
import { Avatar } from '../ui/common';

/* 卡片看板 */
function Board({ D, S, openLogs }) {
  const { rows, today } = D;
  const nLog = new Map(); S.logs.forEach((l) => nLog.set(l.rowId, (nLog.get(l.rowId) || 0) + 1));
  const [drag, setDrag] = useState(null), [overCol, setOverCol] = useState(null);
  const can = S.canEdit;
  const cols = STATUS.map((k) => {
    const cards = rows.filter((r) => r.status === k)
      .sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority) || (a.due || '9').localeCompare(b.due || '9'));
    return { label: k, fg: STC[k], cards };
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATUS.length},minmax(210px,1fr))`, gap: 12, alignItems: 'start' }}>
      {cols.map((col) => (
        <div key={col.label}
          onDragOver={(e) => { if (!drag) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overCol !== col.label) setOverCol(col.label); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
          onDrop={(e) => { e.preventDefault(); const t = rows.find((x) => x.id === drag); setDrag(null); setOverCol(null); if (t && t.status !== col.label) S.patch(t.id, { status: col.label }); }}
          style={{ background: V.head, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 240, outline: overCol === col.label ? `2px dashed ${V.accent}` : 'none', outlineOffset: -2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: col.fg }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{col.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted2 }}>{col.cards.length}</span>
          </div>
          {col.cards.map((t) => {
            const [prBg, prFg, prBd] = PR[t.priority] || PR['普通'];
            const m = (t.machine || '').trim();
            const nf = (t.files || []).length;
            const di = dueInfo(t, today), nl = nLog.get(t.id) || 0;
            return (
              <div key={t.id} className="wcard" draggable={can} onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); setTimeout(() => setDrag(t.id), 0); }} onDragEnd={() => { setDrag(null); setOverCol(null); }}
                onClick={() => openLogs(t.id)} title={can ? '拖到其他欄可改狀態；點一下看進度紀錄' : '點一下看進度紀錄'}
                style={{ background: V.surface, border: `1px solid ${t.soon ? SOON.bd : V.line}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, cursor: can ? 'grab' : 'pointer', opacity: drag === t.id ? 0.4 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, borderRadius: 4, padding: '2px 7px', background: prBg, color: prFg, border: `1px solid ${prBd}` }}>{t.priority}</span>
                  {m && <span style={{ fontFamily: MONO, fontSize: 11, color: V.muted, background: V.tint, borderRadius: 4, padding: '2px 7px' }}>{m}</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.45, textWrap: 'pretty' }}>{t.item || '（未命名）'}</div>
                {(t.remark || '').trim() && <div style={{ fontSize: 12, lineHeight: 1.5, color: V.muted }}>{t.remark}</div>}
                {(t.custOwner || '').trim() && <div style={{ fontSize: 11, color: V.muted2 }}>客戶 Owner：{t.custOwner}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: `1px solid ${V.line}` }}>
                  <Avatar name={t.owner} />
                  <span style={{ fontSize: 12, color: V.ink2 }}>{t.owner}</span>
                  {nf > 0 && <span style={{ fontSize: 11, color: V.muted2 }}>附件 {nf}</span>}
                  {nl > 0 && <span style={{ fontSize: 11, color: V.muted2 }}>紀錄 {nl}</span>}
                  <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: di ? di.fg : V.muted, fontWeight: di ? 600 : 400 }}>{t.due ? (di ? di.text + ' · ' : '') + t.due.slice(5).replace('-', '/') : '未設日期'}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export { Board };
