import React, { useState } from 'react';
import { V } from '../lib/theme';
import { lsGet, lsSet } from '../lib/util';
import { MemberPanel } from '../worklist/members';
import { MachineDel, RemoveOwnerModal } from '../worklist/parts';
import { TabAdmin } from '../ui/tabs';
import { AccountsPage } from './AccountsPage';

/* ============================================================
   ⚙ 管理（只有管理員看得到）：帳號、成員、機台、客戶分頁
   原本散在工程清單／生產排程工具列上的管理功能都集中到這裡
   ============================================================ */
const SECTIONS = [['accounts', '帳號'], ['members', '成員'], ['machines', '機台'], ['tabs', '客戶分頁']];

function Machines({ S }) {
  const [nv, setNv] = useState('');
  const add = () => { const n = nv.trim(); if (!n) return; S.addMachine(n); setNv(''); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 }}>
      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>工程清單的「機台」欄、生產排程都從這份清單下拉選擇。從清單移除不會改到已經填好的工作與排程。</div>
      {S.machines.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '6px 8px' }}>尚未新增機台。</div>}
      {S.machines.map((n) => {
        const engN = S.rows.filter((r) => r.machine === n).length, planN = S.plans.filter((p) => p.machine === n).length;
        return (
          <div key={n} className="member-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
            <span className="mono" style={{ flex: 1, fontSize: 12.5 }}>{n}</span>
            <span className="mono muted" style={{ fontSize: 11 }}>工程 {engN}・排程 {planN}</span>
            <MachineDel engN={engN} planN={planN} onDel={() => S.delMachine(n)} />
          </div>
        );
      })}
      <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: `1px solid ${V.line}` }}>
        <input className="field" value={nv} onChange={(e) => setNv(e.target.value)} placeholder="輸入機台名稱" style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primary" disabled={!nv.trim()}>＋ 新增機台</button>
      </form>
    </div>
  );
}

function Members({ S }) {
  const [removing, setRemoving] = useState(null);
  const tryRemove = (n) => { if (S.rows.some((r) => r.owner === n)) setRemoving(n); else S.delOwnerOnly(n); };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 14, maxWidth: 900 }}>
      <MemberPanel inline S={S} roA={false} team="engineer" onRemove={tryRemove} />
      <MemberPanel inline S={S} roA={false} team="planner" onRemove={(n) => S.delOwnerOnly(n)} />
      {removing && (
        <RemoveOwnerModal name={removing} rows={S.rows.filter((r) => r.owner === removing)} others={S.owners.filter((o) => o !== removing)}
          onCancel={() => setRemoving(null)} onConfirm={async (plan) => { const n = removing; setRemoving(null); await S.removeOwner(n, plan); }} />
      )}
    </div>
  );
}

function ManagePage({ sb, S, profiles, reload, oldDb, pendingN }) {
  const [sec, setSecState] = useState(() => (SECTIONS.some(([k]) => k === lsGet('manage.sec')) ? lsGet('manage.sec') : 'accounts'));
  const setSec = (k) => { setSecState(k); lsSet('manage.sec', k); };
  return (
    <div>
      <nav className="subnav" aria-label="管理項目">
        {SECTIONS.map(([k, l]) => (
          <button key={k} className={sec === k ? 'on' : ''} aria-current={sec === k ? 'page' : undefined} onClick={() => setSec(k)}>
            {l}{k === 'accounts' && pendingN > 0 && <span className="badge" style={{ marginLeft: 6, background: 'oklch(0.66 0.15 60)' }}>{pendingN}</span>}
            {k === 'members' && <span className="mono muted" style={{ marginLeft: 6, fontSize: 11 }}>{S.members.length}</span>}
            {k === 'machines' && <span className="mono muted" style={{ marginLeft: 6, fontSize: 11 }}>{S.machines.length}</span>}
            {k === 'tabs' && <span className="mono muted" style={{ marginLeft: 6, fontSize: 11 }}>{S.customers.length}</span>}
          </button>
        ))}
      </nav>
      {sec === 'accounts' && <AccountsPage sb={sb} S={S} profiles={profiles} reload={reload} oldDb={oldDb} />}
      {sec === 'members' && <Members S={S} />}
      {sec === 'machines' && <Machines S={S} />}
      {sec === 'tabs' && <TabAdmin S={S} />}
    </div>
  );
}

export { ManagePage };
