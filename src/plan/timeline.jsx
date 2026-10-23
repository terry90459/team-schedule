import React, { useState, useEffect } from 'react';
import { MONO, UN, V, WD } from '../lib/theme';
import { addD, byName, diff, dstr, holName, hue, isOff, s2d, validPlan, ymd } from '../lib/util';
import { RangeBar, barTone, clip, useRange } from '../data/derive';
import { engPlanClash } from '../worklist/parts';

/* ============================================================
   每日一格時程圖（生產排程、時程圖頁共用）
   ============================================================ */
// 甘特圖：左欄寬度、每天最小寬度；實際每天寬度依畫面撐滿
const GANTT_LW = 320, MIN_DW = 44;
function useBoxW() {
  // callback ref：元素晚出現（例如原本沒資料）也能量到寬度
  const [el, setEl] = useState(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const f = () => setW(el.clientWidth);
    f();
    if (!window.ResizeObserver) { window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, [el]);
  return [setEl, w];
}
const fitDW = (boxW, n) => (boxW ? Math.max(MIN_DW, Math.floor((boxW - GANTT_LW - 2) / n)) : MIN_DW);
const DIM = { opacity: 0.28, filter: 'grayscale(1)', transition: 'opacity .15s' };
function useFocus() {
  const [f, setF] = useState(null); // {m, id}
  useEffect(() => { if (!f) return; const k = (e) => { if (e.key === 'Escape') setF(null); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [f]);
  return {
    f, clear: () => setF(null),
    group: (m) => setF((c) => (c && c.m === m && !c.id ? null : { m })),
    row: (m, id) => setF((c) => (c && c.id === id ? { m } : { m, id })),
    gDim: (m) => !!f && f.m !== m,
    rDim: (m, id) => !!f && (f.m !== m || (!!f.id && f.id !== id)),
    gOn: (m) => !!f && f.m === m && !f.id,
    rOn: (id) => !!f && f.id === id,
  };
}
const FOCUS_BAR = 'inset 4px 0 0 var(--accent)';
const focusHint = (F) => F.f
  ? <button onClick={F.clear} style={{ border: `1px solid ${V.line3}`, background: V.surface, borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: V.ink2 }}>✕ 取消重點（Esc）</button>
  : <span style={{ fontSize: 10, color: V.faint }}>點項目開啟詳情・點機台重點顯示</span>;
// onOpen(列 id)：列 id 是 'e' + 工作 id 或 'p' + 排程 id
function DailyGrid({ groups: allGroups, headLabel, rangeKey, onOpen }) {
  const F = useFocus();
  const R = useRange(rangeKey);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [boxRef, boxW] = useBoxW();
  const lo = R.lo, n = R.n, LW = GANTT_LW, DW = fitDW(boxW, n), W = n * DW;
  // 只留在區間內的橫條；整列都在區間外就先隱藏（日期未定的列照常顯示）
  let hidden = 0;
  const groups = allGroups.map((g) => ({
    ...g,
    rows: g.rows.map((r) => ({ ...r, bars: r.bars.map((b) => { const c = clip(b.a, b.b, R); return c && { ...b, a: c.a, b: c.b, cutL: c.cutL, cutR: c.cutR }; }).filter(Boolean), had: r.bars.length }))
      .filter((r) => { const keep = r.bars.length > 0 || r.had === 0; if (!keep) hidden++; return keep; }),
  })).filter((g) => g.rows.length);
  const days = Array.from({ length: n }, (_, i) => { const d = addD(lo, i); return { d, t: diff(d, today) === 0, we: isOff(d), hn: holName(d) }; });
  const grid = `repeating-linear-gradient(to right, transparent 0, transparent ${DW - 1}px, ${V.line} ${DW - 1}px, ${V.line} ${DW}px)`;
  const shades = days.map((x, i) => (x.t || x.we) ? <div key={i} style={{ position: 'absolute', left: i * DW, width: DW, top: 0, bottom: 0, background: x.t ? V.todayBg : V.holBody }} /> : null);
  const lines = `repeating-linear-gradient(to right, transparent 0, transparent ${DW - 1}px, rgba(255,255,255,0.75) ${DW - 1}px, rgba(255,255,255,0.75) ${DW}px)`;
  if (groups.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <RangeBar R={R} hidden={hidden} />
      <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: V.muted2, background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10 }}>{hidden ? '這個區間沒有排程，可用上方 ◀ ▶ 切換日期' : '沒有可以畫在時程上的資料（需要起訖日期）'}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <RangeBar R={R} hidden={hidden} />
    <div ref={boxRef} style={{ background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 8, overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
      <div style={{ width: LW + W, minWidth: '100%' }}>
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5, background: V.head, borderBottom: `1px solid ${V.line3}` }}>
          <div style={{ width: LW, flex: 'none', position: 'sticky', left: 0, zIndex: 6, background: V.head, padding: '8px 14px', fontSize: 12, color: V.muted, borderRight: `1px solid ${V.line3}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, alignItems: 'flex-start' }}><span>{headLabel}</span>{focusHint(F)}</div>
          <div style={{ display: 'flex', width: W }}>
            {days.map((x, i) => (
              <div key={i} title={x.hn ? `${ymd(x.d)} ${x.hn}` : ''} style={{ width: DW, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 6px', borderRight: `1px solid ${V.line}`, background: x.t ? V.todayHead : x.we ? V.holHead : 'transparent' }}>
                <span style={{ fontSize: 10, color: x.we && !x.t ? V.holFg : V.muted2, height: 13, whiteSpace: 'nowrap' }}>{i === 0 || x.d.getDate() === 1 ? x.d.getMonth() + 1 + '月' : ''}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: x.t || x.hn ? 700 : 400, color: x.t ? 'var(--accent)' : x.we ? V.holFg : V.ink2 }}>{x.d.getDate()}</span>
                <span style={{ fontSize: 10, whiteSpace: 'nowrap', color: x.t ? 'var(--accent)' : x.we ? V.holFg : V.ink2 }}>{x.t ? '今天' : x.hn ? x.hn.slice(0, 2) : WD[x.d.getDay()]}</span>
              </div>
            ))}
          </div>
        </div>
        {groups.map((g) => (
          <React.Fragment key={g.key}>
            <div onClick={() => F.group(g.key)} style={{ display: 'flex', background: V.tint, borderBottom: `1px solid ${V.line}`, cursor: 'pointer', boxShadow: F.gOn(g.key) ? FOCUS_BAR : undefined, ...(F.gDim(g.key) ? DIM : null) }}>
              <div style={{ width: LW, flex: 'none', position: 'sticky', left: 0, zIndex: 2, background: V.tint, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderRight: `1px solid ${V.line3}` }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>{g.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: V.muted2 }}>{g.rows.length} 件</span>
              </div>
            </div>
            {g.rows.map((r) => (
              <div key={r.id} onClick={() => { if (!F.rOn(r.id)) F.row(g.key, r.id); if (onOpen) onOpen(r.id); }} style={{ display: 'flex', height: 42, borderBottom: `1px solid ${V.line}`, cursor: 'pointer', boxShadow: F.rOn(r.id) ? FOCUS_BAR : undefined, ...(F.rDim(g.key, r.id) ? DIM : null) }}>
                <div style={{ width: LW, flex: 'none', position: 'sticky', left: 0, zIndex: 2, background: V.surface, padding: '0 14px 0 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: `1px solid ${V.line3}`, minWidth: 0 }}>
                  <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.tag && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, marginRight: 6, background: r.tagBg, color: r.tagFg, verticalAlign: 1 }}>{r.tag}</span>}{r.hw && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, marginRight: 6, background: 'oklch(0.62 0.15 50)', color: '#fff', verticalAlign: 1 }}>HW</span>}{r.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: V.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</span>
                </div>
                <div style={{ position: 'relative', width: W, flex: 'none', backgroundImage: grid }}>
                  {shades}
                  {r.bars.map((b, k) => (
                    <div key={k} title={b.tip} style={{ position: 'absolute', left: diff(b.a, lo) * DW, width: (diff(b.b, b.a) + 1) * DW, top: 7, height: 28, borderRadius: 5, backgroundColor: b.bg, backgroundImage: b.tent ? 'repeating-linear-gradient(135deg, transparent 0, transparent 5px, rgba(0,0,0,0.07) 5px, rgba(0,0,0,0.07) 8px)' : lines, border: `1px ${b.tent ? 'dashed' : 'solid'} ${b.bd}`, color: b.fg, fontSize: 11.5, lineHeight: '26px', padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box', zIndex: 1 }}>{b.cutL ? '‹ ' : ''}{b.text}{b.cutR ? ' ›' : ''}</div>
                  ))}
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
    </div>
  );
}

const planBar = (p) => { const h = hue(p.group || p.product || 'x'); return { a: s2d(p.start), b: s2d(p.end), bg: `oklch(0.9 0.07 ${h})`, bd: `oklch(0.68 0.11 ${h})`, fg: `oklch(0.32 0.1 ${h})`, text: `${p.hw ? '🔧HW · ' : ''}${p.group ? p.group + ' · ' : ''}${p.product || ''}`, tip: `${p.hw ? '【需 HW team 協助】\n' : ''}${p.machine}｜${p.group || ''} ${p.product || ''}\n${p.start} → ${p.end}${p.remark ? '\n' + p.remark : ''}` }; };
const planRowOf = (p, tag) => ({ id: 'p' + p.id, label: `${p.group ? p.group + ' · ' : ''}${p.product || '（未命名）'}`, sub: `${p.start.slice(5)} → ${p.end.slice(5)}${p.remark ? '｜' + p.remark : ''}`, tag, hw: !!p.hw, tagBg: 'oklch(0.9 0.09 150)', tagFg: 'oklch(0.36 0.1 150)', bars: [planBar(p)], a: p.start });

function PlanTimeline({ plans, machineNames }) {
  const groups = machineNames.map((m) => ({ key: m, label: m, rows: plans.filter((p) => p.machine === m && validPlan(p)).map((p) => planRowOf(p)).sort((x, y) => (x.a < y.a ? -1 : 1)) })).filter((g) => g.rows.length);
  return <DailyGrid groups={groups} headLabel="機台 / 測試產品" rangeKey="plan" />;
}

// 生產排程／工程＋生產（依機台）；mode 由「時程圖」頁決定
function ComboPage({ S, D, mode, cust, onOpen }) {
  const [mf, setMf] = useState('');
  const [hwOnly, setHwOnly] = useState(false);
  const showE = mode !== 'plan', showP = mode !== 'eng';
  const eng = D.rows;
  const plans = S.plans.filter(validPlan);
  const NONE = '（未指定機台）';
  const mset = [...new Set([...S.machines, ...D.rows.map((r) => r.machine).filter(Boolean), ...S.plans.map((p) => p.machine).filter(Boolean)])].sort(byName);
  const keys = [...mset, ''];
  const clashM = cust ? new Map() : engPlanClash(D.rows, S.plans);   // 客戶看不到撞機台提醒
  const engRow = (r0) => { const r = { ...r0, tentative: !r0.dueD }; return { id: 'e' + r.id, label: (clashM.has(r.id) ? '⚠ ' : '') + (r.item || '（未命名）'), sub: `${r.owner === UN ? '未指派' : r.owner}｜${r.status}${cust ? '' : '｜' + r.priority}${r.tentative ? '｜日期未定' : ''}${clashM.has(r.id) ? '｜與生產排程重疊' : ''}`, tag: '工程', tagBg: 'oklch(0.9 0.12 90)', tagFg: 'oklch(0.38 0.09 80)', a: r.startD ? dstr(r.startD) : '9999', bars: r.tentative ? [] : [{ a: r.startD, b: r.dueD, ...barTone(r), text: `${r.soon ? '⏰ ' : ''}${r.owner === UN ? '' : r.owner + ' · '}${r.item || ''}`, tip: `${r.item}｜${r.owner}｜${r.status}｜截止 ${r.due}${r.over ? '（逾期）' : r.soon ? '（3 天內到期）' : ''}` }] }; };
  const groups = keys.filter((m) => !mf || m === mf).map((m) => {
    const rows = [
      ...(showE ? eng.filter((r) => (r.machine || '') === m).map(engRow) : []),
      ...(showP ? plans.filter((p) => (p.machine || '') === m && (!hwOnly || p.hw)).map((p) => planRowOf(p, '生產')) : []),
    ].sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : 0));
    return { key: m || 'none', label: m || NONE, rows };
  }).filter((g) => g.rows.length);
  const noDateE = D.rows.filter((r) => !r.dueD).length, noDateP = S.plans.length - plans.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select className="field" aria-label="機台" value={mf} onChange={(e) => setMf(e.target.value)}>
          <option value="">全部機台</option>
          {mset.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {!cust && <button className="btn" aria-pressed={hwOnly} onClick={() => setHwOnly((v) => !v)} style={hwOnly ? { background: 'oklch(0.62 0.15 50)', borderColor: 'oklch(0.62 0.15 50)', color: '#fff' } : null}>只看需 HW 協助的生產排程</button>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12, color: V.muted, alignItems: 'center' }}>
          {showE && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 2, background: 'oklch(0.82 0.14 90)' }} />工程（顏色＝狀態，橘＝3 天內到期，紅＝逾期）</span>}
          {showP && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 2, background: 'oklch(0.7 0.13 150)' }} />生產（顏色＝產品 Group）</span>}
        </div>
      </div>
      {((showE && noDateE > 0) || (showP && noDateP > 0)) && <div style={{ fontSize: 12, color: V.muted2 }}>{showE && noDateE > 0 ? `${noDateE} 筆工程項目日期未定，只列在清單、不畫橫條　` : ''}{showP && noDateP > 0 ? `${noDateP} 筆生產排程日期未填或有誤，未顯示` : ''}</div>}
      <DailyGrid groups={groups} headLabel="機台 / 項目" rangeKey="combo" onOpen={onOpen} />
    </div>
  );
}

export { GANTT_LW, MIN_DW, useBoxW, fitDW, DIM, useFocus, FOCUS_BAR, focusHint, DailyGrid, planBar, planRowOf, PlanTimeline, ComboPage, TL_MODES, TimelinePage };

/* ============================================================
   P7：時程圖（原本「工程清單 → 工程排程」「複合排程」「生產排程 → 時程圖」合併成一頁）
   ============================================================ */
const TL_MODES = [['eng', '工程排程'], ['plan', '生產排程'], ['both', '工程＋生產']];
// cust：客戶帳號（不顯示優先度、撞機台、HW），也沒有「工程＋生產」合併檢視
function TimelinePage({ S, D, mode, setMode, picked, setPicked, Gantt, cust, onOpenRow, onOpenPlan }) {
  const openAny = (rid) => (rid[0] === 'e' ? onOpenRow : onOpenPlan)(rid.slice(1));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="時程圖內容">
          {TL_MODES.filter(([k]) => !cust || k !== 'both').map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{mode === 'eng' ? '工程清單的工作，依截止日與預計天數畫出' : mode === 'plan' ? '機台生產排程' : '同一台機台的工程工作與生產排程放在一起，方便看有沒有撞期'}</span>
      </div>
      {mode === 'eng'
        ? (D.rows.length ? <Gantt D={D} picked={picked} setPicked={setPicked} cust={cust} onOpen={onOpenRow} /> : <div style={{ background: V.surface, border: `1px dashed ${V.line3}`, borderRadius: 10, padding: 48, textAlign: 'center', fontSize: 14, color: V.muted2 }}>工程清單中還沒有資料。</div>)
        : <ComboPage S={S} D={D} mode={mode} cust={cust} onOpen={openAny} />}
    </div>
  );
}
