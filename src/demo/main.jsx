// 預覽版進入點：真正的網頁程式＋模擬的 Supabase（假資料、可切換身分）
// 建置：DEMO=1 node build.mjs → dist-demo/
import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { RootSB } from '../app/App';
import { V } from '../lib/theme';
import { createFakeSupabase } from './fakeSupabase';
import { demoSeed } from './seed';

const ROLE = { admin: '管理員', engineer: '工程師', planner: 'Planner', viewer: '只能看', customer: '客戶' };
const STAT = { pending: '待核准', disabled: '已停用' };

function DemoBar({ fake, onSwitch, onReset }) {
  const [open, setOpen] = useState(false);
  const list = fake._demo.profiles();
  const me = list.find((p) => p.id === fake._demo.me());
  const desc = (p) => `${p.is_owner ? '★ 最高管理員' : ROLE[p.role] || p.role}${STAT[p.status] ? '・' + STAT[p.status] : ''}${p.role !== 'admin' && p.tabs ? '・只看 ' + p.tabs.length + ' 個分頁' : ''}`;
  return (
    <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 100, fontSize: 12.5 }}>
      {open && (
        <div style={{ marginBottom: 6, width: 300, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.2)', padding: 6 }}>
          <div style={{ padding: '6px 8px', color: V.muted2, fontSize: 11.5, lineHeight: 1.6 }}>切換成不同身分，看看每種帳號看到的畫面。資料都是假的、只存在這個分頁，重新整理就恢復原狀。</div>
          {list.map((p) => (
            <button key={p.id} onClick={() => { setOpen(false); onSwitch(p.id); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', borderRadius: 7, padding: '7px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1, background: p.id === (me && me.id) ? V.tint : 'transparent' }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: V.muted2 }}>{p.email}・{desc(p)}</span>
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${V.line}`, margin: '4px 0' }} />
          <button onClick={() => { setOpen(false); onReset(); }} style={{ width: '100%', textAlign: 'left', border: 'none', borderRadius: 7, padding: '7px 8px', cursor: 'pointer', background: 'transparent', color: V.muted }}>↺ 重設假資料</button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 17, border: 'none', cursor: 'pointer', background: 'oklch(0.55 0.15 300)', color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.25)', fontWeight: 500 }}>
        預覽版・假資料<span style={{ opacity: 0.8 }}>｜目前身分：{me ? me.name : '未登入'}</span>▴
      </button>
    </div>
  );
}

function Demo() {
  const [gen, setGen] = useState(0);
  const fake = useMemo(() => createFakeSupabase(demoSeed()), [gen]);
  const [ver, setVer] = useState(0);
  return (
    <>
      <RootSB key={gen + ':' + ver} sb={fake} />
      <DemoBar fake={fake} onSwitch={(id) => { fake._demo.as(id); setVer((v) => v + 1); }} onReset={() => { setGen((g) => g + 1); setVer(0); }} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<Demo />);
