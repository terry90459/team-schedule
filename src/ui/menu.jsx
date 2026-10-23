import React, { useState, useEffect, useRef } from 'react';

/* ============================================================
   下拉選單：按鈕＋彈出面板（固定定位，捲動的表格裡也不會被裁掉）
   點外面、按 Esc、捲動或改變視窗大小都會關閉
   children 可以是函式：children(close)
   ============================================================ */
function Dropdown({ label, btnClass = 'btn', title, ariaLabel, children, align = 'right', width = 240, disabled, btnStyle }) {
  const [pos, setPos] = useState(null);
  const btn = useRef(null), pop = useRef(null);
  const close = () => setPos(null);
  const toggle = () => {
    if (pos) return close();
    const r = btn.current.getBoundingClientRect();
    const w = Math.min(width, innerWidth - 16);
    const left = Math.max(8, Math.min(align === 'right' ? r.right - w : r.left, innerWidth - w - 8));
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    setPos(below >= 220 || below >= above
      ? { left, width: w, top: r.bottom + 4, maxHeight: below }
      : { left, width: w, bottom: innerHeight - r.top + 4, maxHeight: above });
  };
  useEffect(() => {
    if (!pos) return;
    const key = (e) => { if (e.key === 'Escape') { close(); btn.current && btn.current.focus(); } };
    const scroll = (e) => { if (!pop.current || !pop.current.contains(e.target)) close(); };
    window.addEventListener('keydown', key); window.addEventListener('resize', close); document.addEventListener('scroll', scroll, true);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('resize', close); document.removeEventListener('scroll', scroll, true); };
  }, [pos]);
  return (
    <>
      <button ref={btn} type="button" className={btnClass} style={btnStyle} title={title} aria-label={ariaLabel} disabled={disabled}
        aria-haspopup="menu" aria-expanded={!!pos} onClick={toggle}>{label}</button>
      {pos && (
        <>
          <div className="pop-veil" onClick={close} />
          <div ref={pop} role="menu" className="pop pop-fixed" style={{ ...pos, overflow: 'auto' }}>
            {typeof children === 'function' ? children(close) : children}
          </div>
        </>
      )}
    </>
  );
}

// 選單項目
function MenuItem({ onClick, children, hint, danger, disabled, title }) {
  return <button type="button" role="menuitem" className={'mi' + (danger ? ' danger' : '')} onClick={onClick} disabled={disabled} title={title}>{children}{hint && <span className="k">{hint}</span>}</button>;
}

// 需要按兩次的危險動作（刪除）：第一次變成「再按一次確認」
function ConfirmItem({ onConfirm, children, confirmText = '再按一次確認刪除', disabled }) {
  const [ask, setAsk] = useState(false);
  return <MenuItem danger disabled={disabled} onClick={() => (ask ? onConfirm() : setAsk(true))}>{ask ? confirmText : children}</MenuItem>;
}

// ⓘ 說明：預設收起，點一下展開（記在這台瀏覽器）
function InfoToggle({ id, label = '說明', children }) {
  const k = 'info.' + id;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } });
  const flip = () => { setOpen((o) => { try { localStorage.setItem(k, o ? '0' : '1'); } catch (e) {} return !o; }); };
  return (
    <>
      <button type="button" className="info-toggle" onClick={flip} aria-expanded={open}>ⓘ {open ? '收起' + label : label}</button>
      {open && <div className="info-box">{children}</div>}
    </>
  );
}

export { Dropdown, MenuItem, ConfirmItem, InfoToggle };
