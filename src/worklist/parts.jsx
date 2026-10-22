import React, { useState } from 'react';
import { MONO, OVER, QUIET, ST, V } from '../lib/theme';
import { dstr, validPlan } from '../lib/util';
import { addChip, darkBtn, fld, lineBtn } from '../ui/common';

/* ============================================================
   工程清單
   ============================================================ */
function RemoveOwnerModal({ name, rows, others, onConfirm, onCancel }) {
  const [plan, setPlan] = useState(() => Object.fromEntries(rows.map((r) => [r.id, others[0] || ''])));
  const open = rows.filter((r) => r.status !== '已完成').length;
  const setAll = (v) => setPlan(Object.fromEntries(rows.map((r) => [r.id, v])));
  const sel = { height: 28, border: `1px solid ${V.line2}`, borderRadius: 6, background: V.surface, padding: '0 6px', fontSize: 12, cursor: 'pointer', maxWidth: 150 };
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(20,19,17,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '18px 20px 12px' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>移除成員「{name}」</div>
          <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: V.muted }}>
            這位成員名下有 <b style={{ color: open ? OVER : V.ink }}>{rows.length} 筆</b> 工作
            {open ? <>，其中 <b style={{ color: OVER }}>{open} 筆尚未完成</b></> : null}。
            移除前請逐筆決定要改派給誰，或直接刪除。
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: V.muted }}>
            全部設為
            <select onChange={(e) => { if (e.target.value !== '__keep__') setAll(e.target.value); e.target.value = '__keep__'; }} defaultValue="__keep__" style={sel}>
              <option value="__keep__">選擇…</option>
              {others.map((o) => <option key={o} value={o}>改派給 {o}</option>)}
              <option value="">設為未指派</option>
              <option value="__del__">全部刪除</option>
            </select>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', borderTop: `1px solid ${V.line}`, borderBottom: `1px solid ${V.line}` }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', borderBottom: `1px solid ${V.line}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.item || '（未命名）'}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: V.faint }}>{r.due || '未設日期'}</div>
              </div>
              <span style={{ fontSize: 11, borderRadius: 10, padding: '2px 8px', background: ST[r.status][0], color: ST[r.status][1] }}>{r.status}</span>
              <select value={plan[r.id]} onChange={(e) => setPlan((p) => ({ ...p, [r.id]: e.target.value }))} style={{ ...sel, color: plan[r.id] === '__del__' ? OVER : 'inherit' }}>
                {others.map((o) => <option key={o} value={o}>改派給 {o}</option>)}
                <option value="">設為未指派</option>
                <option value="__del__">刪除此工作</option>
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px' }}>
          <button onClick={onCancel} style={lineBtn}>取消</button>
          <button onClick={() => onConfirm(plan)} style={darkBtn}>套用並移除成員</button>
        </div>
      </div>
    </div>
  );
}


const SORTS = [
  ['order', '自訂順序（可拖曳）'], ['due', '截止日'], ['priority', '優先度'], ['status', '狀態'],
  ['owner', '負責人'], ['days', '預計天數'], ['updated', '更新時間'],
];

// 欄位：順序, Item, Owner, Customer, Machine, Status, Due, 時間軸, Priority, Remark, Log, File, Update, 刪除
const COLW0 = [128, 320, 110, 140, 112, 104, 126, 112, 92, 240, 240, 160, 126, 36];
const COLMIN = [128, 100, 70, 80, 70, 80, 110, 90, 80, 100, 140, 100, 100, 36];
const COLS_KEY = 'worklist.cols.v3';
const HEADS = [['順序', ''], ['Item', '工作項目'], ['Owner', '負責人'], ['Customer', '客戶 Owner'], ['Machine', '機台'], ['Status', '狀態'], ['Due date', '截止日'], ['時間軸', '預計天數'], ['Priority', '優先度'], ['Remark', '備註'], ['Log', '進度紀錄'], ['File', '附件'], ['Update', '更新時間'], ['', '']];

const FILE_OK = 'PDF、圖片（png/jpg/gif/webp/svg）、影片（mp4/webm）、字型，以及 csv / md / json / txt / log';
function uploadMsg(name, err) {
  const c = err && err.code, n = `「${name}」`;
  if (c === 'unsupported_type') return `${n}無法上傳：不支援這種檔案格式。目前只支援 ${FILE_OK}。Excel、Word、壓縮檔請先轉成 csv 或 PDF。`;
  if (c === 'too_large') return `${n}無法上傳：檔案太大（一般檔案上限 20 MB，svg 2 MB）。`;
  if (c === 'quota_or_state') return `${n}無法上傳：這份頁面的附件儲存空間已滿。`;
  if (c === 'not_granted' || c === 'capability_disabled' || c === 'capability_removed') return `${n}無法上傳：目前這個檢視沒有上傳權限（僅有編輯權限的人可以上傳附件）。`;
  if (c === 'rate_limited') return `${n}上傳太頻繁，請稍後再試。`;
  if (c === 'store_unavailable' || c === 'upstream_error') return `${n}上傳失敗：平台暫時異常，請稍後再試。`;
  if (c === 'invalid_request') return `${n}無法上傳：檔案是空的，或文字檔不是 UTF-8 編碼。`;
  if (err && err.message === 'too big') return `${n}無法上傳：本機模式附件上限約 1.5 MB。`;
  return `${n}上傳失敗${c ? '（' + c + '）' : ''}。`;
}

const CLASH = 'oklch(0.55 0.15 300)';
// B8：工程項目（機台＋開始～截止）與生產排程同機台、日期重疊
function engPlanClash(drows, plans) {
  const m = new Map(), vp = plans.filter(validPlan);
  drows.forEach((r) => {
    if (!r.machine || !r.dueD || QUIET.includes(r.status)) return;
    const a = dstr(r.startD), b = r.due;
    const hit = vp.filter((p) => p.machine === r.machine && p.start <= b && a <= p.end);
    if (hit.length) m.set(r.id, hit);
  });
  return m;
}
// A4：從機台清單移除，仍有資料使用時先確認
function MachineDel({ engN, planN, onDel, disabled }) {
  const [ask, setAsk] = useState(false);
  const used = engN + planN > 0;
  if (ask) return (
    <span onMouseLeave={() => setAsk(false)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10.5, color: OVER, whiteSpace: 'nowrap' }}>{engN ? `${engN} 工程` : ''}{engN && planN ? '・' : ''}{planN ? `${planN} 排程` : ''}使用中</span>
      <button onClick={() => { setAsk(false); onDel(); }} style={{ height: 22, padding: '0 6px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>確認移除</button>
    </span>
  );
  return <button disabled={disabled} onClick={() => (used ? setAsk(true) : onDel())} title={used ? '從清單移除（已填的工作與排程仍保留此機台名稱）' : '移除'} style={{ border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', color: V.faint, fontSize: 14 }}>×</button>;
}
// C5：貼連結（docx / xlsx / 網路磁碟等不能上傳的檔案）
function LinkAdd({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const ok = /^https?:\/\/\S+$/i.test(url.trim()) || /^\\\\\S+/.test(url.trim());
  const add = () => {
    if (!ok) return;
    const u = url.trim();
    let n = name.trim();
    if (!n) { try { const x = new URL(u); n = decodeURIComponent(x.pathname.split('/').filter(Boolean).pop() || x.hostname); } catch (e) { n = u.split(/[\\/]/).filter(Boolean).pop() || u; } }
    onAdd({ kind: 'link', name: n.slice(0, 120), url: u }); setUrl(''); setName(''); setOpen(false);
  };
  return (
    <div style={{ position: 'relative' }}>
      <button className="file-add" onClick={() => setOpen((o) => !o)} title="貼上檔案連結" style={addChip}>＋ 連結</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
          <div style={{ position: 'absolute', top: 26, right: 0, width: 300, zIndex: 20, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>貼上檔案連結</div>
            <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setOpen(false); }} placeholder="https://… 或 \\server\share\…" style={{ ...fld, fontSize: 12 }} />
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="顯示名稱（可留空）" style={{ ...fld, fontSize: 12 }} />
            {url.trim() && !ok && <span style={{ fontSize: 11, color: OVER }}>請貼完整網址（http:// 或 https:// 開頭），或網路磁碟路徑（\\ 開頭）</span>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button onClick={() => setOpen(false)} style={{ ...lineBtn, height: 28, fontSize: 12 }}>取消</button>
              <button onClick={add} disabled={!ok} style={{ ...darkBtn, height: 28, fontSize: 12, opacity: ok ? 1 : 0.5 }}>加入</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { RemoveOwnerModal, SORTS, COLW0, COLMIN, COLS_KEY, HEADS, FILE_OK, uploadMsg, CLASH, engPlanClash, MachineDel, LinkAdd };
