import React, { useState } from 'react';
import { V } from '../lib/theme';
import { lsGet, lsSet } from '../lib/util';

/* 設定：日曆天／工作天（全體共用，管理員才能改）、深淺色（只影響這台電腦） */
const THEMES = [['light', '淺色'], ['dark', '深色'], ['auto', '跟隨電腦']];
const applyTheme = (t) => { const r = document.documentElement; if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); };
function SettingsPanel({ S }) {
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
    <div style={{ padding: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>預計天數怎麼算<span style={{ fontWeight: 400, color: V.muted2 }}>（全體共用{S.canAdmin ? '' : '，只有管理員能改'}）</span></div>
      {opt(false, '日曆天', '含週末，從截止日往回推')}
      {opt(true, '只算工作天', '跳過週六、週日與國定假日（補班日照算）')}
      <div style={{ fontSize: 12, fontWeight: 600, margin: '10px 0 6px', paddingTop: 10, borderTop: `1px solid ${V.line}` }}>外觀<span style={{ fontWeight: 400, color: V.muted2 }}>（只影響這台電腦）</span></div>
      <div className="seg" style={{ display: 'flex' }}>
        {THEMES.map(([k, l]) => <button key={k} className={theme === k ? 'on' : ''} onClick={() => setTheme(k)} style={{ flex: 1 }}>{l}</button>)}
      </div>
    </div>
  );
}

export { THEMES, applyTheme, SettingsPanel };
