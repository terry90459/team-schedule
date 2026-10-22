import React, { useState, useEffect } from 'react';
import { MONO, OVER, PRBAR, PRIO, SOON, STATUS, STC, STTX, UN, V } from '../lib/theme';
import { addD, byName, dstr, s2d, validPlan } from '../lib/util';
import { Avatar, card } from '../ui/common';

/* ============================================================
   儀表板：總覽／個人甘特圖／卡片看板
   ============================================================ */

const PCOLS = 'minmax(0,1fr) 56px 56px 64px 50px 60px';
// B7：生產排程統計
function planParts(S, today) {
  const ts = dstr(today), t7 = dstr(addD(today, 7)), H = 30, hiS = dstr(addD(today, H - 1));
  const vp = S.plans.filter(validPlan);
  const now = vp.filter((p) => p.start <= ts && ts <= p.end);
  const soon = vp.filter((p) => p.start > ts && p.start <= t7);
  const hw = vp.filter((p) => p.hw && p.end >= ts);
  const clash = new Set();
  vp.forEach((a) => vp.forEach((b) => { if (a.id !== b.id && a.machine && a.machine === b.machine && a.start <= b.end && b.start <= a.end && a.end >= ts) clash.add(a.id); }));
  const mset = [...new Set([...S.machines, ...vp.map((p) => p.machine).filter(Boolean)])].sort(byName);
  const rows = mset.map((m) => {
    const l = vp.filter((p) => p.machine === m);
    const days = new Set();
    l.forEach((p) => { let d = s2d(p.start < ts ? ts : p.start); const e = s2d(p.end > hiS ? hiS : p.end); while (d <= e) { days.add(dstr(d)); d = addD(d, 1); } });
    const cur = l.filter((p) => p.start <= ts && ts <= p.end);
    const next = l.filter((p) => p.start > ts).sort((a, b) => a.start.localeCompare(b.start))[0];
    return { m, used: days.size, cur, next, hw: l.some((p) => p.hw && p.end >= ts) };
  });
  const kpis = [
    { label: '今天生產中', value: now.length, sub: `${new Set(now.map((p) => p.machine)).size} 台機台` },
    { label: '未來 7 天開始', value: soon.length, sub: soon.length ? soon.map((p) => p.machine).filter(Boolean).slice(0, 3).join('、') + (soon.length > 3 ? '…' : '') : '—' },
    { label: '需 HW team 協助', value: hw.length, sub: '進行中或尚未開始', fg: hw.length ? 'oklch(0.55 0.15 50)' : V.ink },
    { label: '日期重疊', value: clash.size, sub: '同機台排程重疊（未結束）', fg: clash.size ? 'oklch(0.55 0.13 50)' : V.ink },
  ];
  const th = { fontSize: 11, color: V.muted2, background: V.tint, borderTop: `1px solid ${V.line}`, borderBottom: `1px solid ${V.line}` };
  const G = 'minmax(0,0.7fr) minmax(0,1.6fr) 150px';
  return {
    kpis: (
      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>生產排程</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: V.tint, border: `1px solid ${V.line}`, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: V.muted }}>{k.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, lineHeight: 1.1, color: k.fg || V.ink }}>{k.value}</span>
            <span style={{ fontSize: 12, color: V.muted2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</span>
          </div>
        ))}
      </div>
      </div>
    ),
    table: (
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 8 }}><h2 style={{ margin: 0, fontSize: 15 }}>各機台生產排程</h2><span style={{ fontSize: 12, color: V.muted2 }}>{rows.length} 台</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: G, padding: '8px 20px', gap: 12, ...th }}>
          <span>機台</span><span>今天／下一筆</span><span>未來 {H} 天已排</span>
        </div>
        {rows.length === 0 && <div style={{ padding: '20px', fontSize: 13, color: V.muted2 }}>還沒有機台或生產排程</div>}
        {rows.map((r) => (
          <div key={r.m} style={{ display: 'grid', gridTemplateColumns: G, gap: 12, padding: '9px 20px', fontSize: 13, borderBottom: `1px solid ${V.line}`, alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, display: 'flex', alignItems: 'center', gap: 6 }}>{r.m}{r.hw && <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, background: 'oklch(0.62 0.15 50)', color: '#fff', fontFamily: 'inherit' }}>HW</span>}</span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.4 }}>
              <span style={{ color: r.cur.length ? V.ink : V.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.cur.length ? r.cur.map((p) => [p.group, p.product].filter(Boolean).join(' · ').replace(/\n/g, ' ')).join('；') : '閒置'}</span>
              {r.next && <span style={{ fontSize: 11.5, color: V.muted2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>下一筆 {r.next.start.slice(5).replace('-', '/')} {[r.next.group, r.next.product].filter(Boolean).join(' · ').replace(/\n/g, ' ')}</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, height: 8, background: V.head, borderRadius: 4, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: (r.used / H) * 100 + '%', background: 'oklch(0.7 0.13 150)', borderRadius: 4 }} /></span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted, width: 48, textAlign: 'right' }}>{r.used} 天</span>
            </span>
          </div>
        ))}
      </div>
    ),
  };
}
// 總覽：全寬排版；寬螢幕三欄、較窄時兩欄
function useWinW() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}
function Overview({ D, S, goGantt }) {
  const w = useWinW();
  const e = engParts(D, goGantt), pl = planParts(S, D.today);
  const cols = w >= 1500 ? 3 : 2;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {e.kpis}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 14, alignItems: 'stretch' }}>
        {e.status}{e.prio}{pl.kpis}
        {e.people}{e.machines}{pl.table}
      </div>
    </div>
  );
}
function engParts(D, goGantt) {
  const { rows, names } = D;
  const total = rows.length, done = rows.filter((r) => r.status === '已完成').length, overdue = rows.filter((r) => r.over).length, soonN = rows.filter((r) => r.soon).length;
  const mm = {};
  rows.forEach((r) => { const m = (r.machine || '').trim(); if (m) (mm[m] = mm[m] || []).push(r); });
  const machines = Object.keys(mm).sort().map((k) => { const l = mm[k]; return { name: k, count: l.length, open: l.filter((r) => r.status !== '已完成').length, owners: [...new Set(l.map((r) => r.owner))].join('、') }; });
  const kpis = [
    { label: '工作總數', value: total, sub: `${rows.filter((r) => r.status === '進行中').length} 件進行中・${rows.filter((r) => r.status === '等客戶回覆').length} 件等客戶・${rows.filter((r) => r.status === '暫停').length} 件暫停`, fg: V.ink },
    { label: '已完成', value: done, sub: total ? `完成率 ${Math.round((done / total) * 100)}%` : '—', fg: STTX['已完成'] },
    { label: '未完成', value: total - done, sub: <>逾期 <b style={{ color: overdue ? OVER : 'inherit' }}>{overdue}</b> 件・3 天內到期 <b style={{ color: soonN ? SOON.fg : 'inherit' }}>{soonN}</b> 件</>, fg: overdue ? OVER : V.ink },
    { label: '參與人員', value: names.filter((n) => n !== UN).length, sub: names.includes(UN) ? `另有 ${rows.filter((r) => r.owner === UN).length} 件未指派` : '全部已指派', fg: V.ink },
    { label: '已安排機台', value: machines.length, sub: `${rows.filter((r) => (r.machine || '').trim()).length} 件工作使用機台`, fg: V.ink },
  ];
  const statusBars = STATUS.map((k) => { const c = rows.filter((r) => r.status === k).length; return { label: k, count: c, pct: total ? (c / total) * 100 + '%' : '0%', fg: STC[k] }; });
  const maxP = Math.max(1, ...PRIO.map((p) => rows.filter((r) => r.priority === p).length));
  const prioBars = PRIO.map((p) => { const l = rows.filter((r) => r.priority === p); return { label: p, count: l.length, open: l.filter((r) => r.status !== '已完成').length, pct: (l.length / maxP) * 100 + '%', bar: PRBAR[p], fg: p === '擱置' ? V.muted2 : p === '最優先' ? 'oklch(0.58 0.16 25)' : V.ink2 }; });
  const people = names.map((n) => { const l = rows.filter((r) => r.owner === n); const o = l.filter((r) => r.over).length; return { name: n, count: l.length, done: l.filter((r) => r.status === '已完成').length, over: o, soon: l.filter((r) => r.soon).length, days: l.reduce((a, r) => a + (Number(r.days) || 0), 0) }; });
  const th = { fontSize: 11, color: V.muted2, background: V.tint, borderTop: `1px solid ${V.line}`, borderBottom: `1px solid ${V.line}` };
  return {
    kpis: (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: V.muted }}>{k.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 34, fontWeight: 500, lineHeight: 1.1, color: k.fg }}>{k.value}</span>
            <span style={{ fontSize: 12, color: V.muted2 }}>{k.sub}</span>
          </div>
        ))}
      </div>
    ),
    status: (
        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>完成狀況</h2>
          <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: V.head }}>
            {statusBars.map((s) => <div key={s.label} title={s.label} style={{ height: '100%', width: s.pct, background: s.fg }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STATUS.length},minmax(0,1fr))`, gap: 10 }}>
            {statusBars.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.muted }}><span style={{ width: 8, height: 8, borderRadius: 2, background: s.fg }} />{s.label}</div>
                <span style={{ fontFamily: MONO, fontSize: 20 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
    ),
    prio: (
        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>優先度分布</h2>
          {prioBars.map((p) => (
            <div key={p.label} style={{ display: 'grid', gridTemplateColumns: '60px minmax(0,1fr) 90px', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: p.fg }}>{p.label}</span>
              <div style={{ height: 10, background: V.head, borderRadius: 5, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 5, width: p.pct, background: p.bar }} /></div>
              <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted, textAlign: 'right' }}>{p.count} 件・{p.open} 未完</span>
            </div>
          ))}
        </div>
    ),
    people: (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 8 }}><h2 style={{ margin: 0, fontSize: 15 }}>參與人員</h2><span style={{ fontSize: 12, color: V.muted2 }}>{names.filter((n) => n !== UN).length} 人</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: PCOLS, padding: '8px 20px', ...th }}>
            <span>人員</span><span style={{ textAlign: 'right' }}>工作數</span><span style={{ textAlign: 'right' }}>已完成</span><span style={{ textAlign: 'right' }}>即將到期</span><span style={{ textAlign: 'right' }}>逾期</span><span style={{ textAlign: 'right' }}>總天數</span>
          </div>
          {people.map((p) => (
            <div key={p.name} className="person-row" onClick={() => goGantt(p.name)} style={{ display: 'grid', gridTemplateColumns: PCOLS, padding: '10px 20px', fontSize: 13, borderBottom: `1px solid ${V.line}`, cursor: 'pointer', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><Avatar name={p.name} size={24} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>{D.gone.has(p.name) && <span title="已不在工程師成員清單（帳號停用或刪除）" style={{ fontSize: 10.5, color: OVER, flex: 'none' }}>⚠ 已不在清單</span>}</div>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{p.count}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{p.done}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right', color: p.soon ? SOON.fg : V.ink2 }}>{p.soon}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right', color: p.over ? OVER : V.ink2 }}>{p.over}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{p.days}</span>
            </div>
          ))}
        </div>
    ),
    machines: (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 8 }}><h2 style={{ margin: 0, fontSize: 15 }}>已安排機台</h2><span style={{ fontSize: 12, color: V.muted2 }}>{machines.length} 台</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 60px 70px minmax(0,1.2fr)', padding: '8px 20px', ...th }}>
            <span>機台</span><span style={{ textAlign: 'right' }}>工作數</span><span style={{ textAlign: 'right' }}>未完成</span><span style={{ paddingLeft: 16 }}>負責人</span>
          </div>
          {machines.length === 0 && <div style={{ padding: '24px 20px', fontSize: 13, color: V.muted2 }}>尚未有工作填寫機台</div>}
          {machines.map((m) => (
            <div key={m.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 60px 70px minmax(0,1.2fr)', padding: '10px 20px', fontSize: 13, borderBottom: `1px solid ${V.line}`, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO }}>{m.name}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{m.count}</span>
              <span style={{ fontFamily: MONO, textAlign: 'right' }}>{m.open}</span>
              <span style={{ paddingLeft: 16, color: V.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.owners}</span>
            </div>
          ))}
        </div>
    ),
  };
}

export { PCOLS, planParts, useWinW, Overview, engParts };
