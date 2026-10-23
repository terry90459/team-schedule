import React, { useState, useEffect } from 'react';
import { MONO, V } from '../lib/theme';
import { byName, diff, md, s2d } from '../lib/util';
import { CellText } from '../ui/common';
import { tabName } from '../ui/tabs';
import { DeleteBtn } from '../worklist/ItemDetail';

/* ============================================================
   V2：生產排程——依機台分組的清單＋右側詳情
   ============================================================ */
const daysOf = (p) => (p.start && p.end ? diff(s2d(p.end), s2d(p.start)) + 1 : null);
// 同一台機台、日期重疊的排程
function planClash(plans) {
  const ids = new Set();
  plans.forEach((a) => plans.forEach((b) => { if (a.id !== b.id && a.machine && a.machine === b.machine && a.start && a.end && b.start && b.end && a.start <= b.end && b.start <= a.end) ids.add(a.id); }));
  return ids;
}

function HwSwitch({ on, onChange, disabled }) {
  return (
    <button role="switch" aria-checked={!!on} aria-label="需要 HW team 協助" disabled={disabled} onClick={() => onChange(!on)} title={on ? '需要 HW team 協助（點一下取消）' : '點一下標記為需要 HW team 協助'}
      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', padding: 2, cursor: disabled ? 'default' : 'pointer', background: on ? 'oklch(0.62 0.15 50)' : V.line3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .15s', flex: 'none' }}>
      <span style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
    </button>
  );
}

function PlanItem({ p, S, sel, onOpen, clash, showScope, today }) {
  const n = daysOf(p);
  const bad = n !== null && n < 1;
  const live = p.start && p.end && s2d(p.start) <= today && today <= s2d(p.end);
  const meta = [p.group && <span key="g">{p.group}</span>, showScope && <span key="c">{tabName(S, p.customer)}</span>, p.remark && !S.isCust && <span key="r" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.remark.split('\n')[0]}</span>].filter(Boolean);
  return (
    <div className={'item' + (sel ? ' sel' : '')} data-plan={p.id} role="button" tabIndex={0} aria-label={`開啟「${p.product || '未命名'}」`}
      onClick={() => onOpen(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.id); }} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
      <div style={{ minWidth: 0 }}>
        <div className="t">{(p.product || '').split('\n')[0] || <span style={{ color: V.faint, fontWeight: 400 }}>（未命名）</span>}</div>
        <div className="m">
          {live && <span className="tag" style={{ background: 'var(--accentSoft)', color: 'var(--accent)' }}>生產中</span>}
          {p.hw && !S.isCust && <span className="tag hw">需 HW</span>}
          {clash && !S.isCust && <span className="tag p1" title="同一台機台有日期重疊的排程">日期重疊</span>}
          {meta.map((x, i) => <React.Fragment key={i}>{i > 0 && <span className="sep">·</span>}{x}</React.Fragment>)}
        </div>
      </div>
      <div className="due" style={bad ? { color: 'var(--over)' } : null}>
        {p.start && p.end ? `${md(s2d(p.start))} → ${md(s2d(p.end))}` : <span style={{ color: V.faint }}>日期未定</span>}
        <small style={{ color: bad ? 'var(--over)' : V.faint }}>{bad ? '日期有誤' : n ? `${n} 天` : ''}</small>
      </div>
    </div>
  );
}

function PlanDetail({ id, S, onClose, clash }) {
  const p = S.plans.find((x) => x.id === id);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  if (!p) return (
    <aside className="detail" aria-label="排程詳情">
      <div className="d-head"><div className="d-top">排程詳情<button className="d-close" onClick={onClose} aria-label="關閉">×</button></div></div>
      <div className="empty"><b>找不到這筆排程</b>可能已被刪除。</div>
    </aside>
  );
  const ro = !S.canPlan, cu = S.isCust;
  const set = (k) => (v) => S.patchPlan(p.id, { [k]: v });
  const n = daysOf(p), bad = n !== null && n < 1;
  const opts = [...new Set([...S.machines, ...(p.machine ? [p.machine] : [])])].sort(byName);
  return (
    <aside className="detail" aria-label="排程詳情">
      <div className="d-head">
        <div className="d-top"><span>生產排程</span>{!cu && S.customers.length > 1 && <span>・{tabName(S, p.customer)}</span>}<button className="d-close" onClick={onClose} title="關閉（Esc）" aria-label="關閉">×</button></div>
        <CellText key={p.id} multiline grow enterBlur className="d-title" value={p.product} onCommit={set('product')} disabled={ro} placeholder="輸入產品名稱…" />
        {clash && !cu && <span className="tag p1" style={{ alignSelf: 'flex-start' }}>同一台機台有日期重疊的排程</span>}
      </div>
      <div className="d-body">
        <div className="d-fields">
          <label>機台</label>
          <select className="d-in" aria-label="機台" value={p.machine || ''} disabled={ro} onChange={(e) => set('machine')(e.target.value)} style={{ fontFamily: MONO, fontSize: 12.5 }}>
            <option value="">（未指定）</option>{opts.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <label>Group</label>
          <CellText key={p.id + 'g'} className="d-in" value={p.group} onCommit={set('group')} disabled={ro} placeholder="—" />
          <label>開始日</label>
          <input className="d-in" type="date" aria-label="開始日" value={p.start || ''} disabled={ro} onChange={(e) => set('start')(e.target.value)} style={{ fontFamily: MONO, fontSize: 12.5 }} />
          <label>結束日</label>
          <input className="d-in" type="date" aria-label="結束日" value={p.end || ''} disabled={ro} onChange={(e) => set('end')(e.target.value)} style={{ fontFamily: MONO, fontSize: 12.5, color: bad ? 'var(--over)' : undefined }} />
          <label>天數</label>
          <span className="mono" style={{ padding: '0 8px', fontSize: 12.5, color: bad ? 'var(--over)' : V.muted }}>{bad ? '結束日早於開始日' : n ? `${n} 天` : '—'}</span>
          {!cu && <>
            <label>需 HW 協助</label>
            <span style={{ padding: '0 8px' }}><HwSwitch on={p.hw} disabled={ro} onChange={set('hw')} /></span>
            {S.customers.length > 1 && <>
              <label>客戶分頁</label>
              <select className="d-in" aria-label="客戶分頁" value={p.customer || ''} disabled={ro} onChange={(e) => S.movePlanTab(p.id, e.target.value).then(() => S.say(`已移到「${tabName(S, e.target.value)}」`))}>
                {!S.customers.some((c) => c.id === p.customer) && <option value={p.customer || ''}>⚠ 未分類</option>}
                {S.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.internal ? '（內部）' : ''}</option>)}
              </select>
            </>}
            <label style={{ alignSelf: 'start', paddingTop: 8 }}>備註</label>
            <CellText key={p.id + 'r'} multiline grow className="d-in" value={p.remark} onCommit={set('remark')} disabled={ro} placeholder="—" style={{ resize: 'none', overflow: 'hidden' }} />
          </>}
        </div>
      </div>
      {!cu && (
        <div className="d-foot">
          <span className="hint mono">{p.updated ? `更新 ${p.updated.slice(5)}${p.updatedBy ? '・' + p.updatedBy : ''}` : ''}</span>
          {!ro && <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => S.addPlan('', p).then((nid) => nid && S.say('已複製一筆，可以再改機台或日期'))}>複製一筆</button>}
          {!ro && <DeleteBtn onDelete={() => { onClose(); S.delPlan(p.id); }} />}
        </div>
      )}
    </aside>
  );
}

function PlanListPage({ S, sel, open, showScope, goTimeline, head }) {
  const [q, setQ] = useState(''), [mf, setMf] = useState(''), [hwOnly, setHwOnly] = useState(false);
  const cu = S.isCust, ro = !S.canPlan;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const clashIds = planClash(S.plans);
  const ql = q.trim().toLowerCase();
  const list = S.plans.filter((p) => (!mf || p.machine === mf) && (!hwOnly || p.hw) && (!ql || [p.machine, p.group, p.product, p.remark].some((x) => (x || '').toLowerCase().includes(ql))));
  const used = [...new Set([...S.machines, ...S.plans.map((p) => p.machine).filter(Boolean)])].sort(byName);
  const groups = [...used, ''].map((m) => ({ m, l: list.filter((p) => (p.machine || '') === m).sort((a, b) => (a.start || '9') < (b.start || '9') ? -1 : 1) })).filter((g) => g.l.length);
  const add = () => S.addPlan(mf).then((id) => id && open(id));
  return (
    <>
      {head({
        title: '生產排程', sub: `${S.plans.length} 筆排程${clashIds.size && !cu ? `・${clashIds.size} 筆日期重疊` : ''}`,
        acts: <>{!cu && <button className="btn btn-sm" onClick={() => goTimeline('plan')}>看時程圖</button>}{!cu && <button className="btn btn-primary" disabled={ro} onClick={add}>＋ 新增排程</button>}</>,
      })}
      <div className="filters">
        <input className="field search" type="search" aria-label="搜尋" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋機台、Group、產品…" style={{ width: 240 }} />
        <select className="field" aria-label="機台" value={mf} onChange={(e) => setMf(e.target.value)}><option value="">全部機台</option>{used.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        {!cu && <button className={'chip' + (hwOnly ? ' on' : '')} aria-pressed={hwOnly} onClick={() => setHwOnly((v) => !v)}>只看需 HW 協助<span className="n">{S.plans.filter((p) => p.hw).length}</span></button>}
      </div>
      <div className="page-body">
        {!cu && S.machines.length === 0 && <div className="info-box" style={{ marginBottom: 12 }}>還沒有機台。{S.canAdmin ? '請到「管理 → 機台」新增。' : '請管理員到「管理 → 機台」新增。'}</div>}
        {groups.length === 0
          ? <div className="list"><div className="empty"><b>{S.plans.length ? '沒有符合條件的排程' : '還沒有任何排程'}</b>{!S.plans.length && !cu && !ro ? '按右上角「＋ 新增排程」開始。' : ''}</div></div>
          : groups.map((g) => (
            <div key={g.m || 'none'} className="list">
              <div className="grp-h"><span className="mono">{g.m || '（未指定機台）'}</span><span className="n">{g.l.length}</span></div>
              {g.l.map((p) => <PlanItem key={p.id} p={p} S={S} sel={sel === p.id} onOpen={open} clash={clashIds.has(p.id)} showScope={showScope} today={today} />)}
            </div>
          ))}
      </div>
    </>
  );
}

export { daysOf, planClash, HwSwitch, PlanItem, PlanDetail, PlanListPage };
