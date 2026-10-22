import React, { useState, useEffect, useRef } from 'react';
import { MONO, OVER, SOON, V } from '../lib/theme';
import { stamp } from '../lib/util';
import { CellText, FSEL, card, cin, darkBtn, fld, lineBtn } from '../ui/common';
import { TEAM_LABEL } from '../worklist/members';
import { ROLE_HINT, ROLE_LABEL, STATUS_LABEL, STATUS_TONE, dbErr } from './auth';

/* ============================================================
   帳號管理頁：帳號列表、可見分頁、允許註冊名單、備份與還原
   ============================================================ */
// 客戶分頁下拉：最後一項「＋ 新增客戶…」可直接建立新的客戶分頁（等於在工程清單按「＋ 新增分頁」）
const NEW_CUST = '__new__';
function CustSelect({ S, value, onChange, emptyLabel, prefix = '', style, title }) {
  const [adding, setAdding] = useState(false), [nv, setNv] = useState(''), [busy, setBusy] = useState(false);
  const ext = S.customers.filter((c) => !c.internal);
  // 這個元件可能放在其他 form 裡面（允許名單的新增列），所以不用 <form>，避免巢狀表單
  const add = async () => {
    if (!nv.trim()) return;
    setBusy(true); const id = await S.addTab(nv); setBusy(false);
    if (id) { setAdding(false); setNv(''); onChange(id); }
  };
  if (adding) return (
    <div style={{ display: 'flex', gap: 4, minWidth: 0 }}>
      <input value={nv} onChange={(e) => setNv(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') setAdding(false); }} autoFocus maxLength={40} placeholder="新客戶名稱" style={{ ...fld, height: 28, flex: '1 1 90px', minWidth: 70 }} />
      <button type="button" onClick={add} disabled={busy || !nv.trim()} style={{ ...darkBtn, height: 28, padding: '0 8px', fontSize: 12, opacity: nv.trim() ? 1 : 0.5 }}>新增</button>
      <button type="button" onClick={() => { setAdding(false); setNv(''); }} style={{ ...lineBtn, height: 28, padding: '0 8px', fontSize: 12 }}>取消</button>
    </div>
  );
  return (
    <select value={value || ''} title={title} onChange={(e) => (e.target.value === NEW_CUST ? setAdding(true) : onChange(e.target.value))} style={{ ...FSEL, ...style }}>
      <option value="">{emptyLabel}</option>
      {ext.map((c) => <option key={c.id} value={c.id}>{prefix}{c.name}</option>)}
      {S.canAdmin && <option value={NEW_CUST}>＋ 新增客戶…</option>}
    </select>
  );
}
// 下拉面板用 fixed 定位：不會被表格外框（overflow: hidden）裁掉
function usePopover() {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const open = () => { const r = ref.current && ref.current.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 240) }); };
  const close = () => setPos(null);
  useEffect(() => {
    if (!pos) return;
    const h = () => setPos(null);
    window.addEventListener('resize', h); window.addEventListener('scroll', h, true);
    return () => { window.removeEventListener('resize', h); window.removeEventListener('scroll', h, true); };
  }, [pos]);
  return { ref, pos, open, close, toggle: () => (pos ? close() : open()) };
}
function TabsCell({ p, S, upd: save }) {
  const pop = usePopover();
  // 先在畫面上反映勾選，資料庫存好後再以伺服器資料為準
  const [tl, setTl] = useState(p.tabs);
  useEffect(() => setTl(p.tabs), [JSON.stringify(p.tabs)]);
  const upd = (patch) => { if ('tabs' in patch) setTl(patch.tabs); return save(patch); };
  if (p.role === 'admin') return <span style={{ fontSize: 12, color: V.muted2 }}>全部（管理員）</span>;
  if (p.role === 'customer') {
    const v = (p.tabs || [])[0] || '';
    return <CustSelect S={S} value={v} emptyLabel="（請指定客戶分頁）" onChange={(id) => upd({ tabs: id ? [id] : null })} style={{ height: 30, maxWidth: '100%', ...(v ? null : { borderColor: OVER, color: OVER }) }} />;
  }
  const all = !tl;
  const sel = new Set(tl || []);
  const label = all ? '全部分頁' : S.customers.filter((c) => sel.has(c.id)).map((c) => c.name).join('、') || '（沒有任何分頁）';
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); upd({ tabs: [...n] }); };
  return (
    <span style={{ position: 'relative', minWidth: 0 }}>
      <button ref={pop.ref} onClick={pop.toggle} title={label} style={{ ...FSEL, height: 30, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(all ? null : { borderColor: 'var(--accent)' }), ...(tl && !tl.length ? { color: OVER } : null) }}>{label} ▾</button>
      {pop.pos && (
        <>
          <div onClick={pop.close} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'fixed', top: pop.pos.top, left: pop.pos.left, width: 220, zIndex: 41, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', padding: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 6px', fontWeight: 500 }}>
              <input type="checkbox" checked={all} onChange={(e) => upd({ tabs: e.target.checked ? null : S.customers.map((c) => c.id) })} />全部分頁（含之後新增的）
            </label>
            <div style={{ borderTop: `1px solid ${V.line}`, margin: '2px 0' }} />
            {S.customers.map((c) => (
              <label key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 6px', color: all ? V.faint : V.ink }}>
                <input type="checkbox" disabled={all} checked={all || sel.has(c.id)} onChange={() => toggle(c.id)} />{c.name}{c.internal && <span style={{ fontSize: 10.5, color: V.muted2 }}>（內部）</span>}
              </label>
            ))}
            <div style={{ fontSize: 11, color: V.muted2, padding: '4px 6px', lineHeight: 1.5 }}>只看得到、也只能修改勾選的分頁。</div>
          </div>
        </>
      )}
    </span>
  );
}
function AccountRow({ p, S, sb, isMe, canDelete, onErr, reload, G }) {
  const [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  const upd = async (patch) => {
    onErr('');
    const { error } = await sb.from('profiles').update(patch).eq('id', p.id);
    if (error) onErr(dbErr(error)); else { reload(); setTimeout(() => S.refresh(), 300); }
  };
  const setName = async (name) => { const n = name.trim(); if (n && n !== p.name) await upd({ name: n }); };
  const del = async () => {
    setBusy(true); onErr('');
    const { error } = await sb.rpc('delete_account', { target: p.id, remove_member: true });
    setBusy(false); setAsk(false);
    if (error) onErr('刪除失敗：' + dbErr(error)); else { reload(); setTimeout(() => S.refresh(), 300); S.say(`已刪除帳號「${p.name}」`); }
  };
  const m = S.members.find((x) => x.profileId === p.id);
  const free = S.members.filter((x) => !x.profileId);
  const [tBg, tFg] = STATUS_TONE[p.status] || STATUS_TONE.pending;
  const sbtn = (label, onClick, tone) => <button onClick={onClick} style={{ ...FSEL, height: 28, ...(tone === 'go' ? { background: 'oklch(0.5 0.12 155)', borderColor: 'oklch(0.5 0.12 155)', color: '#fff' } : tone === 'stop' ? { color: OVER, borderColor: 'oklch(0.8 0.08 25)' } : null) }}>{label}</button>;
  return (
    <div style={{ borderBottom: `1px solid ${V.line}`, background: p.status === 'pending' ? SOON.bg : p.status === 'disabled' ? V.tint : undefined }}>
      <div style={{ display: 'grid', gridTemplateColumns: G, gap: 10, padding: '8px 16px', alignItems: 'center', opacity: p.status === 'disabled' ? 0.75 : 1 }}>
        <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {p.is_owner ? <span style={{ fontSize: 11, color: V.faint }}>—</span> : (
            <>
              {p.status === 'pending' && sbtn('核准', () => upd({ status: 'active' }), 'go')}
              {p.status === 'active' && !isMe && sbtn('停用', () => upd({ status: 'disabled' }), 'stop')}
              {p.status === 'disabled' && sbtn('恢復', () => upd({ status: 'active' }), 'go')}
              {canDelete && !isMe && !ask && <button className="del" onClick={() => setAsk(true)} title="永久刪除這個登入帳號（只有最高管理員能做）" style={{ ...FSEL, height: 28, color: V.muted2 }}>刪除</button>}
            </>
          )}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <CellText className="cin" value={p.name} onCommit={setName} style={cin({ fontWeight: 500 })} />
          {p.is_owner && <span title="最高管理員：唯一可以刪除帳號的人，不能被降級或停用" style={{ flex: 'none', fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: 'oklch(0.93 0.05 85)', color: 'oklch(0.45 0.1 70)' }}>★ 最高管理員</span>}
        </span>
        <span style={{ fontSize: 12, color: V.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}{isMe ? '（你）' : ''}</span>
        <span style={{ justifySelf: 'start', fontSize: 11.5, padding: '2px 9px', borderRadius: 10, background: tBg, color: tFg, fontWeight: 500 }}>{STATUS_LABEL[p.status] || p.status}</span>
        <select value={p.role} disabled={p.is_owner} onChange={(e) => {
          const r = e.target.value, ext = S.customers.find((c) => !c.internal);
          if (r === 'customer') upd({ role: r, tabs: p.role === 'customer' ? p.tabs : ext ? [ext.id] : null });
          else upd({ role: r, ...(p.role === 'customer' ? { tabs: null } : null) });
        }} title={p.status === 'pending' ? '核准時會給這個權限' : ''} style={{ ...FSEL, height: 30 }}>
          {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          {!ROLE_LABEL[p.role] && <option value={p.role}>{p.role}</option>}
        </select>
        <TabsCell p={p} S={S} upd={upd} />
        {p.role === 'customer' ? <span style={{ fontSize: 12, color: V.muted2 }}>客戶帳號：不加入成員清單</span> : m ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'oklch(0.45 0.1 155)', minWidth: 0 }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✓ {m.name}<span style={{ color: V.muted2, marginLeft: 6 }}>{TEAM_LABEL[m.team] || ''}組</span></span>
            {free.length > 0 && (
              <select value="" title="連錯人了？改連到清單裡的另一位成員（原本自動建立、沒有資料的成員會刪掉）" onChange={(e) => e.target.value && S.linkMember(p.id, e.target.value).then((ok) => ok && reload())} style={{ ...FSEL, height: 26, fontSize: 11, color: V.muted2, maxWidth: 80 }}>
                <option value="">改連到…</option>
                {free.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
          </span>
        ) : (
          <select value="" onChange={(e) => e.target.value && S.linkMember(p.id, e.target.value).then((ok) => ok && reload())} style={{ ...FSEL, height: 30, color: V.muted }}>
            <option value="">{p.status === 'active' && p.role !== 'viewer' ? '（未連結）連結到既有成員…' : p.role === 'viewer' ? '只能看：不加入成員清單' : '核准後自動加入；或先連結到…'}</option>
            {free.map((x) => <option key={x.id} value={x.id}>{x.name}（{TEAM_LABEL[x.team] || '工程師'}）</option>)}
          </select>
        )}
        <span style={{ fontFamily: MONO, fontSize: 11, color: V.muted2, textAlign: 'right' }}>{(p.created_at || '').slice(0, 16).replace('T', ' ')}</span>
      </div>
      {ask && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 16px 10px', background: 'oklch(0.97 0.02 25)', borderTop: `1px dashed oklch(0.85 0.06 25)`, fontSize: 12.5 }}>
          <span style={{ color: OVER, fontWeight: 500 }}>確定要永久刪除「{p.name}」（{p.email}）的帳號？</span>
          <span style={{ color: V.muted }}>刪除後無法登入、無法復原，也會從成員清單移除；他負責的工作會保留，並在工程清單顯示「負責人已不在清單」提醒改派。</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setAsk(false)} style={{ ...lineBtn, height: 28, fontSize: 12 }}>取消</button>
            <button onClick={del} disabled={busy} style={{ ...darkBtn, height: 28, fontSize: 12, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>{busy ? '刪除中…' : '確定刪除'}</button>
          </span>
        </div>
      )}
    </div>
  );
}
/* ---------- A1：允許註冊名單（最高管理員維護，其他管理員只能看）---------- */
const ALLOW_RE = /^[^@\s]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const normAllow = (s) => { let x = String(s || '').trim().toLowerCase(); if (x && !x.includes('@')) x = '@' + x; return x; };
const panelHead = { padding: '10px 16px', borderBottom: `1px solid ${V.line}`, background: V.tint, display: 'flex', alignItems: 'baseline', gap: 10 };
function AllowListPanel({ sb, S, oldDb }) {
  const owner = !!S.profile.is_owner;
  const [list, setList] = useState(null), [v, setV] = useState(''), [note, setNote] = useState(''), [cust, setCust] = useState('');
  const ext = S.customers.filter((c) => !c.internal);
  const custName = (id) => (ext.find((c) => c.id === id) || {}).name;
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [askLast, setAskLast] = useState(null);
  const load = () => sb.from('signup_allow').select('*').order('created_at').then(({ data, error }) => setList(error ? { error } : data));
  useEffect(() => { if (!oldDb) load(); }, [oldDb]);
  const add = async (e) => {
    e.preventDefault(); setErr('');
    const p = normAllow(v);
    if (!p) return;
    if (!ALLOW_RE.test(p)) { setErr('格式不對：網域請填「@公司.com」，單一信箱請填完整 email。'); return; }
    if (Array.isArray(list) && list.some((x) => x.pattern === p)) { setErr(`「${p}」已經在名單內。`); return; }
    setBusy(true);
    const { error } = await sb.from('signup_allow').insert({ pattern: p, note: note.trim(), ...(cust ? { customer_id: cust } : null) });
    setBusy(false);
    if (error) setErr('新增失敗：' + (error.code === '42501' ? '只有最高管理員可以修改名單。' : error.message));
    else { setV(''); setNote(''); setCust(''); load(); }
  };
  const setMap = async (p, cid) => {
    setErr('');
    const { error } = await sb.from('signup_allow').update({ customer_id: cid || null }).eq('pattern', p);
    if (error) setErr('修改失敗：' + error.message); else load();
  };
  const del = async (p) => {
    setErr(''); setAskLast(null);
    const { error } = await sb.from('signup_allow').delete().eq('pattern', p);
    if (error) setErr('刪除失敗：' + error.message); else load();
  };
  const rows = Array.isArray(list) ? list : [];
  return (
    <div style={{ ...card, overflow: 'hidden', alignSelf: 'start' }}>
      <div style={panelHead}><b style={{ fontSize: 13.5 }}>允許註冊名單</b><span style={{ fontSize: 11.5, color: V.muted2 }}>{owner ? '只有 ★ 最高管理員可以修改' : '只有 ★ 最高管理員可以修改，你只能檢視'}</span></div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: V.muted, lineHeight: 1.7 }}>
          只有名單內的信箱能註冊新帳號（註冊後仍要核准）。可以填<b>整個網域</b>（<code>@company.com</code>），或只開放給<b>單一信箱</b>（客戶窗口）。已經註冊的帳號不受影響。<br />
          指定了<b>客戶分頁</b>的，註冊後會自動成為該客戶的<b>客戶帳號</b>（只看得到那一頁）；沒指定的是一般內部帳號。
        </div>
        {oldDb ? <div style={{ fontSize: 12.5, color: SOON.fg }}>資料庫還沒更新，請先執行最新的 schema.sql。</div>
          : list && list.error ? <div style={{ fontSize: 12.5, color: OVER }}>讀取失敗：{list.error.message}</div>
          : !list ? <div style={{ fontSize: 12.5, color: V.muted2 }}>讀取中…</div> : (
          <>
            {rows.length === 0 && <div style={{ fontSize: 12.5, padding: '8px 10px', borderRadius: 7, background: SOON.bg, color: SOON.fg }}>名單是空的：<b>任何信箱都能註冊</b>（仍需核准）。</div>}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map((x) => (
                <div key={x.pattern} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) 120px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: `1px dashed ${V.line}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {x.pattern}<span style={{ fontFamily: 'inherit', marginLeft: 8, fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: V.tint, color: V.muted2 }}>{x.pattern.startsWith('@') ? '網域' : '單一信箱'}</span>
                  </span>
                  {owner ? (
                    <CustSelect S={S} value={x.customer_id} onChange={(id) => setMap(x.pattern, id)} emptyLabel="內部帳號" prefix="客戶：" title="從這裡註冊的人會成為哪種帳號" style={{ height: 26, fontSize: 11.5, ...(x.customer_id ? { borderColor: 'var(--accent)' } : null) }} />
                  ) : <span style={{ fontSize: 11.5, color: x.customer_id ? 'var(--accent)' : V.muted2 }}>{x.customer_id ? `客戶：${custName(x.customer_id) || '?'}` : '內部帳號'}</span>}
                  <span style={{ fontSize: 11.5, color: V.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${x.note || ''}${x.created_by ? `\n由 ${x.created_by} 新增` : ''}`}>{x.note}{x.created_by ? `${x.note ? '・' : ''}${x.created_by}` : ''}</span>
                  {owner && (askLast === x.pattern ? (
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: OVER }}>
                      刪掉後任何信箱都能註冊？
                      <button onClick={() => setAskLast(null)} style={{ ...lineBtn, height: 26, fontSize: 11.5 }}>取消</button>
                      <button onClick={() => del(x.pattern)} style={{ ...darkBtn, height: 26, fontSize: 11.5, background: 'oklch(0.55 0.17 25)', color: '#fff' }}>確定</button>
                    </span>
                  ) : (
                    <button className="del" title="從名單移除" onClick={() => (rows.length === 1 ? setAskLast(x.pattern) : del(x.pattern))} style={{ ...FSEL, height: 26, color: V.muted2 }}>移除</button>
                  ))}
                </div>
              ))}
            </div>
            {owner && (
              <form onSubmit={add} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input value={v} onChange={(e) => setV(e.target.value)} placeholder="@customer.com 或 name@customer.com" style={{ ...fld, flex: '1 1 200px', fontFamily: MONO }} />
                <CustSelect S={S} value={cust} onChange={setCust} emptyLabel="內部帳號" prefix="客戶：" title="從這裡註冊的人會成為哪種帳號" style={{ height: 32 }} />
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註（例：客戶名稱）" maxLength={60} style={{ ...fld, flex: '1 1 120px' }} />
                <button type="submit" disabled={busy || !v.trim()} className="btn-dark" style={{ ...darkBtn, opacity: busy || !v.trim() ? 0.5 : 1 }}>加入名單</button>
              </form>
            )}
          </>
        )}
        {err && <div style={{ fontSize: 12.5, color: OVER }}>{err}</div>}
      </div>
    </div>
  );
}

/* ---------- A2：完整備份（管理員匯出、最高管理員還原）---------- */
const BACKUP_TABLES = [
  ['customers', '分頁（客戶）'], ['eng_items', '工程項目'], ['eng_logs', '進度紀錄'], ['eng_files', '附件連結'], ['prod_plans', '生產排程'],
  ['members', '團隊成員'], ['machines', '機台'], ['settings', '設定'], ['signup_allow', '允許註冊名單'],
];
async function readAll(sb, table, cols = '*') {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}
async function makeBackup(sb, S) {
  const v = await sb.rpc('schema_version');
  const tables = {};
  for (const [t] of BACKUP_TABLES) {
    try { tables[t] = await readAll(sb, t); }
    catch (e) { if (t === 'signup_allow' || t === 'customers') continue; throw e; }   // 舊版資料庫沒有這些資料表
  }
  let accounts = [];
  try { accounts = await readAll(sb, 'profiles', 'email,name,role,status,is_owner,tabs,created_at'); } catch (e) {}
  return {
    app: 'team-schedule', schema: v.error ? 1 : v.data, exported_at: stamp(), exported_by: S.me || '',
    note: '登入帳號（accounts）只供參考，還原時不會建立或修改帳號。本檔含客戶資料，請存放在公司內部、不要上傳到公開位置。',
    tables, accounts,
  };
}
function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const fileStamp = () => stamp().replace(/[-:]/g, '').replace(' ', '-');
function BackupPanel({ sb, S, oldDb }) {
  const owner = !!S.profile.is_owner;
  const [busy, setBusy] = useState(''), [msg, setMsg] = useState(null), [file, setFile] = useState(null), [ok, setOk] = useState(false);
  const inputRef = useRef(null);
  const exportNow = async (prefix = 'backup') => {
    const b = await makeBackup(sb, S);
    downloadJSON(`team-schedule-${prefix}-${fileStamp()}.json`, b);
    return b;
  };
  const doExport = async () => {
    setBusy('export'); setMsg(null);
    try { const b = await exportNow(); setMsg({ ok: true, text: `已下載備份（${BACKUP_TABLES.filter(([t]) => b.tables[t]).map(([t, l]) => `${l} ${b.tables[t].length}`).join('、')}）。` }); }
    catch (e) { setMsg({ ok: false, text: '匯出失敗：' + ((e && e.message) || '未知原因') }); }
    setBusy('');
  };
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    setMsg(null); setOk(false); setFile(null);
    if (!f) return;
    try {
      const j = JSON.parse((await f.text()).replace(/^﻿/, ''));
      if (!j || j.app !== 'team-schedule' || typeof j.tables !== 'object') throw new Error('這不是本系統的備份檔');
      setFile({ name: f.name, j });
    } catch (err) { setMsg({ ok: false, text: '無法讀取：' + (err.message || '檔案格式錯誤') }); }
  };
  const doRestore = async () => {
    setBusy('restore'); setMsg(null);
    try {
      await exportNow('before-restore');   // 先把目前的資料存一份
      const { data, error } = await sb.rpc('restore_backup', { data: file.j });
      if (error) throw error;
      await S.refresh();
      setFile(null); setOk(false);
      setMsg({ ok: true, text: `已還原（${BACKUP_TABLES.filter(([t]) => data && t in data).map(([t, l]) => `${l} ${data[t]}`).join('、')}）。還原前的資料已另外下載成 before-restore 檔。` });
    } catch (e) { setMsg({ ok: false, text: '還原失敗，資料沒有任何變動：' + ((e && e.message) || '未知原因') }); }
    setBusy('');
  };
  const now = { customers: S.customers.length, eng_items: S.rows.length, eng_logs: S.logs.length, prod_plans: S.plans.length, members: S.members.length, machines: S.machines.length };
  return (
    <div style={{ ...card, overflow: 'hidden', alignSelf: 'start' }}>
      <div style={panelHead}><b style={{ fontSize: 13.5 }}>備份與還原</b><span style={{ fontSize: 11.5, color: V.muted2 }}>Supabase 免費方案沒有可下載的自動備份，建議每週匯出一次</span></div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: V.muted, lineHeight: 1.7 }}>
          匯出所有工程清單、進度紀錄、附件連結、生產排程、成員、機台、設定成一個 JSON 檔。<b>檔案含客戶資料</b>，請存在公司內部的位置。
        </div>
        <div><button onClick={doExport} disabled={!!busy} className="btn-dark" style={{ ...darkBtn, opacity: busy ? 0.6 : 1 }}>{busy === 'export' ? '匯出中…' : '⬇ 匯出完整備份'}</button></div>
        <div style={{ borderTop: `1px dashed ${V.line}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>從備份還原 {!owner && <span style={{ fontWeight: 400, color: V.muted2, fontSize: 11.5 }}>（只有 ★ 最高管理員可以操作）</span>}</div>
          <div style={{ fontSize: 12, color: V.muted, lineHeight: 1.7 }}>
            還原會用備份檔<b>取代目前全部的工作資料</b>；開始前會自動下載一份目前資料的備份。登入帳號不會被還原或刪除，目前使用中的帳號會自動加回成員清單。
          </div>
          {owner && !oldDb && (
            <>
              <input ref={inputRef} type="file" accept=".json,application/json" onChange={pick} style={{ display: 'none' }} />
              <div><button onClick={() => inputRef.current && inputRef.current.click()} disabled={!!busy} style={lineBtn}>選擇備份檔…</button></div>
              {file && (
                <div style={{ border: `1px solid ${V.line2}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  <div><b>{file.name}</b><span style={{ color: V.muted2, marginLeft: 8 }}>{file.j.exported_at ? `備份時間 ${file.j.exported_at}` : ''}{file.j.exported_by ? `・${file.j.exported_by}` : ''}</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '2px 16px', justifyContent: 'start', fontSize: 12 }}>
                    <span style={{ color: V.muted2 }}>項目</span><span style={{ color: V.muted2 }}>備份檔</span><span style={{ color: V.muted2 }}>目前</span>
                    {BACKUP_TABLES.filter(([t]) => t in now || Array.isArray(file.j.tables[t])).map(([t, l]) => (
                      <React.Fragment key={t}><span>{l}</span><span style={{ fontFamily: MONO }}>{Array.isArray(file.j.tables[t]) ? file.j.tables[t].length : '—'}</span><span style={{ fontFamily: MONO, color: V.muted2 }}>{t in now ? now[t] : '—'}</span></React.Fragment>
                    ))}
                  </div>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: OVER }}>
                    <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />我了解目前的資料會被這個備份檔取代
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setFile(null); setOk(false); }} disabled={!!busy} style={{ ...lineBtn, height: 30 }}>取消</button>
                    <button onClick={doRestore} disabled={!ok || !!busy} style={{ ...darkBtn, height: 30, background: 'oklch(0.55 0.17 25)', color: '#fff', opacity: !ok || busy ? 0.5 : 1 }}>{busy === 'restore' ? '還原中…' : '開始還原'}</button>
                  </div>
                </div>
              )}
            </>
          )}
          {owner && oldDb && <div style={{ fontSize: 12.5, color: SOON.fg }}>資料庫還沒更新，請先執行最新的 schema.sql 才能還原。</div>}
        </div>
        {msg && <div style={{ fontSize: 12.5, lineHeight: 1.6, color: msg.ok ? 'oklch(0.45 0.1 155)' : OVER }}>{msg.text}</div>}
      </div>
    </div>
  );
}

function AccountsPage({ sb, S, profiles, reload, oldDb }) {
  const [err, setErr] = useState('');
  const order = { pending: 0, active: 1, disabled: 2 };
  const sorted = [...profiles].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (b.is_owner ? 1 : 0) - (a.is_owner ? 1 : 0) || (a.created_at || '').localeCompare(b.created_at || ''));
  const G = '150px minmax(0,1.2fr) minmax(0,1.2fr) 78px 110px minmax(0,1.1fr) minmax(0,1.2fr) 118px';
  const cnt = (s) => profiles.filter((p) => p.status === s).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: V.muted, lineHeight: 1.75 }}>
        信箱在下方「允許註冊名單」內的人，可以在登入頁「註冊新帳號」，註冊後會出現在最上面（待核准），權限預設為<b>只能看</b>；需要的話先改權限，再按<b>核准</b>。要暫停某人使用請按<b>停用</b>，之後按<b>恢復</b>即可回到原本的權限。<br />
        {Object.entries(ROLE_LABEL).map(([k, l]) => <span key={k} style={{ marginRight: 14 }}><b>{l}</b>：{ROLE_HINT[k]}</span>)}<br />
        核准為工程師、Planner 或管理員後，會自動加入團隊成員（工程師／管理員 → 工程師組，Planner → Planner 組）；清單裡已有這個人時，請在「對應團隊成員」選他。在這裡改名稱，Owner、紀錄人、更新者都會一起改。<br />
        <b>停用</b>或<b>刪除</b>的帳號會從成員清單移除；他負責的工作會保留，並在工程清單顯示「⚠ 負責人已不在清單」提醒改派（恢復帳號後會自動回到清單）。<b>刪除帳號</b>只有 ★ 最高管理員能操作。
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: V.muted2 }}>
        <span>待核准 <b style={{ color: cnt('pending') ? SOON.fg : 'inherit' }}>{cnt('pending')}</b></span><span>使用中 <b>{cnt('active')}</b></span><span>已停用 <b>{cnt('disabled')}</b></span>
      </div>
      {err && <div style={{ fontSize: 13, color: OVER }}>{err}</div>}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: G, gap: 10, padding: '8px 16px', fontSize: 11, color: V.muted2, background: V.tint, borderBottom: `1px solid ${V.line}` }}>
          <span>操作</span><span>顯示名稱</span><span>Email</span><span>狀態</span><span>權限</span><span>可見分頁</span><span>對應團隊成員</span><span style={{ textAlign: 'right' }}>註冊時間</span>
        </div>
        {sorted.map((p) => <AccountRow key={p.id} p={p} S={S} sb={sb} G={G} isMe={p.id === S.profile.id} canDelete={!!S.profile.is_owner} onErr={setErr} reload={reload} />)}
        {sorted.length === 0 && <div style={{ padding: 20, fontSize: 13, color: V.muted2 }}>讀取中…</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 12, marginTop: 4 }}>
        <AllowListPanel sb={sb} S={S} oldDb={oldDb} />
        <BackupPanel sb={sb} S={S} oldDb={oldDb} />
      </div>
    </div>
  );
}

export { TabsCell, AccountRow, ALLOW_RE, normAllow, panelHead, AllowListPanel, BACKUP_TABLES, readAll, makeBackup, downloadJSON, fileStamp, BackupPanel, AccountsPage };
