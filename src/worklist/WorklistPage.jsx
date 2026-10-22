import React, { useState, useMemo, useRef } from 'react';
import { MONO, OVER, PRIO, STATUS, V } from '../lib/theme';
import { byName, lsGet, lsSet } from '../lib/util';
import { FON, FSEL, HintBar, card, darkBtn, gridOf, lineBtn, useCols } from '../ui/common';
import { CLASH, COLMIN, COLS_KEY, COLW0, HEADS, MachineDel, RemoveOwnerModal, SORTS, engPlanClash } from './parts';
import { WorkCard } from './WorkCard';
import { sortLogs } from './logs';
import { ImportModal, exportCSV } from './io';
import { MemberPanel } from './members';
import { CUST_ENG_COLS, visCols } from '../ui/tabs';
import { Gantt } from '../dashboard/Gantt';

function WorklistPage({ S, D, picked, setPicked, eview, setEview, openLogs }) {
  const [sortKey, setSortKey] = useState('order');
  const [sortDir, setSortDir] = useState(1);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(null);
  const [hideDone, setHideDoneState] = useState(() => lsGet('list.hideDone') !== '0');
  const setHideDone = (v) => { setHideDoneState(v); lsSet('list.hideDone', v ? '1' : '0'); };
  const [fOwner, setFOwner] = useState(''), [fMachine, setFMachine] = useState(''), [fPrio, setFPrio] = useState(''), [mine, setMine] = useState(false);
  const [showExport, setShowExport] = useState(false), [importing, setImporting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showMachines, setShowMachines] = useState(false);
  const [newMachine, setNewMachine] = useState('');
  const [cols, startResize, resetCol] = useCols(COLS_KEY, COLW0, COLMIN, [0, COLW0.length - 1]);
  const [newOwner, setNewOwner] = useState('');
  const [removing, setRemoving] = useState(null);
  const logsByRow = useMemo(() => { const m = new Map(); sortLogs(S.logs).forEach((l) => { if (!m.has(l.rowId)) m.set(l.rowId, []); m.get(l.rowId).push(l); }); return m; }, [S.logs]);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const scroller = useRef(null);
  const ro = !S.canEdit, roA = !S.canAdmin, cu = S.isCust;
  const ownerList = cu ? [...new Set(S.rows.map((r) => r.owner).filter(Boolean))].sort(byName) : S.owners;
  const vcols = visCols(S, cols, CUST_ENG_COLS);

  const q = query.trim().toLowerCase();
  const extra = !!(fOwner || fMachine || fPrio || mine);
  let list = S.rows.filter((r) => (!filter || r.status === filter) && (!hideDone || filter === '已完成' || r.status !== '已完成')
    && (!fOwner || (fOwner === '__none__' ? !r.owner : fOwner === '__gone__' ? (!!r.owner && !S.owners.includes(r.owner)) : r.owner === fOwner)) && (!mine || (!!S.me && r.owner === S.me))
    && (!fMachine || (fMachine === '__none__' ? !r.machine : r.machine === fMachine)) && (!fPrio || r.priority === fPrio)
    && (!q || [r.item, r.owner, r.custOwner, r.machine, r.remark, ...(logsByRow.get(r.id) || []).map((l) => l.text)].join(' ').toLowerCase().includes(q)));
  if (sortKey !== 'order') {
    const k = sortKey;
    const val = (r) => {
      if (k === 'priority') return PRIO.indexOf(r.priority);
      if (k === 'status') return STATUS.indexOf(r.status);
      if (k === 'days') return Number(r.days) || 0;
      if (k === 'due') return r.due || '9999-99-99';
      if (k === 'owner') return r.owner || '\uffff';
      return r[k] || '';
    };
    list = [...list].sort((a, b) => { const x = val(a), y = val(b); return x < y ? -sortDir : x > y ? sortDir : 0; });
  }
  const rankOf = useMemo(() => new Map(S.rows.map((r, i) => [r.id, i + 1])), [S.rows]);
  const machines = [...new Set(S.rows.map((r) => (r.machine || '').trim()).filter(Boolean))].sort();
  const canDrag = !ro && sortKey === 'order' && !filter && !q && !extra;
  const doneN = S.rows.filter((r) => r.status === '已完成').length;
  const goneN = S.rows.filter((r) => r.owner && !S.owners.includes(r.owner) && r.status !== '已完成').length;
  const clashByRow = useMemo(() => engPlanClash(D.rows, S.plans), [D.rows, S.plans]);
  const clearExtra = () => { setFOwner(''); setFMachine(''); setFPrio(''); setMine(false); };

  const clearDrag = () => { setDragId(null); setOver(null); };
  const dnd = {
    start(e, id) {
      const card = e.currentTarget.closest('[data-card]');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      if (card && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(card, 28, 28);
      setTimeout(() => setDragId(id), 0);
    },
    end: clearDrag,
    over(e, r) {
      if (!dragId || !canDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setOver((o) => (o && o.id === r.id && o.pos === pos ? o : { id: r.id, pos }));
    },
    drop(e, r) {
      e.preventDefault();
      const id = dragId, o = over;
      clearDrag();
      if (!id || !o || !canDrag) return;
      const idx = list.findIndex((x) => x.id === r.id);
      const beforeId = o.pos === 'before' ? r.id : (list[idx + 1] ? list[idx + 1].id : null);
      if (beforeId === id) return;
      S.move(id, beforeId);
    },
    step(id, dir) {
      const i = list.findIndex((x) => x.id === id);
      if (dir < 0 && i > 0) S.move(id, list[i - 1].id);
      if (dir > 0 && i < list.length - 1) S.move(id, list[i + 2] ? list[i + 2].id : null);
    },
  };

  const addOwner = () => {
    const n = newOwner.trim();
    if (!n) return;
    S.addOwner(n);
    setNewOwner('');
  };
  const tryRemoveOwner = (n) => {
    const mine = S.rows.filter((r) => r.owner === n);
    if (mine.length === 0) S.delOwnerOnly(n);
    else setRemoving(n);
  };
  const addMachine = () => {
    const n = newMachine.trim();
    if (!n) return;
    S.addMachine(n);
    setNewMachine('');
  };
  const addRow = () => {
    setFilter(null); setQuery(''); setSortKey('order'); clearExtra();
    S.add();
    setTimeout(() => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, 200);
  };
  const lastItem = list[list.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 8, columnGap: 14, padding: '12px 24px', background: V.surface2, borderBottom: `1px solid ${V.line}` }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {!cu && [['list', '列表'], ['gantt', '工程排程']].map(([k, l]) => <button key={k} onClick={() => setEview(k)} style={{ ...lineBtn, background: eview === k ? V.btnBg : V.surface, color: eview === k ? V.btnFg : V.ink, borderColor: eview === k ? V.btnBg : V.line2 }}>{l}</button>)}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted2, display: eview === 'list' ? undefined : 'none' }}>{list.length} / {S.rows.length} 筆</span>
        <div style={{ display: eview === 'list' ? 'flex' : 'none', gap: 6 }}>
          {[null, ...STATUS].map((k) => {
            const on = filter === k;
            const c = k ? S.rows.filter((r) => r.status === k).length : S.rows.length;
            return (
              <button key={k || 'all'} onClick={() => setFilter(k)}
                style={{ height: 28, padding: '0 10px', borderRadius: 14, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${on ? V.btnBg : V.line2}`, background: on ? V.btnBg : V.surface, color: on ? V.btnFg : V.muted }}>
                {k || '全部'}<span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7 }}>{c}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: eview === 'list' ? 'flex' : 'none', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: V.muted2 }}>排序</span>
          <select value={sortKey} onChange={(e) => { setSortKey(e.target.value); setSortDir(1); }} style={{ ...lineBtn, padding: '0 8px', fontSize: 12 }}>
            {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {sortKey !== 'order' && (
            <button onClick={() => setSortDir((d) => -d)} title="切換正序／倒序" style={{ ...lineBtn, padding: '0 9px' }}>{sortDir > 0 ? '▲' : '▼'}</button>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {!cu && <>
          <div style={{ position: 'relative' }}>
            <button className="member-btn" onClick={() => setShowMembers((s) => !s)} style={lineBtn}>工程師成員（{S.owners.length}）</button>
            {showMembers && <MemberPanel S={S} roA={roA} team="engineer" onRemove={tryRemoveOwner} onClose={() => setShowMembers(false)} />}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="member-btn" onClick={() => setShowMachines((s) => !s)} style={lineBtn}>機台清單（{S.machines.length}）</button>
            {showMachines && (
              <>
                <div onClick={() => setShowMachines(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <div style={{ position: 'absolute', top: 38, right: 0, width: 280, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>機台清單</div>
                  {S.machines.length === 0 && <div style={{ fontSize: 12, color: V.muted2 }}>尚未新增機台，新增後即可在 Machine 欄位下拉選擇。</div>}
                  {roA && <div style={{ fontSize: 11.5, color: V.muted2 }}>只有管理員可以新增或移除機台。</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflow: 'auto' }}>
                    {S.machines.map((n) => {
                      const cnt = S.rows.filter((r) => r.machine === n).length;
                      return (
                        <div key={n} className="member-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
                          <span style={{ flex: 1, fontFamily: MONO, fontSize: 12 }}>{n}</span>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: V.faint }}>{cnt} 件</span>
                          <MachineDel disabled={roA} engN={cnt} planN={S.plans.filter((p) => p.machine === n).length} onDel={() => S.delMachine(n)} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={newMachine} disabled={roA} onChange={(e) => setNewMachine(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMachine(); }} placeholder="輸入機台名稱"
                      style={{ flex: 1, minWidth: 0, height: 32, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 10px', fontSize: 13, background: V.surface }} />
                    <button disabled={roA} onClick={addMachine} style={darkBtn}>新增</button>
                  </div>
                </div>
              </>
            )}
          </div>
          </>}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={cu ? '搜尋 item / owner / 客戶 / 機台 / remark' : '搜尋 item / owner / 客戶 / 機台 / remark / 紀錄'}
            style={{ height: 32, width: 220, border: `1px solid ${V.line2}`, borderRadius: 7, padding: '0 10px', fontSize: 13, background: V.surface }} />
          {!cu && <button className="btn-dark" disabled={ro} onClick={addRow} style={{ ...darkBtn, opacity: ro ? 0.5 : 1 }}>＋ 新增一筆</button>}
        </div>
      </div>

      {eview === 'list' && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 24px', background: V.surface2, borderBottom: `1px solid ${V.line}` }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.ink2, cursor: 'pointer', marginRight: 6 }}>
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />隱藏已完成<span style={{ fontFamily: MONO, color: V.faint }}>{doneN}</span>
          </label>
          <span style={{ fontSize: 12, color: V.muted2 }}>篩選</span>
          <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} style={{ ...FSEL, ...(fOwner ? FON : null) }}>
            <option value="">全部負責人</option>
            {ownerList.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__none__">（未指派）</option>
            {goneN > 0 && <option value="__gone__">⚠ 負責人已不在清單（{goneN}）</option>}
          </select>
          {!cu && <button onClick={() => setMine((v) => !v)} disabled={!S.me} title={S.me ? `只看 ${S.me} 負責的` : '請先在右上角選擇「我是」'} style={{ ...FSEL, ...(mine ? FON : null), opacity: S.me ? 1 : 0.5 }}>只看我的</button>}
          <select value={fMachine} onChange={(e) => setFMachine(e.target.value)} style={{ ...FSEL, ...(fMachine ? FON : null) }}>
            <option value="">全部機台</option>
            {[...new Set([...S.machines, ...machines])].sort(byName).map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="__none__">（未指定機台）</option>
          </select>
          {!cu && <select value={fPrio} onChange={(e) => setFPrio(e.target.value)} style={{ ...FSEL, ...(fPrio ? FON : null) }}>
            <option value="">全部優先度</option>
            {PRIO.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>}
          {extra && <button onClick={clearExtra} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: V.muted2 }}>清除篩選</button>}
          {!cu && goneN > 0 && (
            <button onClick={() => setFOwner(fOwner === '__gone__' ? '' : '__gone__')} title="這些工作的負責人帳號已停用或刪除（或已從成員清單移除），請改派" style={{ border: `1px solid oklch(0.85 0.06 25)`, background: fOwner === '__gone__' ? OVER : 'oklch(0.97 0.02 25)', color: fOwner === '__gone__' ? '#fff' : OVER, borderRadius: 7, height: 30, padding: '0 10px', fontSize: 12, cursor: 'pointer', marginLeft: 6 }}>
              ⚠ {goneN} 筆工作的負責人已不在清單{fOwner === '__gone__' ? '（顯示中，點一下取消）' : '，點一下只看這些'}
            </button>
          )}
          {!cu && clashByRow.size > 0 && <span style={{ fontSize: 12, color: CLASH, marginLeft: 6 }} title="工程項目的機台與日期，和機台生產排程重疊">⚠ {clashByRow.size} 筆工程項目與生產排程撞機台</span>}
          {!cu && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowExport((v) => !v)} style={FSEL}>匯出 CSV ▾</button>
              {showExport && (
                <>
                  <div onClick={() => setShowExport(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                  <div style={{ position: 'absolute', top: 34, right: 0, width: 230, zIndex: 10, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', padding: 6, display: 'flex', flexDirection: 'column' }}>
                    {[['eng', `工程清單（目前顯示的 ${list.length} 筆）`], ['engAll', `工程清單（全部 ${S.rows.length} 筆）`], ['plan', `生產排程（${S.plans.length} 筆）`], ['log', `進度紀錄（${S.logs.length} 則）`]].map(([k, l]) => (
                      <button key={k} className="member-item" onClick={() => { setShowExport(false); exportCSV(S, k, list); }} style={{ textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>{l}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button disabled={!S.canEdit && !S.canPlan} onClick={() => setImporting(true)} title="從 Excel 複製多列後貼上" style={{ ...FSEL, opacity: !S.canEdit && !S.canPlan ? 0.5 : 1 }}>從 Excel 貼上匯入</button>
          </div>}
        </div>
      )}
      {eview === 'gantt' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {S.rows.length === 0 ? <div style={{ background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10, padding: 48, textAlign: 'center', fontSize: 14, color: V.muted2 }}>工程清單中還沒有資料。</div> : <Gantt D={D} picked={picked} setPicked={setPicked} />}
        </div>
      )}
      {eview === 'list' && !canDrag && !ro && S.rows.length > 1 && <HintBar>目前是排序／篩選檢視，無法調整順序。把排序改成「自訂順序」並清除篩選與搜尋後，就能拖曳每列左側的 ⋮⋮ 換位置。</HintBar>}
      <div ref={scroller} style={{ flex: 1, overflow: 'auto', padding: '18px 24px 40px', display: eview === 'list' ? undefined : 'none' }}>
        <div style={{ width: vcols.reduce((a, b) => a + b, 0) + 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridOf(vcols), position: 'sticky', top: 0, zIndex: 6, background: V.head, border: `1px solid ${V.line3}`, borderRadius: 8, boxShadow: `0 -18px 0 ${V.bg}` }}>
            {HEADS.map(([en, zh], i) => cu && !CUST_ENG_COLS.has(i) ? null : (
              <div key={i} style={{ position: 'relative', padding: '8px 10px', fontSize: 12, fontWeight: 500, color: V.ink2, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <span>{en}</span><span style={{ fontSize: 10, color: V.faint }}>{zh}</span>
                {i > 0 && i < HEADS.length - 1 && <div className="colgrip" title="左右拖曳調整寬度（連點兩下還原）" onPointerDown={(e) => startResize(i, e)} onDoubleClick={() => resetCol(i)} />}
              </div>
            ))}
          </div>
          {list.map((r, i) => (
            <WorkCard key={r.id} r={r} rank={rankOf.get(r.id)} S={S} ro={ro} dnd={dnd} canDrag={canDrag}
              cols={cols} first={i === 0} last={i === list.length - 1} dragging={dragId === r.id}
              over={over && over.id === r.id ? over.pos : null} logs={logsByRow.get(r.id) || []} onLogs={() => openLogs(r.id)} clash={clashByRow.get(r.id)} />
          ))}
          {list.length === 0 && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: V.muted2, background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10 }}>{S.rows.length === 0 ? (cu ? '目前沒有資料。' : '還沒有任何工作，按「＋ 新增一筆」開始。') : '沒有符合條件的資料'}</div>}
          {dragId && lastItem && (
            <div onDragOver={(e) => { if (canDrag) { e.preventDefault(); setOver({ id: lastItem.id, pos: 'after' }); } }} onDrop={(e) => dnd.drop(e, lastItem)} style={{ height: 36 }} />
          )}
          {!ro && list.length > 0 && <div className="add-row" onClick={addRow} style={{ padding: '10px 14px', fontSize: 13, color: V.muted2, cursor: 'pointer', borderRadius: 8, border: `1px dashed ${V.line3}`, textAlign: 'center' }}>＋ 新增一筆</div>}
        </div>
      </div>

      {importing && <ImportModal S={S} onClose={() => setImporting(false)} />}
      {removing && (
        <RemoveOwnerModal
          name={removing}
          rows={S.rows.filter((r) => r.owner === removing)}
          others={S.owners.filter((o) => o !== removing)}
          onCancel={() => setRemoving(null)}
          onConfirm={async (plan) => { const n = removing; setRemoving(null); await S.removeOwner(n, plan); }}
        />
      )}
    </div>
  );
}

export { WorklistPage };
