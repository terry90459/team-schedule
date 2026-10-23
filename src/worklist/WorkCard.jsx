import React from 'react';
import { MONO, OVER, PRIO, ST, STATUS, V } from '../lib/theme';
import { byName, s2d } from '../lib/util';
import { backDays, dueInfo } from '../data/derive';
import { CellText, cin } from '../ui/common';
import { Dropdown, MenuItem, ConfirmItem } from '../ui/menu';
import { CLASH, colTemplate } from './parts';
import { FileList } from './files';
import { tabName } from '../ui/tabs';

/* 工程清單的一列。shown＝要顯示的欄位索引（見 parts.jsx 的 HEADS） */
function WorkCard({ r, rank, S, ro, dnd, canDrag, first, last, dragging, over, cols, shown, logs, onLogs, clash }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const set = (k) => (v) => S.patch(r.id, { [k]: v });
  const [stBg, stFg] = ST[r.status] || ST['未開始'];
  let startLabel = '', dueFg = 'inherit';
  if (r.due) {
    const due = s2d(r.due);
    if (r.days) { const st = backDays(due, Math.max(1, Math.ceil(Number(r.days))), !!S.settings.workdays); startLabel = `${st.getMonth() + 1}/${st.getDate()} 起`; }
  }
  const dinfo = dueInfo(r, today);
  if (dinfo) dueFg = dinfo.fg;
  const lastLog = logs && logs[0];
  const ownerGone = !S.isCust && !!r.owner && !S.owners.includes(r.owner) && r.status !== '已完成';
  const cu = S.isCust;
  const ownerOpts = r.owner && !S.owners.includes(r.owner) ? [...S.owners, r.owner] : S.owners;
  const machineOpts = [...new Set([...(S.machines || []), ...(r.machine ? [r.machine] : [])])].sort(byName);
  const why = ro ? '唯讀狀態無法調整順序' : '目前是排序／篩選檢視，無法調整順序。把排序改回「自訂順序」並清除篩選與搜尋後，就能拖曳 ⋮⋮ 換位置。';
  const line = { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, background: V.accent, zIndex: 5 };
  const cell = { padding: '4px 4px', minWidth: 0, display: 'flex', alignItems: 'center' };
  const others = S.customers.filter((c) => c.id !== r.customer);

  const C = {
    0: (
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 2 }}>
        <div className={canDrag ? 'grip' : ''} aria-hidden="true" draggable={canDrag} title={canDrag ? '按住拖曳，調整順序' : why}
          onDragStart={(e) => dnd.start(e, r.id)} onDragEnd={dnd.end} onMouseDown={() => { if (!canDrag && !ro) S.say(why); }}
          style={{ cursor: canDrag ? 'grab' : 'default', padding: '8px 0 8px 2px', marginRight: 6, fontSize: 18, letterSpacing: -4, lineHeight: 1, userSelect: 'none', color: canDrag ? V.muted2 : V.line3 }}>⋮⋮</div>
        <span className="mono" style={{ fontSize: 12, color: V.faint }}>{rank}</span>
      </div>
    ),
    1: <CellText multiline grow enterBlur className="cin" value={r.item} onCommit={set('item')} disabled={ro} placeholder="工作項目" style={cin({ fontWeight: 600, height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' })} />,
    2: (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
        <select className="cin" aria-label="負責人" value={r.owner || ''} disabled={ro} onChange={(e) => set('owner')(e.target.value)} style={cin({ cursor: ro ? 'default' : 'pointer', ...(ownerGone ? { color: OVER } : null) })}>
          <option value="">—</option>
          {ownerOpts.map((o) => <option key={o} value={o}>{o}{o === r.owner && ownerGone ? '（已不在成員清單）' : ''}</option>)}
        </select>
        {ownerGone && <span title="這位負責人已不在工程師成員清單（帳號已停用或刪除，或已被移除），請改派給其他人" style={{ fontSize: 10.5, color: OVER, padding: '0 6px', lineHeight: 1.2, fontWeight: 500, cursor: 'help', whiteSpace: 'nowrap' }}>⚠ 已不在清單</span>}
      </div>
    ),
    3: <CellText multiline grow enterBlur className="cin" value={r.custOwner} onCommit={set('custOwner')} disabled={ro} placeholder="客戶窗口" style={cin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', wordBreak: 'break-word' })} />,
    4: (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
        <select className="cin" aria-label="機台" value={r.machine || ''} disabled={ro} onChange={(e) => set('machine')(e.target.value)} style={cin({ cursor: ro ? 'default' : 'pointer', fontFamily: MONO, fontSize: 12 })}>
          <option value="">—</option>
          {machineOpts.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {!cu && clash && clash.length > 0 && <span title={'與生產排程時間重疊：\n' + clash.map((p) => `${p.start} → ${p.end}  ${[p.group, p.product].filter(Boolean).join(' · ').replace(/\n/g, ' ')}`).join('\n')} style={{ fontSize: 10.5, color: CLASH, padding: '0 8px', lineHeight: 1.2, cursor: 'help' }}>⚠ 與生產撞期</span>}
      </div>
    ),
    5: (
      <select className="pill" aria-label="狀態" value={r.status} disabled={ro} onChange={(e) => set('status')(e.target.value)}
        style={{ backgroundColor: stBg, color: stFg, cursor: ro ? 'default' : 'pointer' }}>
        {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    ),
    6: (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
        <input className="cin" aria-label="截止日" type="date" value={r.due || ''} disabled={ro} onChange={(e) => set('due')(e.target.value)} style={cin({ fontFamily: MONO, fontSize: 12, color: dueFg, padding: '0 4px', fontWeight: dinfo ? 600 : 400 })} />
        {dinfo && <span style={{ fontSize: 10.5, color: dinfo.fg, padding: '0 5px', lineHeight: 1.2, fontWeight: 500 }}>{dinfo.kind === 'soon' ? '⏰ ' : ''}{dinfo.text}</span>}
      </div>
    ),
    7: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <CellText className="cin" value={String(r.days ?? '')} disabled={ro} onCommit={(v) => set('days')(v === '' ? '' : Number(v))}
          style={cin({ width: 52, fontFamily: MONO, fontSize: 12, textAlign: 'right', padding: '0 6px' })} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <span style={{ fontSize: 11, color: V.muted }}>{S.settings.workdays ? '工作天' : '天'}</span>
          <span className="mono" style={{ fontSize: 10, color: V.faint, whiteSpace: 'nowrap' }}>{startLabel}</span>
        </div>
      </div>
    ),
    8: (
      <select className={'cin prio p' + PRIO.indexOf(r.priority)} aria-label="優先度" value={r.priority} disabled={ro} onChange={(e) => set('priority')(e.target.value)} style={{ cursor: ro ? 'default' : 'pointer' }}>
        {PRIO.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    ),
    9: <CellText multiline grow className="cin" value={r.remark} onCommit={set('remark')} disabled={ro} placeholder="備註" style={cin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', color: V.ink2 })} />,
    10: (
      <button className="logcell" onClick={onLogs} title="開啟工作詳情（進度紀錄、備註、附件…）"
        style={{ width: '100%', minHeight: 30, textAlign: 'left', border: '1px solid transparent', background: 'transparent', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1, color: V.ink2 }}>
        {lastLog ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: V.muted2, width: '100%' }}>
              <span className="mono">{lastLog.date ? lastLog.date.slice(5).replace('-', '/') : ''}</span>
              {lastLog.author && <span>{lastLog.author}</span>}
              {logs.length > 1 && <span className="mono" style={{ marginLeft: 'auto', color: V.faint }}>{logs.length} 則</span>}
            </span>
            <span style={{ fontSize: 12, lineHeight: 1.4, color: V.muted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{lastLog.text}</span>
          </>
        ) : <span className="row-actions" style={{ fontSize: 12, color: V.faint }}>{ro ? '開啟詳情' : '＋ 寫紀錄'}</span>}
      </button>
    ),
    11: <FileList r={r} S={S} ro={ro} />,
    12: (
      <div className="mono" style={{ fontSize: 11, color: V.muted2, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span>{r.updated || '—'}</span>
        {r.updatedBy && <span style={{ fontFamily: 'inherit', fontSize: 10.5, color: V.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.updatedBy}</span>}
      </div>
    ),
    // P2：上移／下移、移到其他分頁、刪除都收進「⋯」
    13: (
      <span className="row-actions"><Dropdown label="⋯" btnClass="btn btn-ghost" btnStyle={{ width: 30, height: 30, padding: 0, fontSize: 16 }} title="更多動作" ariaLabel="更多動作" width={230}>
        {(close) => (
          <>
            <MenuItem onClick={() => { close(); onLogs(); }}>開啟工作詳情</MenuItem>
            {!ro && <>
              <div className="pop-sep" />
              <MenuItem disabled={!canDrag || first} title={canDrag ? '' : why} onClick={() => { close(); dnd.step(r.id, -1); }}>上移一格</MenuItem>
              <MenuItem disabled={!canDrag || last} title={canDrag ? '' : why} onClick={() => { close(); dnd.step(r.id, 1); }}>下移一格</MenuItem>
              {others.length > 0 && <>
                <div className="pop-sep" />
                <div className="pop-title">移到其他分頁</div>
                {others.map((c) => <MenuItem key={c.id} onClick={() => { close(); S.moveRowTab(r.id, c.id).then(() => S.say(`已移到「${tabName(S, c.id)}」`)); }}>{c.name}</MenuItem>)}
              </>}
              <div className="pop-sep" />
              <ConfirmItem onConfirm={() => { close(); S.del(r.id); }}>刪除這筆</ConfirmItem>
            </>}
          </>
        )}
      </Dropdown></span>
    ),
  };
  const pad = { 0: null, 1: cell, 5: { ...cell, padding: '4px 6px' }, 8: { ...cell, padding: '4px 6px' }, 10: { ...cell, padding: '4px 6px' }, 11: { ...cell, flexWrap: 'wrap' }, 13: { display: 'grid', placeItems: 'center' } };

  return (
    <div data-card="1" data-row={r.id} onDragOver={(e) => dnd.over(e, r)} onDrop={(e) => dnd.drop(e, r)} style={{ position: 'relative', opacity: dragging ? 0.4 : 1 }}>
      {over === 'before' && <div style={{ ...line, top: -5 }} />}
      <div className="wcard" style={{ display: 'grid', gridTemplateColumns: colTemplate(shown, cols), alignItems: 'stretch', background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, minHeight: 46 }}>
        {shown.map((i) => i === 0 ? <React.Fragment key={0}>{C[0]}</React.Fragment> : <div key={i} style={pad[i] || cell}>{C[i]}</div>)}
      </div>
      {over === 'after' && <div style={{ ...line, bottom: -5 }} />}
    </div>
  );
}

export { WorkCard };
