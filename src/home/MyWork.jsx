import React, { useMemo, useState } from 'react';
import { ST, V } from '../lib/theme';
import { md, s2d, validPlan } from '../lib/util';
import { engPlanClash } from '../worklist/parts';
import { ItemRow } from '../worklist/ItemRow';

/* ============================================================
   V2 首頁：我的工作——登入後先看到自己要處理的事
   依「逾期 → 3 天內到期 → 進行中 → 等待中 → 未開始 → 暫停」分組；已完成收起來
   ============================================================ */
function MyWork({ S, D, sel, open, head, meSelect, goList }) {
  const [showDone, setShowDone] = useState(false);
  const me = S.me;
  const logN = useMemo(() => { const m = new Map(); S.logs.forEach((l) => m.set(l.rowId, (m.get(l.rowId) || 0) + 1)); return m; }, [S.logs]);
  const clash = useMemo(() => engPlanClash(D.rows, S.plans), [D.rows, S.plans]);
  const mineD = D.rows.filter((r) => r.owner === me);
  const raw = new Map(S.rows.map((r) => [r.id, r]));
  const bucket = (r) => r.over ? 'over' : r.soon ? 'soon' : r.status === '進行中' ? 'doing' : ['等客戶回覆', '待審核'].includes(r.status) ? 'wait' : r.status === '未開始' ? 'todo' : r.status === '暫停' ? 'pause' : 'done';
  const G = [
    ['over', '逾期', 'var(--over)'], ['soon', '3 天內到期', 'oklch(0.66 0.15 60)'], ['doing', '進行中', ST['進行中'][1]],
    ['wait', '等客戶回覆／待審核', ST['等客戶回覆'][1]], ['todo', '未開始', ST['未開始'][1]], ['pause', '暫停', ST['暫停'][1]],
  ];
  const byDue = (a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1;
  const groups = G.map(([k, l, c]) => ({ k, l, c, rows: mineD.filter((r) => bucket(r) === k).sort(byDue) })).filter((g) => g.rows.length);
  const done = mineD.filter((r) => bucket(r) === 'done').sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  const n = (k) => mineD.filter((r) => bucket(r) === k).length;
  // 我負責的機台，今天有沒有生產排程
  const myMachines = new Set(mineD.filter((r) => r.status !== '已完成').map((r) => r.machine).filter(Boolean));
  const t = D.today;
  const plansToday = S.plans.filter((p) => validPlan(p) && myMachines.has(p.machine) && s2d(p.start) <= t && t <= s2d(p.end));
  const hour = new Date().getHours();
  const hi = hour < 11 ? '早安' : hour < 14 ? '午安' : '你好';
  const row = (r) => <ItemRow key={r.id} r={raw.get(r.id) || r} S={S} sel={sel === r.id} onOpen={open} today={t} logN={logN.get(r.id) || 0} clash={clash.has(r.id)} showScope={false} />;

  if (!me) return (
    <>
      {head({ title: '我的工作' })}
      <div className="page-body"><div className="list"><div className="empty"><b>你是哪一位？</b>選好之後，這裡會列出你負責的工作。<div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>{meSelect}</div></div></div></div>
    </>
  );
  return (
    <>
      {head({
        title: `${hi}，${me}`,
        sub: mineD.length ? `你有 ${mineD.length - done.length} 件工作還沒完成${n('over') ? `，其中 ${n('over')} 件已經逾期` : ''}` : '目前沒有指派給你的工作',
        acts: S.canEdit && <button className="btn btn-primary" onClick={() => S.add({ owner: me }).then((id) => id && open(id))}>＋ 新增我的工作</button>,
      })}
      <div className="page-body">
        <div className="stats">
          {[['over', '逾期', 'var(--over)'], ['soon', '3 天內到期', 'var(--warn)'], ['doing', '進行中', V.ink], ['wait', '等待中', V.ink]].map(([k, l, c]) => (
            <button key={k} className="stat" onClick={() => { const el = document.getElementById('grp-' + k); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <div className="k">{l}</div><div className="v" style={{ color: n(k) ? c : V.faint }}>{n(k)}</div>
            </button>
          ))}
        </div>
        {plansToday.length > 0 && (
          <div className="info-box" style={{ marginBottom: 14 }}>
            <b>今天你的機台有生產排程：</b>{plansToday.map((p) => `${p.machine}（${p.product || '未命名'}，到 ${md(s2d(p.end))}）`).join('、')}
          </div>
        )}
        {groups.length === 0 && <div className="list"><div className="empty"><b>手上沒有待處理的工作 🎉</b>想看全部的工作可以到 <a href="#" onClick={(e) => { e.preventDefault(); goList(); }}>工程清單</a>。</div></div>}
        {groups.map((g) => (
          <div key={g.k} id={'grp-' + g.k} className="list" style={{ scrollMarginTop: 12 }}>
            <div className="grp-h"><i style={{ background: g.c }} />{g.l}<span className="n">{g.rows.length}</span></div>
            {g.rows.map(row)}
          </div>
        ))}
        {done.length > 0 && (
          <div className="list">
            <button className="grp-h" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} style={{ width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <i style={{ background: ST['已完成'][1] }} />已完成<span className="n">{done.length}</span><span className="hint" style={{ marginLeft: 'auto', fontWeight: 400 }}>{showDone ? '收起' : '展開'}</span>
            </button>
            {showDone && done.map(row)}
          </div>
        )}
      </div>
    </>
  );
}

export { MyWork };
