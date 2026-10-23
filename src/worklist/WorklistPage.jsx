import React, { useState, useMemo, useRef } from 'react';
import { PRIO, STATUS, V } from '../lib/theme';
import { byName, lsGet, lsSet } from '../lib/util';
import { useCols } from '../ui/common';
import { Dropdown, MenuItem } from '../ui/menu';
import { CLASH, COLMIN, COLS_KEY, COLW0, COL_DEFAULT, COL_FIXED, COL_LABEL, HEADS, SHOW_KEY, SORTS, colTemplate, engPlanClash } from './parts';
import { WorkCard } from './WorkCard';
import { sortLogs } from './logs';
import { ImportModal, exportCSV } from './io';
import { CUST_ENG_COLS } from '../ui/tabs';

// 要顯示的欄位（記在各人瀏覽器）；客戶帳號固定只看開放的欄位
function useShown(cu) {
  const [show, setShow] = useState(() => { try { const a = JSON.parse(lsGet(SHOW_KEY)); if (Array.isArray(a)) return a; } catch (e) {} return COL_DEFAULT; });
  const shown = cu ? [...CUST_ENG_COLS] : HEADS.map((_, i) => i).filter((i) => COL_FIXED.includes(i) || show.includes(i));
  const toggle = (i) => { const n = show.includes(i) ? show.filter((x) => x !== i) : [...show, i]; setShow(n); lsSet(SHOW_KEY, JSON.stringify(n)); };
  const reset = () => { setShow(COL_DEFAULT); lsSet(SHOW_KEY, JSON.stringify(COL_DEFAULT)); };
  return { shown, show, toggle, reset };
}

function WorklistPage({ S, D, openLogs, goTimeline }) {
  const [sortKey, setSortKey] = useState('order');
  const [sortDir, setSortDir] = useState(1);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(null);
  const [hideDone, setHideDoneState] = useState(() => lsGet('list.hideDone') !== '0');
  const setHideDone = (v) => { setHideDoneState(v); lsSet('list.hideDone', v ? '1' : '0'); };
  // P5：「只看我的」記住每個人上次的選擇
  const [mineOn, setMineState] = useState(() => lsGet('list.mine') === '1');
  const setMine = (v) => { setMineState(v); lsSet('list.mine', v ? '1' : '0'); };
  const [fOwner, setFOwner] = useState(''), [fMachine, setFMachine] = useState(''), [fPrio, setFPrio] = useState('');
  const [importing, setImporting] = useState(false);
  const [cols, startResize, resetCol] = useCols(COLS_KEY, COLW0, COLMIN, [0, COLW0.length - 1]);
  const logsByRow = useMemo(() => { const m = new Map(); sortLogs(S.logs).forEach((l) => { if (!m.has(l.rowId)) m.set(l.rowId, []); m.get(l.rowId).push(l); }); return m; }, [S.logs]);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const scroller = useRef(null);
  const ro = !S.canEdit, cu = S.isCust;
  const mine = !cu && mineOn && !!S.me;
  const C = useShown(cu);
  const ownerList = cu ? [...new Set(S.rows.map((r) => r.owner).filter(Boolean))].sort(byName) : S.owners;

  const q = query.trim().toLowerCase();
  const nFilter = [fOwner, fMachine, fPrio].filter(Boolean).length + (sortKey !== 'order' ? 1 : 0);
  let list = S.rows.filter((r) => (!filter || r.status === filter) && (!hideDone || filter === '已完成' || r.status !== '已完成')
    && (!fOwner || (fOwner === '__none__' ? !r.owner : fOwner === '__gone__' ? (!!r.owner && !S.owners.includes(r.owner)) : r.owner === fOwner)) && (!mine || r.owner === S.me)
    && (!fMachine || (fMachine === '__none__' ? !r.machine : r.machine === fMachine)) && (!fPrio || r.priority === fPrio)
    && (!q || [r.item, r.owner, r.custOwner, r.machine, r.remark, ...(logsByRow.get(r.id) || []).map((l) => l.text)].join(' ').toLowerCase().includes(q)));
  if (sortKey !== 'order') {
    const k = sortKey;
    const val = (r) => {
      if (k === 'priority') return PRIO.indexOf(r.priority);
      if (k === 'status') return STATUS.indexOf(r.status);
      if (k === 'days') return Number(r.days) || 0;
      if (k === 'due') return r.due || '9999-99-99';
      if (k === 'owner') return r.owner || '￿';
      return r[k] || '';
    };
    list = [...list].sort((a, b) => { const x = val(a), y = val(b); return x < y ? -sortDir : x > y ? sortDir : 0; });
  }
  const rankOf = useMemo(() => new Map(S.rows.map((r, i) => [r.id, i + 1])), [S.rows]);
  const machines = [...new Set(S.rows.map((r) => (r.machine || '').trim()).filter(Boolean))].sort();
  const canDrag = !ro && sortKey === 'order' && !filter && !q && !nFilter && !mine;
  const doneN = S.rows.filter((r) => r.status === '已完成').length;
  const goneN = S.rows.filter((r) => r.owner && !S.owners.includes(r.owner) && r.status !== '已完成').length;
  const clashByRow = useMemo(() => engPlanClash(D.rows, S.plans), [D.rows, S.plans]);
  const clearFilters = () => { setFOwner(''); setFMachine(''); setFPrio(''); setSortKey('order'); setSortDir(1); };

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

  const addRow = () => {
    setFilter(null); setQuery(''); clearFilters(); setMine(false);
    S.add();
    setTimeout(() => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, 200);
  };
  const lastItem = list[list.length - 1];
  const minW = C.shown.reduce((a, i) => a + cols[i], 0) + 2;
  const tpl = colTemplate(C.shown, cols);
  const sel = (label, value, set, opts) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 10px', fontSize: 11, color: V.muted2 }}>
      {label}
      <select className="field" value={value} onChange={(e) => set(e.target.value)} style={{ height: 30, fontSize: 12.5, color: V.ink, ...(value ? { borderColor: V.btnBg } : null) }}>{opts}</select>
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* P3：工具列只留一排——常用的放外面，其他收進「篩選」「更多」 */}
      <div className="toolbar flat">
        <input className="field search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜尋"
          placeholder={cu ? '搜尋工作、負責人、機台…' : '搜尋工作、負責人、機台、紀錄…'} style={{ width: 210 }} />
        <div className="seg" role="group" aria-label="依狀態篩選" style={{ flexWrap: 'wrap' }}>
          {[null, ...STATUS].map((k) => {
            const n = k ? S.rows.filter((r) => r.status === k).length : S.rows.length;
            return (
              <button key={k || 'all'} className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)} style={!n && filter !== k ? { opacity: 0.5 } : null}>
                {k || '全部'}<span className="n">{n}</span>
              </button>
            );
          })}
        </div>
        {!cu && <button className={'chip' + (mine ? ' on' : '')} aria-pressed={mine} onClick={() => setMine(!mineOn)} disabled={!S.me} title={S.me ? `只看 ${S.me} 負責的（會記住）` : '請先在右上角選擇「我是」'}>只看我的</button>}
        <Dropdown label={<>篩選{nFilter > 0 && <span className="badge">{nFilter}</span>} ▾</>} btnClass={'btn btn-sm' + (nFilter ? ' on' : '')} align="left" width={260}>
          {sel('負責人', fOwner, setFOwner, <>
            <option value="">全部</option>
            {ownerList.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__none__">（未指派）</option>
            {goneN > 0 && <option value="__gone__">⚠ 負責人已不在清單（{goneN}）</option>}
          </>)}
          {sel('機台', fMachine, setFMachine, <>
            <option value="">全部</option>
            {[...new Set([...S.machines, ...machines])].sort(byName).map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="__none__">（未指定機台）</option>
          </>)}
          {!cu && sel('優先度', fPrio, setFPrio, <><option value="">全部</option>{PRIO.map((o) => <option key={o} value={o}>{o}</option>)}</>)}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingRight: 10 }}>
            <div style={{ flex: 1 }}>{sel('排序', sortKey === 'order' ? '' : sortKey, (v) => { setSortKey(v || 'order'); setSortDir(1); }, SORTS.map(([k, l]) => <option key={k} value={k === 'order' ? '' : k}>{l}</option>))}</div>
            {sortKey !== 'order' && <button className="btn btn-sm" onClick={() => setSortDir((d) => -d)} title="切換正序／倒序" aria-label="切換正序／倒序" style={{ marginBottom: 4 }}>{sortDir > 0 ? '▲' : '▼'}</button>}
          </div>
          <div className="pop-sep" />
          <label className="mi"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />隱藏已完成<span className="k">{doneN}</span></label>
          {nFilter > 0 && <><div className="pop-sep" /><MenuItem onClick={clearFilters}>清除篩選與排序</MenuItem></>}
        </Dropdown>
        {!cu && goneN > 0 && (
          <button className={'chip chip-warn' + (fOwner === '__gone__' ? ' on' : '')} onClick={() => setFOwner(fOwner === '__gone__' ? '' : '__gone__')}
            title="這些工作的負責人帳號已停用或刪除（或已從成員清單移除），點一下只看這些，請改派">⚠ {goneN} 筆負責人已不在</button>
        )}
        {!cu && clashByRow.size > 0 && <span style={{ fontSize: 12, color: CLASH }} title="工程項目的機台與日期，和機台生產排程重疊（看機台欄的紫色提示）">⚠ {clashByRow.size} 筆撞機台</span>}
        <span className="grow" />
        {!cu && (
          <Dropdown label="⋯ 更多" btnClass="btn btn-sm" width={250}>
            {(close) => (
              <>
                <div className="pop-title">顯示欄位（只影響這台電腦）</div>
                {Object.entries(COL_LABEL).map(([i, l]) => (
                  <label key={i} className="mi"><input type="checkbox" checked={C.show.includes(+i)} onChange={() => C.toggle(+i)} />{l}</label>
                ))}
                <MenuItem onClick={C.reset}>恢復預設欄位</MenuItem>
                <div className="pop-sep" />
                <div className="pop-title">匯出 CSV</div>
                {[['eng', `工程清單（目前顯示的 ${list.length} 筆）`], ['engAll', `工程清單（全部 ${S.rows.length} 筆）`], ['plan', `生產排程（${S.plans.length} 筆）`], ['log', `進度紀錄（${S.logs.length} 則）`]].map(([k, l]) => (
                  <MenuItem key={k} onClick={() => { close(); exportCSV(S, k, list); }}>{l}</MenuItem>
                ))}
                <div className="pop-sep" />
                <MenuItem disabled={!S.canEdit && !S.canPlan} onClick={() => { close(); setImporting(true); }}>從 Excel 貼上匯入…</MenuItem>
              </>
            )}
          </Dropdown>
        )}
        {!cu && <button className="btn btn-sm" onClick={() => goTimeline('eng')} title="到「時程圖」看工程排程">📅 時程圖</button>}
        {!cu && <button className="btn btn-primary" disabled={ro} onClick={addRow}>＋ 新增一筆</button>}
      </div>

      <div ref={scroller} style={{ flex: 1, overflow: 'auto', padding: '12px 24px 40px' }}>
        <div style={{ minWidth: minW, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="tbl">
          <div className="tbl-head" style={{ gridTemplateColumns: tpl }}>
            {C.shown.map((i) => (
              <div key={i}>
                <span>{HEADS[i][1] || HEADS[i][0]}</span>
                {!COL_FIXED.includes(i) || i === 1 ? <div className="colgrip" title="左右拖曳調整寬度（連點兩下還原）" onPointerDown={(e) => startResize(i, e)} onDoubleClick={() => resetCol(i)} /> : null}
              </div>
            ))}
          </div>
          {list.map((r, i) => (
            <WorkCard key={r.id} r={r} rank={rankOf.get(r.id)} S={S} ro={ro} dnd={dnd} canDrag={canDrag}
              cols={cols} shown={C.shown} first={i === 0} last={i === list.length - 1} dragging={dragId === r.id}
              over={over && over.id === r.id ? over.pos : null} logs={logsByRow.get(r.id) || []} onLogs={() => openLogs(r.id)} clash={clashByRow.get(r.id)} />
          ))}
          {list.length === 0 && <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: V.muted2 }}>{S.rows.length === 0 ? (cu ? '目前沒有資料。' : '還沒有任何工作，按「＋ 新增一筆」開始。') : mine ? `沒有 ${S.me} 負責、符合條件的工作。` : '沒有符合條件的資料'}</div>}
          {dragId && lastItem && (
            <div onDragOver={(e) => { if (canDrag) { e.preventDefault(); setOver({ id: lastItem.id, pos: 'after' }); } }} onDrop={(e) => dnd.drop(e, lastItem)} style={{ height: 36 }} />
          )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!ro && list.length > 0 && <button className="btn btn-sm btn-ghost" onClick={addRow}>＋ 新增一筆</button>}
            <span className="mono muted" style={{ marginLeft: 'auto', fontSize: 11.5 }}>顯示 {list.length} / {S.rows.length} 筆{hideDone && doneN > 0 && filter !== '已完成' ? `（已隱藏 ${doneN} 筆已完成）` : ''}</span>
          </div>
        </div>
      </div>

      {importing && <ImportModal S={S} onClose={() => setImporting(false)} />}
    </div>
  );
}

export { WorklistPage };
