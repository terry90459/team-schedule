import React, { useState, useEffect, useRef } from 'react';
import { MONO, PRIO, STATUS, V } from '../lib/theme';
import { byName, lsGet, lsSet, md, s2d, todayStr } from '../lib/util';
import { backDays, dueInfo } from '../data/derive';
import { CellText } from '../ui/common';
import { tabName } from '../ui/tabs';
import { StatusPill } from './ItemRow';
import { FileList } from './files';
import { LogEntry, sortLogs } from './logs';

/* ============================================================
   V2：工作詳情（右側面板）——所有欄位都在這裡改；清單只負責看
   客戶帳號：全部唯讀，看不到紀錄與附件
   ============================================================ */
function ItemDetail({ id, S, onClose, clash }) {
  const r = S.rows.find((x) => x.id === id);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  if (!r) return (
    <aside className="detail" aria-label="工作詳情">
      <div className="d-head"><div className="d-top">工作詳情<button className="d-close" onClick={onClose} aria-label="關閉">×</button></div></div>
      <div className="empty"><b>找不到這筆工作</b>可能已被刪除，或移到你看不到的分頁。</div>
    </aside>
  );
  const ro = !S.canEdit, cu = S.isCust;
  const set = (k) => (v) => S.patch(r.id, { [k]: v });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const di = dueInfo(r, today);
  const start = r.due && r.days ? backDays(s2d(r.due), Math.max(1, Math.ceil(Number(r.days))), !!S.settings.workdays) : null;
  const ownerOpts = r.owner && !S.owners.includes(r.owner) ? [...S.owners, r.owner] : S.owners;
  const machineOpts = [...new Set([...(S.machines || []), ...(r.machine ? [r.machine] : [])])].sort(byName);
  const sel = (k, opts, extra) => (
    <select className="d-in" value={r[k] || ''} disabled={ro} onChange={(e) => set(k)(e.target.value)} {...extra}>
      {opts}
    </select>
  );
  return (
    <aside className="detail" aria-label="工作詳情">
      <div className="d-head">
        <div className="d-top">
          <span>工作詳情</span>
          {!cu && S.customers.length > 1 && <span>・{tabName(S, r.customer)}</span>}
          <button className="d-close" onClick={onClose} title="關閉（Esc）" aria-label="關閉">×</button>
        </div>
        <CellText key={r.id} multiline grow enterBlur className="d-title" value={r.item} onCommit={set('item')} disabled={ro} placeholder="輸入工作項目…" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusPill status={r.status} ro={ro} onChange={set('status')} />
          {di && <span style={{ fontSize: 12, fontWeight: 600, color: di.fg }}>{di.text}</span>}
          {clash && clash.length > 0 && <span className="tag cl" title={clash.map((p) => `${p.start} → ${p.end}  ${[p.group, p.product].filter(Boolean).join(' · ')}`).join('\n')}>與 {clash.length} 筆生產排程撞期</span>}
        </div>
      </div>
      <div className="d-body">
        <div className="d-fields">
          <label>負責人</label>
          {sel('owner', <><option value="">（未指派）</option>{ownerOpts.map((o) => <option key={o} value={o}>{o}{o === r.owner && !S.owners.includes(o) && !cu ? '（已不在成員清單）' : ''}</option>)}</>, { 'aria-label': '負責人' })}
          <label>機台</label>
          {sel('machine', <><option value="">（未指定）</option>{machineOpts.map((m) => <option key={m} value={m}>{m}</option>)}</>, { 'aria-label': '機台', style: { fontFamily: MONO, fontSize: 12.5 } })}
          <label>截止日</label>
          <input className="d-in" type="date" aria-label="截止日" value={r.due || ''} disabled={ro} onChange={(e) => set('due')(e.target.value)} style={{ fontFamily: MONO, fontSize: 12.5, color: di ? di.fg : undefined }} />
          <label>預計天數</label>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CellText key={r.id + 'd'} className="d-in" value={String(r.days ?? '')} disabled={ro} onCommit={(v) => set('days')(v === '' ? '' : Number(v))} style={{ width: 70, fontFamily: MONO, textAlign: 'right' }} />
            <span className="hint">{S.settings.workdays ? '工作天' : '天'}{start ? `・${md(start)} 開始` : ''}</span>
          </span>
          {!cu && <><label>優先度</label>{sel('priority', PRIO.map((o) => <option key={o} value={o}>{o}</option>), { 'aria-label': '優先度' })}</>}
          <label>客戶窗口</label>
          <CellText key={r.id + 'c'} className="d-in" value={r.custOwner} onCommit={set('custOwner')} disabled={ro} placeholder="—" />
          {!cu && S.customers.length > 1 && <>
            <label>客戶分頁</label>
            <select className="d-in" aria-label="客戶分頁" value={r.customer || ''} disabled={ro} onChange={(e) => S.moveRowTab(r.id, e.target.value).then(() => S.say(`已移到「${tabName(S, e.target.value)}」`))}>
              {!S.customers.some((c) => c.id === r.customer) && <option value={r.customer || ''}>⚠ 未分類</option>}
              {S.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.internal ? '（內部）' : ''}</option>)}
            </select>
          </>}
          <label style={{ alignSelf: 'start', paddingTop: 8 }}>備註</label>
          <CellText key={r.id + 'r'} multiline grow className="d-in" value={r.remark} onCommit={set('remark')} disabled={ro} placeholder="—" style={{ resize: 'none', overflow: 'hidden' }} />
          {!cu && <><label style={{ alignSelf: 'start', paddingTop: 6 }}>附件</label><div style={{ padding: '4px 0 0 4px' }}><FileList r={r} S={S} ro={ro} wide /></div></>}
        </div>
        {!cu && <LogSection r={r} S={S} ro={ro} />}
      </div>
      {!cu && (
        <div className="d-foot">
          <span className="hint mono">{r.updated ? `更新 ${r.updated.slice(5)}${r.updatedBy ? '・' + r.updatedBy : ''}` : ''}</span>
          {!ro && <DeleteBtn onDelete={() => { onClose(); S.del(r.id); }} />}
        </div>
      )}
    </aside>
  );
}

// 刪除：按兩次（第一次變紅色確認）
function DeleteBtn({ onDelete, label = '刪除這筆' }) {
  const [ask, setAsk] = useState(false);
  return <button className={'btn btn-sm' + (ask ? '' : ' btn-ghost')} onMouseLeave={() => setAsk(false)} onClick={() => (ask ? onDelete() : setAsk(true))}
    style={{ marginLeft: 'auto', ...(ask ? { background: 'var(--over)', borderColor: 'var(--over)', color: '#fff' } : { color: 'var(--over)' }) }}>{ask ? '再按一次確認刪除' : label}</button>;
}

// 進度紀錄：上面寫、下面依時間列出
function LogSection({ r, S, ro }) {
  const logs = sortLogs(S.logs.filter((l) => l.rowId === r.id));
  const [date, setDate] = useState(todayStr);
  const [author, setAuthor] = useState(() => S.me || lsGet('log.author') || r.owner || '');
  const [text, setText] = useState('');
  const ta = useRef(null);
  const authors = author && !S.owners.includes(author) ? [...S.owners, author] : S.owners;
  const submit = () => {
    const t = text.trim(); if (!t) return;
    S.addLog({ rowId: r.id, date: date || todayStr(), author, text: t });
    lsSet('log.author', author); setText('');
  };
  return (
    <div className="d-sec">
      <h3>進度紀錄<span className="mono muted" style={{ fontSize: 11, fontWeight: 400 }}>{logs.length} 則</span></h3>
      {!ro && (
        <div style={{ border: `1px solid ${V.line2}`, borderRadius: 10, marginBottom: 14, background: V.surface }}>
          <textarea ref={ta} value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="新增進度紀錄" placeholder="做了什麼、遇到什麼問題、下一步…"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); } }}
            style={{ width: '100%', border: 'none', borderRadius: '10px 10px 0 0', padding: '10px 12px', fontSize: 13, lineHeight: 1.5, resize: 'vertical', background: 'transparent', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 8px', borderTop: `1px solid ${V.line}` }}>
            <input type="date" aria-label="紀錄日期" value={date} onChange={(e) => setDate(e.target.value)} className="d-in" style={{ width: 132, height: 28, fontFamily: MONO, fontSize: 12 }} />
            <select aria-label="紀錄人" value={author} onChange={(e) => setAuthor(e.target.value)} className="d-in" style={{ width: 'auto', height: 28, fontSize: 12 }}>
              <option value="">（未填紀錄人）</option>
              {authors.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <span className="hint" style={{ marginLeft: 'auto' }}>Ctrl+Enter</span>
            <button className="btn btn-sm btn-primary" disabled={!text.trim()} onClick={submit}>新增</button>
          </div>
        </div>
      )}
      {logs.length === 0
        ? <div className="hint" style={{ padding: '8px 0' }}>還沒有進度紀錄。</div>
        : logs.map((l) => <LogEntry key={l.id} l={l} S={S} ro={ro} authors={S.owners} />)}
    </div>
  );
}

export { ItemDetail, DeleteBtn };
