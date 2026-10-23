import React, { useState } from 'react';
import { V } from '../lib/theme';
import { lsGet, lsSet } from '../lib/util';
import { FON, FSEL } from '../ui/common';

/* 右上角 ⚙ 設定：日曆天／工作天、主題 */
const THEMES = [['light', '淺色'], ['dark', '深色'], ['auto', '跟隨電腦設定']];
const applyTheme = (t) => { const r = document.documentElement; if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); };
function SettingsMenu({ S }) {
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(() => lsGet('theme') || 'light');
  const setTheme = (t) => { setThemeState(t); lsSet('theme', t); applyTheme(t); };
  const wd = !!S.settings.workdays;
  const opt = (v, t, sub) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 4px', cursor: S.canAdmin ? 'pointer' : 'default', fontSize: 13 }}>
      <input type="radio" name="wd" checked={wd === v} disabled={!S.canAdmin} onChange={() => S.setSetting({ workdays: v })} style={{ marginTop: 3 }} />
      <span>{t}<div style={{ fontSize: 11, color: V.muted2 }}>{sub}</div></span>
    </label>
  );
  return (
    <div style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} title="設定（天數算法、深淺色）" aria-label="設定" aria-haspopup="dialog" aria-expanded={open}>⚙</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'absolute', top: 34, right: 0, width: 280, zIndex: 30, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>預計天數怎麼算（全體共用{S.canAdmin ? '' : '，只有管理員能改'}）</div>
            {opt(false, '日曆天', '含週末，從截止日往回推')}
            {opt(true, '只算工作天', '跳過週六、週日與國定假日（補班日照算），從截止日往回推')}
            <div style={{ fontSize: 12, fontWeight: 500, margin: '10px 0 6px', paddingTop: 10, borderTop: `1px solid ${V.line}` }}>外觀（只影響這台電腦）</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {THEMES.map(([k, l]) => <button key={k} onClick={() => setTheme(k)} style={{ ...FSEL, flex: 1, height: 28, ...(theme === k ? FON : null) }}>{l}</button>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { THEMES, applyTheme, SettingsMenu };
