import React, { useState, useEffect, useRef } from 'react';
import { MONO, ST, V } from '../lib/theme';
import { lsGet, lsSet, todayStr } from '../lib/util';
import { Avatar, darkBtn, fld, lineBtn } from '../ui/common';

/* ============================================================
   C2：進度紀錄（右側抽屜）—— 資料在 logs 資源，rowId 指向工程項目
   ============================================================ */
const sortLogs = (l) => [...l].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || '').localeCompare(a.created || ''));

function LogEntry({ l, S, ro, authors }) {
  const [edit, setEdit] = useState(false);
  const [ask, setAsk] = useState(false);
  const [d, setD] = useState(l.date || '');
  const [a, setA] = useState(l.author || '');
  const [t, setT] = useState(l.text || '');
  const open = () => { setD(l.date || ''); setA(l.author || ''); setT(l.text || ''); setEdit(true); };
  const save = () => { const x = t.trim(); if (!x) return; S.patchLog(l.id, { date: d || todayStr(), author: a, text: x }); setEdit(false); };
  const small = { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: V.muted2, padding: '2px 6px', borderRadius: 4 };
  const opts = a && !authors.includes(a) ? [...authors, a] : authors;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr)', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: V.accent, marginTop: 5, flex: 'none' }} />
        <span style={{ flex: 1, width: 1, background: V.line2, marginTop: 4 }} />
      </div>
      <div style={{ paddingBottom: 16, minWidth: 0 }}>
        {edit ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="date" value={d} onChange={(e) => setD(e.target.value)} style={{ ...fld, fontFamily: MONO, fontSize: 12, width: 140 }} />
              <select value={a} onChange={(e) => setA(e.target.value)} style={{ ...fld, flex: 1 }}>
                <option value="">（未填紀錄人）</option>
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <textarea value={t} onChange={(e) => setT(e.target.value)} rows={4} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); if (e.key === 'Escape') { e.stopPropagation(); setEdit(false); } }}
              style={{ ...fld, height: 'auto', padding: '6px 8px', lineHeight: 1.5, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => setEdit(false)} style={{ ...lineBtn, height: 28, fontSize: 12 }}>取消</button>
              <button onClick={save} disabled={!t.trim()} style={{ ...darkBtn, height: 28, fontSize: 12, opacity: t.trim() ? 1 : 0.5 }}>儲存</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{l.date || '—'}</span>
              {l.author && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: V.muted }}><Avatar name={l.author} size={18} />{l.author}</span>}
              {!ro && (
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }} onMouseLeave={() => setAsk(false)}>
                  <button className="mv" onClick={open} style={small}>編輯</button>
                  {ask
                    ? <button onClick={() => S.delLog(l.id)} style={{ ...small, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>確認刪除</button>
                    : <button className="del" onClick={() => setAsk(true)} style={small}>刪除</button>}
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: V.ink }}>{l.text}</div>
            {l.updated && l.updated !== l.created && <div style={{ marginTop: 2, fontFamily: MONO, fontSize: 10, color: V.faint }}>已編輯 {l.updated}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function LogDrawer({ row, S, ro, onClose }) {
  const logs = sortLogs(S.logs.filter((l) => l.rowId === row.id));
  const [date, setDate] = useState(todayStr);
  const [author, setAuthor] = useState(() => lsGet('log.author') || row.owner || '');
  const [text, setText] = useState('');
  const ta = useRef(null);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { if (!ro && ta.current) ta.current.focus(); }, [row.id]);
  const authors = author && !S.owners.includes(author) ? [...S.owners, author] : S.owners;
  const submit = () => {
    const t = text.trim(); if (!t) return;
    S.addLog({ rowId: row.id, date: date || todayStr(), author, text: t });
    lsSet('log.author', author);
    setText('');
  };
  const [stBg, stFg] = ST[row.status] || ST['未開始'];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,19,17,0.25)', zIndex: 40 }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '96vw', background: V.surface, borderLeft: `1px solid ${V.line2}`, boxShadow: '-16px 0 40px rgba(0,0,0,0.18)', zIndex: 41, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${V.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: V.muted2 }}>進度紀錄</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: V.faint }}>{logs.length} 則</span>
            <button onClick={onClose} title="關閉（Esc）" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: V.muted, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{row.item || '（未命名）'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: V.muted }}>
            <span style={{ fontSize: 11, borderRadius: 10, padding: '2px 8px', background: stBg, color: stFg }}>{row.status}</span>
            {row.owner && <span>{row.owner}</span>}
            {row.machine && <span style={{ fontFamily: MONO }}>{row.machine}</span>}
            {row.custOwner && <span>客戶 {row.custOwner}</span>}
            <span style={{ fontFamily: MONO }}>{row.due ? '截止 ' + row.due : '未設截止日'}</span>
          </div>
        </div>
        {!ro && (
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${V.line}`, display: 'flex', flexDirection: 'column', gap: 8, background: V.surface2 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...fld, fontFamily: MONO, fontSize: 12, width: 140 }} />
              <select value={author} onChange={(e) => setAuthor(e.target.value)} title="紀錄人" style={{ ...fld, flex: 1 }}>
                <option value="">（未填紀錄人）</option>
                {authors.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <textarea ref={ta} value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="做了什麼、遇到什麼問題、下一步…（Ctrl+Enter 送出）"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
              style={{ ...fld, height: 'auto', padding: '6px 8px', lineHeight: 1.5, resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-dark" onClick={submit} disabled={!text.trim()} style={{ ...darkBtn, opacity: text.trim() ? 1 : 0.5 }}>新增紀錄</button>
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {logs.length === 0
            ? <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: V.muted2 }}>還沒有進度紀錄{ro ? '' : '，在上方輸入第一則。'}</div>
            : logs.map((l) => <LogEntry key={l.id} l={l} S={S} ro={ro} authors={S.owners} />)}
        </div>
      </aside>
    </>
  );
}

export { sortLogs, LogEntry, LogDrawer };
