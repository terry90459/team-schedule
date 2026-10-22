import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { sbClient } from '../lib/config';
import { MONO, SOON, V } from '../lib/theme';
import { byName, lsGet, lsSet } from '../lib/util';
import { SCHEMA_URL, SCHEMA_VERSION } from '../data/backend';
import { useStore } from '../data/store';
import { derive } from '../data/derive';
import { Avatar, FSEL, lineBtn } from '../ui/common';
import { LogDrawer } from '../worklist/logs';
import { NO_TAB, TabBar, scopeStore } from '../ui/tabs';
import { WorklistPage } from '../worklist/WorklistPage';
import { Overview } from '../dashboard/Overview';
import { Board } from '../dashboard/Board';
import { ComboPage } from '../plan/timeline';
import { PlanPage } from '../plan/PlanPage';
import { DailyPage } from '../daily/DailyPage';
import { SettingsMenu } from './SettingsMenu';
import { AuthPage, AuthShell, PendingPage, ROLE_LABEL, useProfiles } from '../account/auth';
import { AccountsPage } from '../account/AccountsPage';

/* ---------- A4：資料庫版本檢查 ---------- */
function useDbVersion(sb) {
  const [ver, setVer] = useState(null);   // null：還不知道；0：舊版（沒有版本函式）
  const check = useCallback(() => {
    if (!sb) return;
    sb.rpc('schema_version').then(({ data, error }) => {
      if (!error) setVer(Number(data) || 0);
      else if (error.code === 'PGRST202' || /schema_version/.test(error.message || '')) setVer(0);
    });
  }, [sb]);
  useEffect(() => { check(); const t = setInterval(check, 10 * 60000); return () => clearInterval(t); }, [check]);
  return [ver, check];
}
function SchemaBanner({ ver, isAdmin, recheck }) {
  if (ver === null || ver === SCHEMA_VERSION) return null;
  const newer = ver > SCHEMA_VERSION;
  if (!newer && !isAdmin) return null;
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 24px', fontSize: 13, background: SOON.bg, color: SOON.fg, borderBottom: `1px solid ${SOON.bd}` }}>
      {newer ? (
        <><b>網頁版本比資料庫舊</b><span>請按 Ctrl+F5 重新整理頁面，載入最新版本。</span></>
      ) : (
        <>
          <b>資料庫需要更新</b>
          <span>（資料庫 v{ver || 1}，這版網頁需要 v{SCHEMA_VERSION}）請到 Supabase → SQL Editor → New query，貼上最新的 schema.sql 全文後按 Run。更新前，允許註冊名單、還原備份等新功能無法使用。</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <a href={SCHEMA_URL} target="_blank" rel="noreferrer" style={{ ...lineBtn, height: 28, display: 'inline-flex', alignItems: 'center', fontSize: 12, textDecoration: 'none', color: 'inherit' }}>開啟最新 schema.sql</a>
            <button onClick={recheck} style={{ ...lineBtn, height: 28, fontSize: 12 }}>已執行，重新檢查</button>
          </span>
        </>
      )}
    </div>
  );
}
function UserMenu({ sb, S }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...FSEL, height: 30, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Avatar name={S.me || '?'} size={20} />{S.me}<span style={{ fontSize: 10.5, color: V.muted2 }}>{S.profile.is_owner ? '★ 最高管理員' : ROLE_LABEL[S.role] || S.profile.role}</span>▾
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'absolute', top: 36, right: 0, width: 220, zIndex: 30, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', padding: 6, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 10px', fontSize: 11.5, color: V.muted2 }}>{S.profile.email}</div>
            <div style={{ padding: '2px 10px 6px', fontSize: 11, color: V.faint }}>顯示名稱由管理員在「帳號管理」修改</div>
            <button className="member-item" onClick={() => sb.auth.signOut()} style={menuItem}>登出</button>
          </div>
        </>
      )}
    </div>
  );
}
const menuItem = { textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer' };

function RootSB({ sb = sbClient }) {   // 預覽版會傳入模擬的 Supabase
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  const uidv = session && session.user.id;
  useEffect(() => {
    if (!uidv) { setProfile(session === null ? null : undefined); return; }
    setProfile(undefined);
    let alive = true;
    const load = () => sb.from('profiles').select('*').eq('id', uidv).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error) setProfile((p) => p || { role: 'none', name: '', email: session.user.email });
      else setProfile(data || { role: 'none', name: '', email: session.user.email });
    });
    load();
    const ch = sb.channel('rt-me').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uidv}` }, load).subscribe();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); sb.removeChannel(ch); };
  }, [uidv]);
  if (session === undefined || (session && !profile)) return <AuthShell><div style={{ fontSize: 13, color: V.muted2 }}>連線中…</div></AuthShell>;
  if (!session) return <AuthPage sb={sb} />;
  const active = profile.status ? profile.status === 'active' : ['viewer', 'engineer', 'planner', 'editor', 'admin'].includes(profile.role);
  if (!active || profile.role === 'none') return <PendingPage sb={sb} profile={profile} />;
  return <App sb={sb} profile={profile} />;
}

/* ============================================================
   線上人數（Supabase Realtime Presence）：誰在線、目前在哪一頁
   ============================================================ */
function usePresence(sb, profile, page) {
  const [list, setList] = useState([]);       // [{ id, name, role, page, at, tabs }]
  const [ok, setOk] = useState(false);
  const ch = useRef(null), cur = useRef({});
  cur.current = { name: profile ? profile.name : '', role: profile ? profile.role : '', owner: !!(profile && profile.is_owner), page };
  useEffect(() => {
    if (!sb || !profile) return;
    const c = sb.channel('online-users', { config: { presence: { key: profile.id } } });
    ch.current = c;
    const sync = () => {
      const st = c.presenceState();
      const l = Object.entries(st).map(([id, metas]) => {
        const ms = [...metas].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
        return { id, ...ms[0], tabs: ms.length, pages: [...new Set(ms.map((m) => m.page))] };
      });
      setList(l.sort((a, b) => (b.id === profile.id) - (a.id === profile.id) || byName(a.name || '', b.name || '')));
    };
    c.on('presence', { event: 'sync' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { setOk(true); await c.track({ ...cur.current, at: new Date().toISOString() }); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setOk(false);
      });
    return () => { ch.current = null; c.untrack().catch(() => {}); sb.removeChannel(c); };
  }, [sb, profile && profile.id]);
  // 換頁或改名時更新自己的狀態
  useEffect(() => { const c = ch.current; if (c && ok) c.track({ ...cur.current, at: new Date().toISOString() }).catch(() => {}); }, [page, ok, profile && profile.name, profile && profile.role]);
  return { list, ok };
}
const PAGE_LABEL = { overview: '總覽', daily: '每日', combo: '複合排程', list: '工程清單', plan: '生產排程', board: '卡片看板', accounts: '帳號管理' };
function OnlineBadge({ P, meId }) {
  const [open, setOpen] = useState(false);
  const n = P.list.length;
  const since = (t) => { if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000)); return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : `${Math.floor(m / 60)} 小時前`; };
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} title="點開看誰在線上、目前在哪一頁" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontSize: 11.5, color: P.ok ? 'oklch(0.45 0.1 155)' : V.faint, display: 'flex', alignItems: 'center', gap: 4 }}>
        👥 {P.ok ? <>線上 <b>{n}</b> 人</> : '線上人數讀取中…'} <span style={{ fontSize: 9 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{ position: 'absolute', top: 22, right: 0, width: 300, zIndex: 30, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500, padding: '2px 4px 6px', display: 'flex', alignItems: 'baseline', gap: 6 }}>目前在線<span style={{ fontFamily: MONO, fontSize: 11, color: V.muted2 }}>{n} 人</span></div>
            {!P.ok && <div style={{ fontSize: 12, color: V.muted2, padding: '4px' }}>即時連線還沒建立（公司網路可能擋住），暫時看不到線上人數。</div>}
            {P.ok && P.list.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 6, background: u.id === meId ? V.tint : undefined }}>
                <span style={{ position: 'relative', flex: 'none' }}><Avatar name={u.name || '?'} size={24} /><span style={{ position: 'absolute', right: -1, bottom: -1, width: 8, height: 8, borderRadius: 4, background: 'oklch(0.62 0.15 150)', border: `2px solid ${V.surface}` }} /></span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                  <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || '（未命名）'}{u.id === meId && <span style={{ fontSize: 10.5, color: V.muted2, marginLeft: 4 }}>（你）</span>}{u.owner ? <span style={{ fontSize: 10.5, color: 'oklch(0.45 0.1 70)', marginLeft: 4 }}>★</span> : null}</span>
                  <span style={{ fontSize: 11, color: V.muted2 }}>{ROLE_LABEL[u.role] || ''}{u.tabs > 1 ? `・開了 ${u.tabs} 個分頁` : ''}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.35, flex: 'none' }}>
                  <span style={{ fontSize: 12, color: V.ink2 }}>{(u.pages || [u.page]).map((pg) => PAGE_LABEL[pg] || pg).join('、')}</span>
                  <span style={{ fontSize: 10.5, color: V.faint }}>{since(u.at)}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function App({ sb = null, profile = null }) {
  const S = useStore(sb, profile);
  const isAdmin = !!profile && profile.role === 'admin';
  const [profiles, setProfilesList] = useProfiles(sb, isAdmin);
  const reloadProfiles = () => sb.from('profiles').select('*').order('created_at').then(({ data }) => data && setProfilesList(data));
  const pendingN = profiles.filter((p) => p.status === 'pending').length;
  const [dbVer, recheckDb] = useDbVersion(sb);
  const oldDb = dbVer !== null && dbVer < SCHEMA_VERSION;
  const cu = S.isCust;
  const [view, setView] = useState(() => (profile && profile.role === 'customer' ? 'list' : 'overview'));
  // 客戶分頁：工程清單與生產排程共用，記住上次選的
  const [tabPick, setTabPickState] = useState(() => lsGet('tab'));
  const setTab = (k) => { setTabPickState(k); lsSet('tab', k); };
  const tabKeys = useMemo(() => {
    const known = new Set(S.customers.map((c) => c.id));
    const orphan = !cu && (S.rows.some((r) => !known.has(r.customer)) || S.plans.some((p) => !known.has(p.customer)));
    return [...S.customers.map((c) => c.id), ...(orphan && S.customers.length ? [NO_TAB] : [])];
  }, [S.customers, S.rows, S.plans, cu]);
  const tab = tabKeys.length === 0 ? null : tabKeys.includes(tabPick) ? tabPick : tabKeys[0];
  const Sr = useMemo(() => scopeStore(S, tab, 'rows'), [S, tab]);
  const Sp = useMemo(() => scopeStore(S, tab, 'plans'), [S, tab]);
  const Dr = useMemo(() => derive(Sr.rows, S.owners, S.settings), [Sr.rows, S.owners, S.settings]);
  const tabCount = (k) => { const z = scopeStore(S, k, view === 'plan' ? 'plans' : 'rows'); return view === 'plan' ? z.plans.length : z.rows.length; };
  useEffect(() => { if (view === 'accounts' && isAdmin) reloadProfiles(); }, [view]);
  const [picked, setPicked] = useState({});
  const [eview, setEview] = useState('list');
  const [logRowId, setLogRowId] = useState(null);
  const closeLogs = useCallback(() => setLogRowId(null), []);
  const logRow = logRowId && S.rows.find((r) => r.id === logRowId);
  const D = useMemo(() => derive(S.rows, S.owners, S.settings), [S.rows, S.owners, S.settings]);
  // 最後更新：工程清單、生產排程、進度紀錄、附件裡最新的一筆
  const last = useMemo(() => {
    let best = { t: '', who: '', what: '' };
    const see = (t, who, what) => { if (t && t > best.t) best = { t, who: who || '', what }; };
    S.rows.forEach((r) => see(r.updated, r.updatedBy, '工程清單'));
    S.plans.forEach((p) => see(p.updated, p.updatedBy, '生產排程'));
    S.logs.forEach((l) => { see(l.created, l.author, '進度紀錄'); see(l.updated, l.author, '進度紀錄'); });
    S.filesByRow.forEach((fs) => fs.forEach((f) => see(f.created, '', '附件')));
    return best;
  }, [S.rows, S.plans, S.logs, S.filesByRow]);
  const P = usePresence(cu ? null : sb, profile, view);   // 客戶帳號不加入線上名單，也看不到誰在線
  const tabs = cu ? [['list', '工程清單'], ['plan', '生產排程']]
    : [['overview', '總覽'], ['daily', '每日'], ['combo', '複合排程'], ['list', '工程清單'], ['plan', '生產排程'], ['board', '卡片看板'], ...(isAdmin ? [['accounts', '帳號管理']] : [])];
  const badge =
    S.mode === 'connecting' ? ['連線中…', V.muted2] :
    cu ? ['僅供瀏覽', V.muted2] :
    S.readOnly ? ['唯讀（可瀏覽，無法修改）', 'oklch(0.55 0.12 70)'] :
    S.mode === 'sb' ? (S.live ? ['● 線上共用・即時同步', 'oklch(0.55 0.11 155)'] : ['● 線上共用・每 20 秒更新', 'oklch(0.55 0.1 120)']) :
    ['僅存在這台裝置（未連線）', 'oklch(0.55 0.12 70)'];
  const noData = S.rows.length === 0;
  const meOpts = S.me && !S.owners.includes(S.me) ? [...S.owners, S.me] : S.owners;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 1100 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px', height: 60, background: V.surface2, borderBottom: `1px solid ${V.line}`, flex: 'none' }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>團隊工程清單與排程{!sb && <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 5, background: V.todayBg, color: 'var(--accent)' }}>本機試用</span>}</h1>
        <nav style={{ display: 'flex', gap: 2, height: '100%' }}>
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ height: '100%', padding: '0 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', borderBottom: `2px solid ${view === k ? V.ink : 'transparent'}`, color: view === k ? V.ink : V.muted, fontWeight: view === k ? 500 : 400 }}>{label}{k === 'accounts' && pendingN > 0 && <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 9, background: SOON.bd, color: '#fff' }}>{pendingN}</span>}</button>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {sb ? <UserMenu sb={sb} S={S} /> : <label title="選你自己，修改紀錄與「只看我的」會用這個名字（記在這台瀏覽器）" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.muted }}>
            我是
            <select value={S.me} onChange={(e) => S.setMe(e.target.value)} style={{ ...FSEL, height: 28, ...(S.me ? null : { borderColor: 'oklch(0.66 0.15 60)', color: 'oklch(0.5 0.13 55)' }) }}>
              <option value="">（請選擇）</option>
              {meOpts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>}
          <SettingsMenu S={S} />
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, lineHeight: 1.3 }}>
            <span style={{ fontSize: 12, color: badge[1], whiteSpace: 'nowrap' }}>{badge[0]}</span>
            {sb && !cu && <OnlineBadge P={P} meId={profile && profile.id} />}
          </span>
          {!cu && <span title={last.t ? `最後一筆修改：${last.what}${last.who ? '・' + last.who : ''}（${last.t}）` : '還沒有任何修改'} style={{ fontSize: 11, color: V.muted2, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', lineHeight: 1.25, alignItems: 'flex-end' }}>
            <span>最後更新 <span style={{ fontFamily: MONO }}>{last.t ? last.t.slice(5) : '—'}</span></span>
            {last.t && <span style={{ fontSize: 10.5, color: V.faint }}>{last.what}{last.who ? '・' + last.who : ''}</span>}
          </span>}
        </div>
      </header>
      {sb && <SchemaBanner ver={dbVer} isAdmin={isAdmin} recheck={recheckDb} />}
      {(view === 'list' || view === 'plan') && tab && <TabBar S={S} tab={tab} setTab={setTab} keys={tabKeys} count={tabCount} />}

      {view === 'list' ? (
        <WorklistPage S={Sr} D={Dr} picked={picked} setPicked={setPicked} eview={eview} setEview={setEview} openLogs={setLogRowId} />
      ) : view === 'plan' ? (
        <PlanPage S={Sp} />
      ) : view === 'combo' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}><ComboPage S={S} D={D} /></div>
      ) : view === 'accounts' && isAdmin ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}><AccountsPage sb={sb} S={S} profiles={profiles} reload={reloadProfiles} oldDb={oldDb} /></div>
      ) : view === 'daily' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}><DailyPage S={S} D={D} openLogs={setLogRowId} /></div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {noData ? (
            <div style={{ background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10, padding: 48, textAlign: 'center', fontSize: 14, color: V.muted2 }}>
              工程清單中還沒有資料。<a href="#" onClick={(e) => { e.preventDefault(); setView('list'); }}>前往新增</a>
            </div>
          ) : view === 'overview' ? (
            <Overview D={D} S={S} goGantt={(n) => { setPicked({ [n]: true }); setEview('gantt'); setView('list'); }} />
          ) : (
            <Board D={D} S={S} openLogs={setLogRowId} />
          )}
        </div>
      )}

      {logRow && !cu && <LogDrawer key={logRow.id} row={logRow} S={S} ro={!S.canEdit} onClose={closeLogs} />}
      {S.notice && (
        <div style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', background: V.btnBg, color: V.btnFg, padding: '8px 10px 8px 16px', borderRadius: 8, fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 60, display: 'flex', alignItems: 'center', gap: 12, maxWidth: '80vw' }}>
          <span>{S.notice.text}</span>
          {S.notice.action && <button onClick={S.notice.action.run} style={{ border: `1px solid ${V.btnFg}`, background: 'transparent', color: V.btnFg, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{S.notice.action.label}</button>}
          <button onClick={S.clearNotice} title="關閉" style={{ border: 'none', background: 'transparent', color: V.btnFg, cursor: 'pointer', fontSize: 15, opacity: 0.7 }}>×</button>
        </div>
      )}
    </div>
  );
}

export { useDbVersion, SchemaBanner, UserMenu, menuItem, RootSB, usePresence, PAGE_LABEL, OnlineBadge, App };
