import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { sbClient } from '../lib/config';
import { V } from '../lib/theme';
import { byName, lsGet, lsSet } from '../lib/util';
import { SCHEMA_URL, SCHEMA_VERSION } from '../data/backend';
import { useStore } from '../data/store';
import { derive } from '../data/derive';
import { Avatar } from '../ui/common';
import { Icon } from '../ui/icons';
import { NO_TAB, tabName } from '../ui/tabs';
import { engPlanClash } from '../worklist/parts';
import { MyWork } from '../home/MyWork';
import { ListPage } from '../worklist/ListPage';
import { ItemDetail } from '../worklist/ItemDetail';
import { PlanListPage, PlanDetail, planClash } from '../plan/PlanList';
import { TimelinePage } from '../plan/timeline';
import { Gantt } from '../dashboard/Gantt';
import { Overview } from '../dashboard/Overview';
import { Board } from '../dashboard/Board';
import { DailyPage } from '../daily/DailyPage';
import { SettingsPanel } from './SettingsMenu';
import { AuthPage, AuthShell, PendingPage, ROLE_LABEL, useProfiles } from '../account/auth';
import { ManagePage } from '../account/ManagePage';

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
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 28px', fontSize: 13, background: 'oklch(0.96 0.04 75)', color: 'oklch(0.45 0.12 55)', borderBottom: '1px solid oklch(0.85 0.08 70)' }}>
      {newer ? (
        <><b>網頁版本比資料庫舊</b><span>請按 Ctrl+F5 重新整理頁面，載入最新版本。</span></>
      ) : (
        <>
          <b>資料庫需要更新</b>
          <span>（資料庫 v{ver || 1}，這版網頁需要 v{SCHEMA_VERSION}）請到 Supabase → SQL Editor → New query，貼上最新的 schema.sql 全文後按 Run。</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <a className="btn btn-sm" href={SCHEMA_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>開啟最新 schema.sql</a>
            <button className="btn btn-sm" onClick={recheck}>已執行，重新檢查</button>
          </span>
        </>
      )}
    </div>
  );
}

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
const PAGE_LABEL = { mine: '我的工作', overview: '總覽', daily: '每日', timeline: '時程圖', combo: '時程圖', list: '工程清單', plan: '生產排程', board: '卡片看板', accounts: '管理' };
const since = (t) => { if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000)); return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : `${Math.floor(m / 60)} 小時前`; };

/* 側欄底部的小彈出面板（往上開） */
function SidePop({ trigger, children, width = 280 }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const k = (e) => { if (e.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  return (
    <div style={{ position: 'relative' }}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && <>
        <div className="pop-veil" onClick={() => setOpen(false)} />
        <div className="pop" role="dialog" style={{ bottom: 'calc(100% + 6px)', left: 0, width, padding: 8, gap: 2 }}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</div>
      </>}
    </div>
  );
}

// 範圍：全部客戶或某一個分頁；新增時自動帶入（全部時用第一個分頁）
function scopeAll(S, scope) {
  const known = new Set(S.customers.map((c) => c.id));
  const inScope = scope === 'all' ? () => true : scope === NO_TAB ? (x) => !known.has(x.customer) : (x) => x.customer === scope;
  const def = scope === 'all' || scope === NO_TAB ? ((S.customers.find((c) => !c.internal) || S.customers[0] || {}).id || '') : scope;
  return {
    ...S, scope,
    rows: S.rows.filter(inScope), plans: S.plans.filter(inScope),
    add: (extra) => S.add({ customer: def, ...extra }),
    addPlan: (m, copy, extra) => S.addPlan(m, copy, { customer: copy && copy.customer ? copy.customer : def, ...extra }),
  };
}

function App({ sb = null, profile = null }) {
  const S0 = useStore(sb, profile);
  const isAdmin = !!profile && profile.role === 'admin';
  const [profiles, setProfilesList] = useProfiles(sb, isAdmin);
  const reloadProfiles = () => sb.from('profiles').select('*').order('created_at').then(({ data }) => data && setProfilesList(data));
  const pendingN = profiles.filter((p) => p.status === 'pending').length;
  const [dbVer, recheckDb] = useDbVersion(sb);
  const oldDb = dbVer !== null && dbVer < SCHEMA_VERSION;
  const cu = S0.isCust;
  const role = profile ? profile.role : 'admin';
  // 首頁：客戶 → 工程清單；Planner → 生產排程；管理員／只能看 → 總覽；工程師 → 我的工作
  const home = cu ? 'list' : role === 'planner' ? 'plan' : role === 'admin' || role === 'viewer' ? 'overview' : 'mine';
  const [view, setViewState] = useState(home);
  const [sideOpen, setSideOpen] = useState(false);
  const setView = (v) => { setViewState(v); setSideOpen(false); setSel(null); };
  // 範圍（客戶分頁）：記住上次選的
  const [scopePick, setScopePick] = useState(() => lsGet('scope') || 'all');
  const orphan = !cu && S0.customers.length > 0 && (S0.rows.some((r) => !S0.customers.some((c) => c.id === r.customer)) || S0.plans.some((p) => !S0.customers.some((c) => c.id === p.customer)));
  const scopes = ['all', ...S0.customers.map((c) => c.id), ...(orphan ? [NO_TAB] : [])];
  const scope = scopes.includes(scopePick) ? scopePick : 'all';
  const setScope = (k) => { setScopePick(k); lsSet('scope', k); setSel(null); };
  const S = useMemo(() => scopeAll(S0, scope), [S0, scope]);
  const D = useMemo(() => derive(S.rows, S0.owners, S0.settings), [S.rows, S0.owners, S0.settings]);
  useEffect(() => { if (view === 'accounts' && isAdmin) reloadProfiles(); }, [view]);
  // 右側詳情：{ kind: 'row' | 'plan', id }
  const [sel, setSel] = useState(null);
  const openRow = useCallback((id) => setSel({ kind: 'row', id }), []);
  const openPlan = useCallback((id) => setSel({ kind: 'plan', id }), []);
  const closeSel = useCallback(() => setSel(null), []);
  const [picked, setPicked] = useState({});
  const [tlMode, setTlModeState] = useState(() => (['eng', 'plan', 'both'].includes(lsGet('tl.mode')) ? lsGet('tl.mode') : 'both'));
  const setTlMode = (m) => { setTlModeState(m); lsSet('tl.mode', m); };
  const goTimeline = (m) => { setTlMode(m); setView('timeline'); };
  const [ovTab, setOvTab] = useState('stats');
  const last = useMemo(() => {
    let best = { t: '', who: '', what: '' };
    const see = (t, who, what) => { if (t && t > best.t) best = { t, who: who || '', what }; };
    S0.rows.forEach((r) => see(r.updated, r.updatedBy, '工程清單'));
    S0.plans.forEach((p) => see(p.updated, p.updatedBy, '生產排程'));
    S0.logs.forEach((l) => { see(l.created, l.author, '進度紀錄'); see(l.updated, l.author, '進度紀錄'); });
    return best;
  }, [S0.rows, S0.plans, S0.logs]);
  const P = usePresence(cu ? null : sb, profile, view);
  const clashRows = useMemo(() => (cu ? new Map() : engPlanClash(D.rows, S.plans)), [D.rows, S.plans, cu]);

  const badge =
    S0.mode === 'connecting' ? ['連線中…', V.muted2, '連線中…'] :
    cu ? ['僅供瀏覽（每 20 秒更新）', V.muted2, '僅供瀏覽'] :
    S0.readOnly ? ['唯讀（可瀏覽，無法修改）', 'oklch(0.55 0.12 70)', '唯讀'] :
    S0.mode === 'sb' ? (S0.live ? ['線上共用・即時同步', 'oklch(0.55 0.11 155)', '即時同步'] : ['線上共用・即時連線被擋，每 20 秒更新', 'oklch(0.55 0.1 120)', '每 20 秒更新']) :
    ['僅存在這台裝置（未連線）', 'oklch(0.55 0.12 70)', '本機試用'];
  const myOpen = D.rows.filter((r) => r.owner === S0.me && r.status !== '已完成');
  const myOver = myOpen.filter((r) => r.over).length;
  const nav = cu
    ? [['list', '工程清單', 'list'], ['plan', '生產排程', 'factory'], ['timeline', '時程圖', 'gantt']]
    : [['mine', '我的工作', 'home'], ['list', '工程清單', 'list'], ['plan', '生產排程', 'factory'], ['timeline', '時程圖', 'gantt'], ['overview', '總覽', 'chart']];
  const count = { mine: myOpen.length, list: S.rows.filter((r) => r.status !== '已完成').length, plan: S.plans.length };
  const showScope = scope === 'all' && S0.customers.length > 1;
  const head = ({ title, sub, acts }) => (
    <div className="page-head">
      <div style={{ minWidth: 0 }}><h1>{title}</h1>{sub && <div className="sub">{sub}{scope !== 'all' ? `・${scope === NO_TAB ? '未分類' : tabName(S0, scope)}` : ''}</div>}</div>
      {acts && <div className="acts">{acts}</div>}
    </div>
  );
  const meOpts = S0.me && !S0.owners.includes(S0.me) ? [...S0.owners, S0.me] : S0.owners;
  const meSelect = !sb && (
    <select className="scope-sel" aria-label="我是" value={S0.me} onChange={(e) => S0.setMe(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
      <option value="">（選擇你的名字）</option>{meOpts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  const pageTitle = (nav.find(([k]) => k === view) || [0, view === 'accounts' ? '管理' : ''])[1];

  return (
    <div className="shell">
      {sideOpen && <div className="side-veil" onClick={() => setSideOpen(false)} />}
      <nav className={'side' + (sideOpen ? ' open' : '')} aria-label="主要頁面">
        <div className="brand"><span className="logo">工</span>團隊工程排程{!sb && <span className="tag" style={{ background: 'var(--accentSoft)', color: 'var(--accent)' }}>本機</span>}</div>
        {(S0.customers.length > 1 || orphan) && (
          <div className="scope-box">
            <span className="lab">{cu ? '客戶' : '範圍'}</span>
            <select className="scope-sel" aria-label="範圍" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">{cu ? '全部' : '全部客戶'}</option>
              {S0.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.internal ? '（內部）' : ''}</option>)}
              {orphan && <option value={NO_TAB}>⚠ 未分類</option>}
            </select>
          </div>
        )}
        {nav.map(([k, l, ic]) => (
          <button key={k} className={'nav-i' + (view === k ? ' on' : '')} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}>
            <Icon name={ic} />{l}
            {k === 'mine' && myOver > 0 ? <span className="cnt hot" title={`${myOver} 件逾期`}>{myOver}</span> : count[k] !== undefined && <span className="cnt">{count[k]}</span>}
          </button>
        ))}
        {isAdmin && <>
          <div className="nav-sec">管理員</div>
          <button className={'nav-i' + (view === 'accounts' ? ' on' : '')} aria-current={view === 'accounts' ? 'page' : undefined} onClick={() => setView('accounts')}>
            <Icon name="gear" />管理{pendingN > 0 && <span className="cnt hot" title={`${pendingN} 個帳號待核准`}>{pendingN}</span>}
          </button>
        </>}
        <div className="side-foot">
          <SidePop trigger={(t) => (
            <button className="sync" onClick={t} title={badge[0]} style={{ color: badge[1] }}>
              <i />{badge[2]}{sb && !cu && P.ok && <span style={{ color: V.muted2 }}>・{P.list.length} 人在線</span>}
            </button>
          )}>
            <div style={{ fontSize: 12.5, padding: '4px 6px', color: badge[1] }}>● {badge[0]}</div>
            {!cu && <div style={{ fontSize: 12, padding: '2px 6px 6px', color: V.muted2 }}>最後更新 <span className="mono">{last.t || '—'}</span>{last.t ? `　${last.what}${last.who ? '・' + last.who : ''}` : ''}</div>}
            {sb && !cu && <>
              <div className="pop-sep" />
              <div className="pop-title">目前在線</div>
              {!P.ok && <div className="hint" style={{ padding: '4px 6px' }}>即時連線還沒建立（公司網路可能擋住），暫時看不到線上人數。</div>}
              {P.ok && P.list.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6, background: u.id === profile.id ? V.tint : undefined }}>
                  <Avatar name={u.name || '?'} size={22} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || '（未命名）'}{u.id === profile.id && <span className="hint">（你）</span>}</span>
                  <span className="hint" style={{ textAlign: 'right' }}>{(u.pages || [u.page]).map((pg) => PAGE_LABEL[pg] || pg).join('、')}・{since(u.at)}</span>
                </div>
              ))}
            </>}
          </SidePop>
          <SidePop width={300} trigger={(t, o) => <button className={'nav-i' + (o ? ' on' : '')} onClick={t} aria-label="設定"><Icon name="sun" />設定</button>}>
            <SettingsPanel S={S0} />
          </SidePop>
          {sb ? (
            <SidePop width={240} trigger={(t) => (
              <button className="nav-i" onClick={t} aria-label="帳號選單" style={{ height: 40 }}>
                <Avatar name={S0.me || '?'} size={24} />
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
                  <span style={{ color: V.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{S0.me}{profile.is_owner && <span style={{ color: 'oklch(0.6 0.12 70)', marginLeft: 4 }}>★</span>}</span>
                  <span style={{ fontSize: 11, color: V.faint }}>{profile.is_owner ? '最高管理員' : ROLE_LABEL[S0.role] || S0.role}</span>
                </span>
              </button>
            )}>
              <div style={{ padding: '6px 8px', fontSize: 12, color: V.muted2 }}>{profile.email}</div>
              <div className="hint" style={{ padding: '0 8px 6px' }}>顯示名稱由管理員在「管理 → 帳號」修改</div>
              <div className="pop-sep" />
              <button className="mi" onClick={() => sb.auth.signOut()}><Icon name="out" size={16} />登出</button>
            </SidePop>
          ) : <div style={{ padding: '4px 6px' }}>{meSelect}</div>}
        </div>
      </nav>

      <main className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setSideOpen(true)} aria-label="開啟選單"><Icon name="menu" /></button>
          <b style={{ fontSize: 15 }}>{pageTitle}</b>
        </div>
        {sb && <SchemaBanner ver={dbVer} isAdmin={isAdmin} recheck={recheckDb} />}
        {view === 'mine' && <MyWork S={S} D={D} sel={sel && sel.kind === 'row' ? sel.id : null} open={openRow} head={head} meSelect={meSelect} goList={() => setView('list')} />}
        {view === 'list' && <ListPage S={S} D={D} sel={sel && sel.kind === 'row' ? sel.id : null} open={openRow} showScope={showScope} head={head} goTimeline={goTimeline} />}
        {view === 'plan' && <PlanListPage S={S} sel={sel && sel.kind === 'plan' ? sel.id : null} open={openPlan} showScope={showScope} head={head} goTimeline={goTimeline} />}
        {view === 'timeline' && <>
          {head({ title: '時程圖', sub: '工程工作依截止日與預計天數往回推；生產排程依開始、結束日' })}
          <div className="page-body"><TimelinePage S={S} D={D} mode={cu && tlMode === 'both' ? 'eng' : tlMode} setMode={setTlMode} picked={picked} setPicked={setPicked} Gantt={Gantt} cust={cu} /></div>
        </>}
        {view === 'overview' && <>
          {head({ title: '總覽', sub: `${S.rows.length} 件工作・${S.plans.length} 筆排程` })}
          <div className="ptabs" role="tablist">
            {[['stats', '統計'], ['daily', '每日'], ['board', '看板']].map(([k, l]) => <button key={k} role="tab" aria-selected={ovTab === k} className={ovTab === k ? 'on' : ''} onClick={() => setOvTab(k)}>{l}</button>)}
          </div>
          <div className="page-body">
            {S.rows.length === 0 ? <div className="list"><div className="empty"><b>還沒有資料</b>到「工程清單」新增第一件工作。</div></div>
              : ovTab === 'stats' ? <Overview D={D} S={S} goGantt={(n) => { setPicked({ [n]: true }); goTimeline('eng'); }} />
              : ovTab === 'daily' ? <DailyPage S={S} D={D} openLogs={openRow} />
              : <Board D={D} S={S} openLogs={openRow} />}
          </div>
        </>}
        {view === 'accounts' && isAdmin && <>
          {head({ title: '管理', sub: '帳號、成員、機台、客戶分頁' })}
          <div className="page-body"><ManagePage sb={sb} S={S0} profiles={profiles} reload={reloadProfiles} oldDb={oldDb} pendingN={pendingN} /></div>
        </>}
      </main>

      {sel && <div className="detail-veil" onClick={closeSel} />}
      {sel && sel.kind === 'row' && <ItemDetail key={sel.id} id={sel.id} S={S0} onClose={closeSel} clash={clashRows.get(sel.id)} />}
      {sel && sel.kind === 'plan' && <PlanDetail key={sel.id} id={sel.id} S={S0} onClose={closeSel} clash={planClash(S0.plans).has(sel.id)} />}

      {S0.notice && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', background: V.btnBg, color: V.btnFg, padding: '8px 10px 8px 16px', borderRadius: 10, fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 60, display: 'flex', alignItems: 'center', gap: 12, maxWidth: '80vw' }}>
          <span>{S0.notice.text}</span>
          {S0.notice.action && <button onClick={S0.notice.action.run} style={{ border: `1px solid ${V.btnFg}`, background: 'transparent', color: V.btnFg, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{S0.notice.action.label}</button>}
          <button onClick={S0.clearNotice} title="關閉" aria-label="關閉" style={{ border: 'none', background: 'transparent', color: V.btnFg, cursor: 'pointer', fontSize: 15, opacity: 0.7 }}>×</button>
        </div>
      )}
    </div>
  );
}

export { useDbVersion, SchemaBanner, RootSB, usePresence, PAGE_LABEL, App };
