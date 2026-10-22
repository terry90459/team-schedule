import React, { useState, useEffect } from 'react';
import { OVER, SOON, V } from '../lib/theme';
import { FON, FSEL, card, darkBtn, fld, lineBtn } from '../ui/common';

/* ============================================================
   帳號：登入／註冊／待核准／帳號管理（Supabase Auth）
   ============================================================ */
const ROLE_LABEL = { viewer: '只能看', engineer: '工程師', planner: 'Planner', admin: '管理員', customer: '客戶' };
const ROLE_HINT = { viewer: '全部只能看', engineer: '改工程清單、進度紀錄；生產排程只能看', planner: '改機台生產排程；工程清單只能看', admin: '全部都能改，含帳號、成員、機台、設定', customer: '外部客戶：只看得到指定分頁的工程清單與生產排程（部分欄位），不能修改' };
const authErr = (e) => {
  const m = (e && e.message) || '';
  if (/Invalid login credentials/i.test(m)) return 'email 或密碼錯誤。';
  if (/Email not confirmed/i.test(m)) return '這個帳號還沒完成 email 確認。請管理員到 Supabase 關閉「Confirm email」，或在後台手動確認這個帳號。';
  if (/already registered|already exists/i.test(m)) return '這個 email 已經註冊過了，請直接登入。';
  if (/Password should be at least/i.test(m)) return '密碼至少要 6 個字元。';
  if (e && e.notAllowed) return '這個信箱不在允許註冊的名單內。請確認信箱有沒有打錯，或聯絡管理員把你的信箱加入名單。';
  if (/Database error saving new user|不在允許註冊名單/i.test(m)) return '註冊失敗：這個信箱可能不在允許註冊的名單內，請聯絡管理員。';
  if (/rate limit/i.test(m)) return '嘗試太多次，請過幾分鐘再試。';
  if (/fetch|network/i.test(m)) return '連不到伺服器，請檢查網路。';
  return m || '發生錯誤，請再試一次。';
};
function AuthShell({ children }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 16, overflow: 'auto' }}>
      <div style={{ width: 380, maxWidth: '100%', ...card, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>團隊工程清單與排程</div>
        {children}
      </div>
    </div>
  );
}
function AuthPage({ sb }) {
  const [tab, setTab] = useState('in');
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [name, setName] = useState('');
  const [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (tab === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else {
        if (!name.trim()) throw { message: '請填顯示名稱' };
        // 先確認信箱在允許名單內（舊版資料庫沒有這個函式時略過，交給資料庫判斷）
        const chk = await sb.rpc('email_allowed', { e: email.trim() });
        if (!chk.error && chk.data === false) throw { notAllowed: true };
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: '註冊成功。這個 Supabase 專案有開啟 email 確認，請先到信箱點確認連結再登入。' });
      }
    } catch (err) { setMsg({ ok: false, text: authErr(err) }); }
    setBusy(false);
  };
  const tb = (k, l) => <button type="button" onClick={() => { setTab(k); setMsg(null); }} style={{ ...FSEL, flex: 1, height: 34, fontSize: 13, ...(tab === k ? FON : null) }}>{l}</button>;
  return (
    <AuthShell>
      <div style={{ display: 'flex', gap: 6 }}>{tb('in', '登入')}{tb('up', '註冊新帳號')}</div>
      <form onSubmit={go} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'up' && (
          <label style={lbl}>顯示名稱<input value={name} onChange={(e) => setName(e.target.value)} placeholder="建議跟團隊成員名稱相同" style={fld} /></label>
        )}
        <label style={lbl}>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={fld} /></label>
        <label style={lbl}>密碼<input type="password" autoComplete={tab === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} style={fld} /></label>
        {tab === 'up' && <div style={{ fontSize: 11.5, color: V.muted2, lineHeight: 1.6 }}>請用工作用的信箱註冊，不要用公司電腦的開機密碼。註冊後要等管理員核准才看得到資料。</div>}
        {msg && <div style={{ fontSize: 12.5, lineHeight: 1.6, color: msg.ok ? 'oklch(0.45 0.1 155)' : OVER }}>{msg.text}</div>}
        <button type="submit" disabled={busy} className="btn-dark" style={{ ...darkBtn, height: 36, opacity: busy ? 0.6 : 1 }}>{busy ? '處理中…' : tab === 'in' ? '登入' : '註冊'}</button>
      </form>
      {tab === 'in' && <div style={{ fontSize: 11.5, color: V.muted2 }}>忘記密碼請聯絡管理員。</div>}
    </AuthShell>
  );
}
const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: V.muted };
function PendingPage({ sb, profile }) {
  const st = profile.role === 'none' ? 'none' : profile.status;
  const msg = {
    pending: { title: '帳號尚未核准', body: '你的帳號已經註冊，正在等待管理員核准。核准後這個頁面會自動進入，不用重新登入。', fg: SOON.fg },
    disabled: { title: '帳號已被停用', body: '這個帳號目前無法使用。如果需要恢復，請聯絡管理員。', fg: OVER },
    none: { title: '找不到帳號資料', body: '這個帳號可能已被刪除。如果需要使用，請聯絡管理員。', fg: OVER },
  }[st] || { title: '帳號無法使用', body: '請聯絡管理員。', fg: OVER };
  return (
    <AuthShell>
      <div style={{ fontSize: 16, fontWeight: 700, color: msg.fg }}>{msg.title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{profile.name && <>你好，<b>{profile.name}</b>。</>}{msg.body}</div>
      <div style={{ fontSize: 12, color: V.muted2 }}>{profile.email}</div>
      <button onClick={() => sb.auth.signOut()} style={lineBtn}>登出</button>
    </AuthShell>
  );
}
function useProfiles(sb, on) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!sb || !on) return;
    let alive = true;
    const load = () => sb.from('profiles').select('*').order('created_at').then(({ data }) => { if (alive && data) setList(data); });
    load();
    const ch = sb.channel('rt-profiles-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load).subscribe();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); sb.removeChannel(ch); };
  }, [sb, on]);
  return [list, setList];
}
const STATUS_LABEL = { pending: '待核准', active: '使用中', disabled: '已停用' };
const STATUS_TONE = { pending: [SOON.bg, SOON.fg], active: ['oklch(0.94 0.04 155)', 'oklch(0.4 0.1 155)'], disabled: ['oklch(0.93 0.01 80)', 'oklch(0.45 0.01 80)'] };
const dbErr = (e) => {
  const m = (e && e.message) || '';
  if (/至少要保留/.test(m)) return '至少要保留一位管理員。';
  if (/最高管理員/.test(m)) return m.replace(/^.*?(最高管理員)/, '$1') + '。';
  if (/只有最高管理員/.test(m)) return '只有最高管理員可以刪除帳號。';
  return m || '未知原因';
};

export { ROLE_LABEL, ROLE_HINT, authErr, AuthShell, AuthPage, lbl, PendingPage, useProfiles, STATUS_LABEL, STATUS_TONE, dbErr };
