import React, { useState, useEffect, useRef } from 'react';
import { V } from '../lib/theme';
import { av } from '../lib/util';

/* ============================================================
   小元件
   ============================================================ */
function CellText({ value, onCommit, placeholder, style, multiline, disabled, list, rows, className, grow, enterBlur }) {
  const [v, setV] = useState(value || '');
  const ta = useRef(null);
  const fit = () => { const e = ta.current; if (grow && e) { e.style.height = 'auto'; e.style.height = e.scrollHeight + 2 + 'px'; } };
  useEffect(fit, [v]);
  useEffect(() => { const e = ta.current; if (!grow || !e || !window.ResizeObserver) return; let w = e.offsetWidth; const ro = new ResizeObserver(() => { if (e.offsetWidth !== w) { w = e.offsetWidth; fit(); } }); ro.observe(e); return () => ro.disconnect(); }, [grow]);
  useEffect(() => { if (!grow) return; window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, [grow]);
  const focused = useRef(false);
  const dirty = useRef(false);
  useEffect(() => { if (!focused.current) setV(value || ''); }, [value]);
  const commit = () => {
    focused.current = false;
    if (dirty.current && v !== (value || '')) onCommit(v);
    dirty.current = false;
  };
  const p = {
    value: v, placeholder, disabled, list, style, className,
    onFocus: () => { focused.current = true; },
    onChange: (e) => { dirty.current = true; setV(e.target.value); },
    onBlur: commit,
  };
  return multiline
    ? <textarea ref={ta} rows={rows || 1} {...p} onKeyDown={enterBlur ? (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } } : undefined} />
    : <input {...p} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

function Avatar({ name, size = 22 }) {
  const a = av(name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, flex: 'none', background: a.avBg, color: a.avFg }}>
      {a.initial}
    </div>
  );
}

const darkBtn = { height: 32, padding: '0 14px', border: 'none', background: V.btnBg, color: V.btnFg, borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const lineBtn = { height: 32, padding: '0 12px', border: `1px solid ${V.line2}`, background: V.surface, borderRadius: 7, cursor: 'pointer', fontSize: 13 };


const FSEL = { height: 30, padding: '0 8px', border: `1px solid ${V.line2}`, background: V.surface, borderRadius: 7, cursor: 'pointer', fontSize: 12 };
const FON = { borderColor: V.btnBg, background: V.btnBg, color: V.btnFg };
const cin = (extra) => ({ height: 30, width: '100%', minWidth: 0, border: '1px solid transparent', borderRadius: 6, background: 'transparent', padding: '0 8px', fontSize: 13, ...extra });
const mvBtn = { border: 'none', background: 'transparent', color: V.faint, fontSize: 15, lineHeight: 1, width: 20, height: 30, borderRadius: 6, padding: 0, cursor: 'pointer' };
const addChip = { display: 'flex', alignItems: 'center', height: 22, padding: '0 7px', border: `1px dashed ${V.line3}`, borderRadius: 4, fontSize: 11, color: V.muted2, cursor: 'pointer', background: 'transparent' };
const fld = { height: 32, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 8px', fontSize: 13, background: V.surface, minWidth: 0 };
const gridOf = (w) => w.map((x) => x + 'px').join(' ');
// 欄寬可拖曳調整（記在各人瀏覽器）；fixed = 不可調的欄位索引
function useCols(key, W0, MIN, fixed = []) {
  const [cols, setCols] = useState(() => { try { const a = JSON.parse(localStorage.getItem(key)); if (Array.isArray(a) && a.length === W0.length) return a.map((x, i) => fixed.includes(i) ? W0[i] : Math.max(MIN[i], Number(x) || W0[i])); } catch (e) {} return W0; });
  const save = (w) => { try { localStorage.setItem(key, JSON.stringify(w)); } catch (e) {} };
  const start = (i, e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = cols[i]; let cur = cols;
    const mv = (ev) => { cur = cols.map((w, j) => j === i ? Math.max(MIN[i], w0 + ev.clientX - x0) : w); setCols(cur); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); document.body.style.userSelect = ''; save(cur); };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const reset = (i) => { const w = cols.map((x, j) => j === i ? W0[i] : x); setCols(w); save(w); };
  return [cols, start, reset];
}
// 提示列：放在捲動區外面，不會被固定的表頭蓋住
function HintBar({ children }) {
  return <div style={{ flex: 'none', padding: '7px 24px', fontSize: 12, lineHeight: 1.5, color: V.muted, background: V.tint, borderBottom: `1px solid ${V.line}` }}>ⓘ {children}</div>;
}
function RowDelete({ onDelete, disabled }) {
  const [ask, setAsk] = useState(false);
  return (
    <div style={{ display: 'grid', placeItems: 'center' }} onMouseLeave={() => setAsk(false)}>
      {ask ? (
        <button onClick={() => { onDelete(); setAsk(false); }} title="再按一次確認刪除"
          style={{ height: 26, padding: '0 7px', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>確認</button>
      ) : (
        <button className="del" disabled={disabled} onClick={() => setAsk(true)} title="刪除此列" aria-label="刪除此列"
          style={{ width: 26, height: 26, border: 'none', background: 'transparent', borderRadius: 5, cursor: disabled ? 'default' : 'pointer', color: V.faint, fontSize: 15 }}>×</button>
      )}
    </div>
  );
}
const card = { background: V.surface, border: `1px solid ${V.line}`, borderRadius: 10 };

export { CellText, Avatar, darkBtn, lineBtn, FSEL, FON, cin, mvBtn, addChip, fld, gridOf, useCols, HintBar, RowDelete, card };
