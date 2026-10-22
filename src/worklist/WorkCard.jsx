import React from 'react';
import { MONO, OVER, PR, PRIO, ST, STATUS, V } from '../lib/theme';
import { byName, copyText, s2d } from '../lib/util';
import { backDays, dueInfo } from '../data/derive';
import { CellText, RowDelete, addChip, cin, gridOf, mvBtn } from '../ui/common';
import { CLASH, LinkAdd, uploadMsg } from './parts';
import { CUST_ENG_COLS, TabMove, tabName, visCols } from '../ui/tabs';

function WorkCard({ r, rank, S, ro, dnd, canDrag, first, last, dragging, over, cols, logs, onLogs, clash }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const set = (k) => (v) => S.patch(r.id, { [k]: v });
  const [stBg, stFg] = ST[r.status] || ST['未開始'];
  const [prBg, prFg, prBd] = PR[r.priority] || PR['普通'];
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
  const files = S.filesByRow.get(r.id) || [];
  const machineOpts = [...new Set([...(S.machines || []), ...(r.machine ? [r.machine] : [])])].sort(byName);
  const why = ro ? '唯讀狀態無法調整順序' : '請先把排序改成「自訂順序」並清除篩選／搜尋，才能調整順序';
  const line = { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, background: V.accent, zIndex: 5 };
  const cell = { padding: '4px 4px', minWidth: 0, display: 'flex', alignItems: 'center' };

  return (
    <div data-card="1" onDragOver={(e) => dnd.over(e, r)} onDrop={(e) => dnd.drop(e, r)} style={{ position: 'relative', opacity: dragging ? 0.4 : 1 }}>
      {over === 'before' && <div style={{ ...line, top: -5 }} />}
      <div className="wcard" style={{ display: 'grid', gridTemplateColumns: gridOf(visCols(S, cols, CUST_ENG_COLS)), alignItems: 'stretch', background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, minHeight: 46 }}>
        {!cu && <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 2px 0 0', background: V.tint, borderRight: `1px solid ${V.line}`, borderRadius: '8px 0 0 8px' }}>
          <div className={canDrag ? 'grip' : ''} draggable={canDrag} title={canDrag ? '按住拖曳，調整順序' : why}
            onDragStart={(e) => dnd.start(e, r.id)} onDragEnd={dnd.end}
            style={{ cursor: canDrag ? 'grab' : 'not-allowed', padding: '8px 0 8px 4px', marginRight: 10, fontSize: 24, letterSpacing: -5, lineHeight: 1, userSelect: 'none', color: canDrag ? V.muted : V.faint }}>⋮⋮</div>
          <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 500, minWidth: 28, marginRight: 0 }}><span style={{ fontSize: 10, color: V.faint }}>#</span>{rank}</span>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
            <button className="mv" disabled={!canDrag || first} onClick={() => dnd.step(r.id, -1)} title="上移一格" style={mvBtn}>▲</button>
            <button className="mv" disabled={!canDrag || last} onClick={() => dnd.step(r.id, 1)} title="下移一格" style={mvBtn}>▼</button>
          </div>
        </div>}
        <div style={cell}>
          <CellText multiline grow enterBlur className="cin" value={r.item} onCommit={set('item')} disabled={ro} placeholder="工作項目" style={cin({ fontWeight: 600, height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' })} />
        </div>
        <div style={cell}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
            <select className="cin" value={r.owner || ''} disabled={ro} onChange={(e) => set('owner')(e.target.value)} style={cin({ cursor: ro ? 'default' : 'pointer', ...(ownerGone ? { color: OVER } : null) })}>
              <option value="">—</option>
              {ownerOpts.map((o) => <option key={o} value={o}>{o}{o === r.owner && ownerGone ? '（已不在成員清單）' : ''}</option>)}
            </select>
            {ownerGone && <span title="這位負責人已不在工程師成員清單（帳號已停用或刪除，或已被移除），請改派給其他人" style={{ fontSize: 10.5, color: OVER, padding: '0 6px', lineHeight: 1.2, fontWeight: 500, cursor: 'help', whiteSpace: 'nowrap' }}>⚠ 已不在清單</span>}
          </div>
        </div>
        <div style={cell}>
          <CellText multiline grow enterBlur className="cin" value={r.custOwner} onCommit={set('custOwner')} disabled={ro} placeholder="客戶窗口" style={cin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', wordBreak: 'break-word' })} />
        </div>
        <div style={cell}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
            <select className="cin" value={r.machine || ''} disabled={ro} onChange={(e) => set('machine')(e.target.value)} style={cin({ cursor: ro ? 'default' : 'pointer', fontFamily: MONO, fontSize: 12 })}>
              <option value="">—</option>
              {machineOpts.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {!cu && clash && clash.length > 0 && <span title={'與生產排程時間重疊：\n' + clash.map((p) => `${p.start} → ${p.end}  ${[p.group, p.product].filter(Boolean).join(' · ').replace(/\n/g, ' ')}`).join('\n')} style={{ fontSize: 10.5, color: CLASH, padding: '0 6px', lineHeight: 1.2, fontWeight: 500, cursor: 'help' }}>⚠ 生產重疊 {clash.length}</span>}
          </div>
        </div>
        <div style={{ ...cell, padding: '4px 6px' }}>
          <select value={r.status} disabled={ro} onChange={(e) => set('status')(e.target.value)}
            style={{ width: '100%', height: 26, border: 'none', borderRadius: 13, padding: '0 8px', fontSize: 12, fontWeight: 500, cursor: ro ? 'default' : 'pointer', background: stBg, color: stFg }}>
            {STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={cell}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
            <input className="cin" type="date" value={r.due || ''} disabled={ro} onChange={(e) => set('due')(e.target.value)} style={cin({ fontFamily: MONO, fontSize: 12, color: dueFg, padding: '0 4px', fontWeight: dinfo ? 600 : 400 })} />
            {dinfo && <span style={{ fontSize: 10.5, color: dinfo.fg, padding: '0 5px', lineHeight: 1.2, fontWeight: 500 }}>{dinfo.kind === 'soon' ? '⏰ ' : ''}{dinfo.text}</span>}
          </div>
        </div>
        {!cu && <>
        <div style={{ ...cell, gap: 6 }}>
          <CellText className="cin" value={String(r.days ?? '')} disabled={ro} onCommit={(v) => set('days')(v === '' ? '' : Number(v))}
            style={cin({ width: 52, fontFamily: MONO, fontSize: 12, textAlign: 'right', padding: '0 6px' })} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span style={{ fontSize: 11, color: V.muted }}>{S.settings.workdays ? '工作天' : '天'}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: V.faint, whiteSpace: 'nowrap' }}>{startLabel}</span>
          </div>
        </div>
        <div style={{ ...cell, padding: '4px 6px' }}>
          <select value={r.priority} disabled={ro} onChange={(e) => set('priority')(e.target.value)}
            style={{ width: '100%', height: 26, border: `1px solid ${prBd}`, borderRadius: 5, padding: '0 6px', fontSize: 12, cursor: ro ? 'default' : 'pointer', background: prBg, color: prFg }}>
            {PRIO.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        </>}
        <div style={cell}>
          <CellText multiline grow className="cin" value={r.remark} onCommit={set('remark')} disabled={ro} placeholder="備註"
            style={cin({ height: 'auto', minHeight: 30, padding: '5px 8px', lineHeight: 1.45, resize: 'none', overflow: 'hidden', color: V.ink2 })} />
        </div>
        {!cu && <>
        <div style={{ ...cell, padding: '4px 6px' }}>
          <button className="logcell" onClick={onLogs} title={logs.length ? '查看／新增進度紀錄' : '新增進度紀錄'}
            style={{ width: '100%', minHeight: 30, textAlign: 'left', border: `1px solid ${lastLog ? V.line : 'transparent'}`, background: lastLog ? V.tint : 'transparent', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, color: V.ink2 }}>
            {lastLog ? (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: V.muted2, width: '100%' }}>
                  <span style={{ fontFamily: MONO }}>{lastLog.date ? lastLog.date.slice(5).replace('-', '/') : ''}</span>
                  {lastLog.author && <span>{lastLog.author}</span>}
                  <span style={{ marginLeft: 'auto', fontFamily: MONO, color: V.faint }}>共 {logs.length} 則</span>
                </span>
                <span style={{ fontSize: 12, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{lastLog.text}</span>
              </>
            ) : <span style={{ fontSize: 12, color: V.faint }}>{ro ? '—' : '＋ 紀錄'}</span>}
          </button>
        </div>
        <div style={{ ...cell, flexWrap: 'wrap', gap: 4, alignContent: 'center' }}>
          {files.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%', background: V.tint, border: `1px solid ${V.line2}`, borderRadius: 4, padding: '2px 4px 2px 6px', fontSize: 11 }}>
              {f.kind === 'link' && /^\\\\/.test(f.url)
                ? <a href="#" onClick={(e) => { e.preventDefault(); copyText(f.url).then((ok) => S.say(ok ? '已複製網路磁碟路徑，請貼到檔案總管開啟。' : f.url)); }} title={f.url + '\n（點一下複製路徑）'} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>📁 {f.name}</a>
                : <a href={f.url || '/_blob/' + f.assetId} {...(f.kind === 'link' ? {} : { download: f.name })} target="_blank" rel="noreferrer" title={f.kind === 'link' ? f.url : f.name} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{f.kind === 'link' ? '🔗 ' : ''}{f.name}</a>}
              <button disabled={ro} onClick={() => S.delFile(r.id, f)} title="移除" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: V.faint, fontSize: 12, padding: '0 2px', lineHeight: 1 }}>×</button>
            </div>
          ))}
          {S.canUpload && !ro && (
            <label className="file-add" title="夾帶檔案" style={addChip}>
              ＋ 檔案
              <input type="file" multiple style={{ display: 'none' }} onChange={async (e) => {
                const picked = Array.from(e.target.files || []); e.target.value = '';
                for (const f of picked) { try { await S.addFile(r.id, await S.upload(f)); } catch (err) { S.say(uploadMsg(f.name, err)); } }
              }} />
            </label>
          )}
          {!ro && <LinkAdd onAdd={(f) => S.addFile(r.id, f)} />}
          {files.length === 0 && ro && <span style={{ fontSize: 12, color: V.faint }}>—</span>}
        </div>
        <div style={{ ...cell, fontFamily: MONO, fontSize: 11, color: V.muted2, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}>
          <span>{r.updated || '—'}</span>
          {r.updatedBy && <span style={{ fontFamily: 'inherit', fontSize: 10.5, color: V.faint, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.updatedBy}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {!ro && <TabMove S={S} cur={r.customer} onMove={(t) => S.moveRowTab(r.id, t).then(() => S.say(`已移到「${tabName(S, t)}」`))} />}
          <RowDelete disabled={ro} onDelete={() => S.del(r.id)} />
        </div>
        </>}
      </div>
      {over === 'after' && <div style={{ ...line, bottom: -5 }} />}
    </div>
  );
}

export { WorkCard };
