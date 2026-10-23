import React from 'react';
import { ST, STATUS, V } from '../lib/theme';
import { md, s2d } from '../lib/util';
import { dueInfo } from '../data/derive';
import { Avatar } from '../ui/common';
import { Dropdown, MenuItem } from '../ui/menu';
import { tabName } from '../ui/tabs';

/* 狀態膠囊：可以直接點選切換（唯讀時只顯示） */
function StatusPill({ status, onChange, ro }) {
  const [bg, fg] = ST[status] || ST['未開始'];
  const label = <><i />{status}</>;
  if (ro) return <button type="button" className="st" disabled style={{ background: bg, color: fg }}>{label}</button>;
  return (
    <span className="st-wrap" onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      <Dropdown label={<>{label}<span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 9 }}>▾</span></>} btnClass="st" btnStyle={{ background: bg, color: fg }} ariaLabel={`狀態：${status}，點一下更改`} align="left" width={170}>
        {(close) => STATUS.map((s) => (
          <MenuItem key={s} onClick={() => { close(); if (s !== status) onChange(s); }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: (ST[s] || [])[1] }} />{s}{s === status && <span className="k">目前</span>}
          </MenuItem>
        ))}
      </Dropdown>
    </span>
  );
}

/* 工作一列：狀態｜標題＋（機台・客戶・紀錄數）｜截止日｜負責人
   清單只負責「看」與改狀態，其他欄位點開右側詳情修改 */
function ItemRow({ r, S, sel, onOpen, showScope, today, logN, clash, gone, dnd }) {
  const ro = !S.canEdit;
  const di = dueInfo(r, today);
  const meta = [
    r.machine && <span key="m" className="mono">{r.machine}</span>,
    showScope && <span key="c">{tabName(S, r.customer)}</span>,
    r.custOwner && !S.isCust && <span key="co">客戶窗口 {r.custOwner.split('\n')[0]}</span>,
    logN > 0 && <span key="l">紀錄 {logN}</span>,
  ].filter(Boolean);
  return (
    <div className={'item' + (sel ? ' sel' : '') + (dnd && dnd.over === 'before' ? ' drop-before' : dnd && dnd.over === 'after' ? ' drop-after' : '')}
      data-row={r.id} role="button" tabIndex={0} aria-label={`開啟「${(r.item || '未命名').split('\n')[0]}」`}
      onClick={() => onOpen(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id); }}
      {...(dnd ? { onDragOver: dnd.onOver, onDrop: dnd.onDrop } : null)}>
      {dnd && dnd.can && <span className="grab" draggable onDragStart={dnd.onStart} onDragEnd={dnd.onEnd} onClick={(e) => e.stopPropagation()} title="按住拖曳調整順序" aria-hidden="true">⋮⋮</span>}
      <StatusPill status={r.status} ro={ro} onChange={(s) => S.patch(r.id, { status: s })} />
      <div style={{ minWidth: 0 }}>
        <div className="t">{(r.item || '').split('\n')[0] || <span style={{ color: V.faint, fontWeight: 400 }}>（未命名）</span>}</div>
        <div className="m">
          {!S.isCust && r.priority === '最優先' && <span className="tag p0">最優先</span>}
          {!S.isCust && r.priority === '優先' && <span className="tag p1">優先</span>}
          {clash && <span className="tag cl" title="這台機台在這段期間有生產排程">與生產撞期</span>}
          {gone && <span className="tag p0" title="負責人已不在工程師成員清單，請改派">負責人已不在</span>}
          {meta.map((x, i) => <React.Fragment key={i}>{i > 0 && <span className="sep">·</span>}{x}</React.Fragment>)}
        </div>
      </div>
      <div className="due" style={di ? { color: di.fg } : null}>
        {r.due ? md(s2d(r.due)) : <span style={{ color: V.faint }}>未定</span>}
        {di ? <small style={{ fontWeight: 600 }}>{di.text}</small> : r.due && r.days ? <small style={{ color: V.faint }}>預計 {r.days} 天</small> : null}
      </div>
      <span className="av" title={r.owner || '未指派'}>{r.owner ? <Avatar name={r.owner} size={26} /> : <span style={{ display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 13, border: `1px dashed ${V.line3}`, color: V.faint, fontSize: 11 }}>?</span>}</span>
    </div>
  );
}

export { StatusPill, ItemRow };
