import React, { useState, useEffect, useRef } from 'react';
import { MONO, ST, V } from '../lib/theme';
import { lsGet, lsSet, todayStr } from '../lib/util';
import { Avatar, darkBtn, fld, lineBtn } from '../ui/common';

/* ============================================================
   工作詳情（右側抽屜）：列上沒顯示的欄位（客戶窗口、天數、備註、附件）＋進度紀錄
   C2：進度紀錄—— 資料在 logs 資源，rowId 指向工程項目
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

export { sortLogs, LogEntry };
