import React, { useState, useMemo } from 'react';
import { PRIO, ST, STATUS, UN, V } from '../lib/theme';
import { byName, lsGet, lsSet } from '../lib/util';
import { Dropdown, MenuItem } from '../ui/menu';
import { SORTS, engPlanClash } from './parts';
import { ItemRow } from './ItemRow';
import { ImportModal, exportCSV } from './io';

/* ============================================================
   V2：工程清單——乾淨的清單（只有狀態可以直接切換），點一列在右側詳情修改
   ============================================================ */
const GROUPS = [['none', '不分組（自訂順序）'], ['status', '依狀態'], ['owner', '依負責人'], ['machine', '依機台']];
const useLs = (k, d) => { const [v, setV] = useState(() => lsGet(k) || d); return [v, (x) => { setV(x); lsSet(k, x); }]; };

function ListPage({ S, D, sel, open, showScope, head, goTimeline }) {
  const cu = S.isCust, ro = !S.canEdit;
  const [q, setQ] = useState('');
  const [st, setSt] = useState(null);
  const [mineOn, setMine] = useLs('list.mine', '0');
  const [hideDone, setHideDone] = useLs('list.hideDone', '1');
  const [grp, setGrp] = useLs('list.group', 'none');
  const [sortKey, setSortKey] = useState('order');
  const [fOwner, setFOwner] = useState(''), [fMachine, setFMachine] = useState(''), [fPrio, setFPrio] = useState('');
  const [importing, setImporting] = useState(false);
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null);
  const mine = !cu && mineOn === '1' && !!S.me;
  const today = D.today;
  const logN = useMemo(() => { const m = new Map(); S.logs.forEach((l) => m.set(l.rowId, (m.get(l.rowId) || 0) + 1)); return m; }, [S.logs]);
  const clash = useMemo(() => (cu ? new Map() : engPlanClash(D.rows, S.plans)), [D.rows, S.plans, cu]);
  const ql = q.trim().toLowerCase();
  const nFilter = [fOwner, fMachine, fPrio].filter(Boolean).length + (sortKey !== 'order' ? 1 : 0);
  let list = S.rows.filter((r) => (!st || r.status === st) && (hideDone !== '1' || st === '已完成' || r.status !== '已完成')
    && (!mine || r.owner === S.me) && (!fOwner || (fOwner === '__none__' ? !r.owner : fOwner === '__gone__' ? (!!r.owner && !S.owners.includes(r.owner)) : r.owner === fOwner))
    && (!fMachine || (fMachine === '__none__' ? !r.machine : r.machine === fMachine)) && (!fPrio || r.priority === fPrio)
    && (!ql || [r.item, r.owner, r.custOwner, r.machine, r.remark].join(' ').toLowerCase().includes(ql)));
  if (sortKey !== 'order') {
    const val = (r) => sortKey === 'priority' ? PRIO.indexOf(r.priority) : sortKey === 'status' ? STATUS.indexOf(r.status) : sortKey === 'days' ? Number(r.days) || 0 : sortKey === 'due' ? r.due || '9999' : sortKey === 'owner' ? r.owner || '￿' : r[sortKey] || '';
    list = [...list].sort((a, b) => { const x = val(a), y = val(b); return x < y ? -1 : x > y ? 1 : 0; });
  }
  const canDrag = !ro && grp === 'none' && sortKey === 'order' && !st && !ql && !nFilter && !mine;
  const goneN = S.rows.filter((r) => r.owner && !S.owners.includes(r.owner) && r.status !== '已完成').length;
  const machines = [...new Set([...S.machines, ...S.rows.map((r) => r.machine).filter(Boolean)])].sort(byName);
  const ownerList = cu ? [...new Set(S.rows.map((r) => r.owner).filter(Boolean))].sort(byName) : S.owners;
  const groups = grp === 'none' ? [{ k: '', l: list }]
    : grp === 'status' ? STATUS.map((s) => ({ k: s, dot: (ST[s] || [])[1], l: list.filter((r) => r.status === s) }))
    : grp === 'owner' ? [...new Set([...ownerList, ...list.map((r) => r.owner)])].map((o) => ({ k: o || UN, l: list.filter((r) => (r.owner || '') === (o || '')) }))
    : [...machines, ''].map((m) => ({ k: m || '（未指定機台）', mono: !!m, l: list.filter((r) => (r.machine || '') === m) }));
  const shown = groups.filter((g) => g.l.length);
  const openN = S.rows.filter((r) => r.status !== '已完成').length;
  const add = () => { setSt(null); setQ(''); S.add(mine ? { owner: S.me } : {}).then((id) => id && open(id)); };
  const clear = () => { setFOwner(''); setFMachine(''); setFPrio(''); setSortKey('order'); };
  const dnd = (r, i, l) => !canDrag ? null : {
    can: true, over: over && over.id === r.id ? over.pos : null,
    onStart: (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id); setTimeout(() => setDrag(r.id), 0); },
    onEnd: () => { setDrag(null); setOver(null); },
    onOver: (e) => { if (!drag) return; e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); const pos = e.clientY < b.top + b.height / 2 ? 'before' : 'after'; if (!over || over.id !== r.id || over.pos !== pos) setOver({ id: r.id, pos }); },
    onDrop: (e) => { e.preventDefault(); const id = drag, o = over; setDrag(null); setOver(null); if (!id || !o) return; const beforeId = o.pos === 'before' ? r.id : (l[i + 1] ? l[i + 1].id : null); if (beforeId !== id && id !== r.id) S.move(id, beforeId); },
  };
  const fsel = (label, value, set, opts) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 10px', fontSize: 11, color: V.muted2 }}>{label}
      <select className="field" value={value} onChange={(e) => set(e.target.value)} style={{ height: 30, fontSize: 12.5, color: V.ink }}>{opts}</select>
    </label>
  );
  return (
    <>
      {head({
        title: '工程清單', sub: `${S.rows.length} 件工作・${openN} 件未完成`,
        acts: <>
          {!cu && <button className="btn btn-sm" onClick={() => goTimeline('eng')}>看時程圖</button>}
          {!cu && (
            <Dropdown label="⋯" btnClass="btn btn-sm" ariaLabel="更多" title="匯出／匯入" width={250}>
              {(close) => <>
                <div className="pop-title">匯出 CSV</div>
                {[['eng', `工程清單（目前顯示的 ${list.length} 筆）`], ['engAll', `工程清單（全部 ${S.rows.length} 筆）`], ['plan', `生產排程（${S.plans.length} 筆）`], ['log', `進度紀錄（${S.logs.length} 則）`]].map(([k, l]) => <MenuItem key={k} onClick={() => { close(); exportCSV(S, k, list); }}>{l}</MenuItem>)}
                <div className="pop-sep" />
                <MenuItem disabled={!S.canEdit && !S.canPlan} onClick={() => { close(); setImporting(true); }}>從 Excel 貼上匯入…</MenuItem>
              </>}
            </Dropdown>
          )}
          {!cu && <button className="btn btn-primary" disabled={ro} onClick={add}>＋ 新增工作</button>}
        </>,
      })}
      <div className="filters">
        <input className="field search" type="search" aria-label="搜尋" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋工作、負責人、機台…" style={{ width: 230 }} />
        <div className="seg" role="group" aria-label="依狀態篩選" style={{ flexWrap: 'wrap' }}>
          {[null, ...STATUS].map((k) => { const n = k ? S.rows.filter((r) => r.status === k).length : S.rows.length; return <button key={k || 'all'} className={st === k ? 'on' : ''} aria-pressed={st === k} onClick={() => setSt(k)} style={!n && st !== k ? { opacity: 0.45 } : null}>{k || '全部'}<span className="n">{n}</span></button>; })}
        </div>
        {!cu && <button className={'chip' + (mine ? ' on' : '')} aria-pressed={mine} disabled={!S.me} onClick={() => setMine(mineOn === '1' ? '0' : '1')} title={S.me ? `只看 ${S.me} 負責的（會記住）` : '請先選擇「我是」'}>只看我的</button>}
        <Dropdown label={<>篩選與分組{nFilter + (grp !== 'none') > 0 && <span className="badge">{nFilter + (grp !== 'none')}</span>} ▾</>} btnClass={'btn btn-sm' + (nFilter || grp !== 'none' ? ' on' : '')} align="left" width={260}>
          {fsel('分組', grp, setGrp, GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>))}
          {fsel('排序', sortKey, setSortKey, SORTS.map(([k, l]) => <option key={k} value={k}>{k === 'order' ? '自訂順序' : l}</option>))}
          <div className="pop-sep" />
          {fsel('負責人', fOwner, setFOwner, <><option value="">全部</option>{ownerList.map((o) => <option key={o} value={o}>{o}</option>)}<option value="__none__">（未指派）</option>{goneN > 0 && <option value="__gone__">⚠ 已不在成員清單（{goneN}）</option>}</>)}
          {fsel('機台', fMachine, setFMachine, <><option value="">全部</option>{machines.map((m) => <option key={m} value={m}>{m}</option>)}<option value="__none__">（未指定）</option></>)}
          {!cu && fsel('優先度', fPrio, setFPrio, <><option value="">全部</option>{PRIO.map((o) => <option key={o} value={o}>{o}</option>)}</>)}
          <div className="pop-sep" />
          <label className="mi"><input type="checkbox" checked={hideDone === '1'} onChange={(e) => setHideDone(e.target.checked ? '1' : '0')} />隱藏已完成</label>
          {nFilter > 0 && <MenuItem onClick={clear}>清除篩選與排序</MenuItem>}
        </Dropdown>
        {!cu && goneN > 0 && <button className={'chip chip-warn' + (fOwner === '__gone__' ? ' on' : '')} onClick={() => setFOwner(fOwner === '__gone__' ? '' : '__gone__')} title="負責人帳號已停用或刪除，點一下只看這些">⚠ {goneN} 件負責人已不在</button>}
      </div>
      <div className="page-body">
        {shown.length === 0
          ? <div className="list"><div className="empty"><b>{S.rows.length ? '沒有符合條件的工作' : cu ? '目前沒有資料' : '還沒有任何工作'}</b>{S.rows.length ? (mine ? `目前只顯示 ${S.me} 負責的；可以關掉「只看我的」。` : '試著清除搜尋或篩選。') : !cu && !ro ? '按右上角「＋ 新增工作」開始。' : ''}</div></div>
          : shown.map((g) => (
            <div key={g.k || 'all'} className="list">
              {grp !== 'none' && <div className="grp-h">{g.dot && <i style={{ background: g.dot }} />}<span className={g.mono ? 'mono' : ''}>{g.k}</span><span className="n">{g.l.length}</span></div>}
              {g.l.map((r, i) => (
                <ItemRow key={r.id} r={r} S={S} sel={sel === r.id} onOpen={open} showScope={showScope} today={today} logN={cu ? 0 : logN.get(r.id) || 0}
                  clash={clash.has(r.id)} gone={!cu && !!r.owner && !S.owners.includes(r.owner) && r.status !== '已完成'} dnd={dnd(r, i, g.l)} />
              ))}
            </div>
          ))}
        <div className="hint" style={{ padding: '10px 4px', display: 'flex', gap: 12 }}>
          <span>顯示 {list.length} / {S.rows.length} 件{hideDone === '1' && st !== '已完成' ? '（已完成的已隱藏）' : ''}</span>
          {canDrag && list.length > 1 && <span>・滑鼠移到列的左邊可以拖曳調整順序</span>}
        </div>
      </div>
      {importing && <ImportModal S={S} onClose={() => setImporting(false)} />}
    </>
  );
}

export { ListPage };
