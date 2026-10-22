import React, { useState, useMemo } from 'react';
import { MONO, PRIO, SOON, STATUS, V } from '../lib/theme';
import { byName, diff, pad, s2d, todayStr } from '../lib/util';
import { FON, FSEL, darkBtn, fld, lineBtn } from '../ui/common';
import { sortLogs } from './logs';

/* ============================================================
   C3：匯出 CSV（Excel 可直接開，含 BOM）
   ============================================================ */
const csvCell = (v) => { const x = v == null ? '' : String(v); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
const ENG_HEAD = ['順序', '工作項目', '負責人', '客戶 Owner', '機台', '狀態', '截止日', '預計天數', '優先度', '備註', '最新進度', '進度紀錄數', '附件', '更新時間', '更新者'];
const PLAN_HEAD = ['機台名稱', '測試產品 Group', '測試產品名稱', 'HW', '開始日', '結束日', '天數', '備註', '更新時間', '更新者'];
function exportCSV(S, kind, shown) {
  const day = todayStr().replace(/-/g, '');
  const rank = new Map(S.rows.map((r, i) => [r.id, i + 1]));
  const logsOf = (id) => sortLogs(S.logs.filter((l) => l.rowId === id));
  if (kind === 'eng' || kind === 'engAll') {
    const src = kind === 'eng' ? shown : S.rows;
    const body = src.map((r) => { const ls = logsOf(r.id), f = S.filesByRow.get(r.id) || []; return [rank.get(r.id), r.item, r.owner, r.custOwner, r.machine, r.status, r.due, r.days, r.priority, r.remark, ls[0] ? `${ls[0].date} ${ls[0].author ? ls[0].author + '：' : ''}${ls[0].text}` : '', ls.length, f.map((x) => x.name + (x.kind === 'link' ? ` <${x.url}>` : '')).join('；'), r.updated, r.updatedBy]; });
    return S.saveFile(`工程清單_${day}.csv`, toCSV([ENG_HEAD, ...body]));
  }
  if (kind === 'plan') {
    const body = [...S.plans].sort((a, b) => byName(a.machine || '', b.machine || '') || (a.start || '').localeCompare(b.start || '')).map((p) => [p.machine, p.group, p.product, p.hw ? 'Y' : '', p.start, p.end, p.start && p.end ? diff(s2d(p.end), s2d(p.start)) + 1 : '', p.remark, p.updated, p.updatedBy]);
    return S.saveFile(`生產排程_${day}.csv`, toCSV([PLAN_HEAD, ...body]));
  }
  const item = new Map(S.rows.map((r) => [r.id, r]));
  const body = sortLogs(S.logs).map((l) => { const r = item.get(l.rowId) || {}; return [r.item || '（已刪除）', r.machine || '', r.owner || '', l.date, l.author, l.text, l.created]; });
  return S.saveFile(`進度紀錄_${day}.csv`, toCSV([['工作項目', '機台', '負責人', '日期', '紀錄人', '內容', '建立時間'], ...body]));
}

/* ============================================================
   C4：從 Excel 貼上匯入
   ============================================================ */
// 解析 Excel 複製出來的 TSV（含引號包住、內含換行的儲存格）
function parseTSV(text) {
  const out = []; let row = [], cell = '', q = false;
  const t = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim() !== ''));
}
// 2026-10-21 / 2026/10/21 / 10/21（今年）/ Excel 日期序號 → YYYY-MM-DD
function parseDay(v) {
  const x = String(v || '').trim(); if (!x) return '';
  let m = x.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = x.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${new Date().getFullYear()}-${pad(m[1])}-${pad(m[2])}`;
  if (/^\d{5}(\.\d+)?$/.test(x)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(x)) * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  return null; // 看不懂
}
const IMPORT = {
  eng: {
    label: '工程清單',
    fields: [
      ['item', '工作項目', ['item', '工作項目', '項目']], ['owner', '負責人', ['owner', '負責人']], ['custOwner', '客戶 Owner', ['customer', '客戶owner', '客戶窗口', '客戶']],
      ['machine', '機台', ['machine', '機台', '機台名稱']], ['status', '狀態', ['status', '狀態']], ['due', '截止日', ['due', 'duedate', '截止日', '截止']],
      ['days', '預計天數', ['days', '預計天數', '天數', '時間軸']], ['priority', '優先度', ['priority', '優先度', '優先']], ['remark', '備註', ['remark', '備註']],
    ],
    order: ['item', 'owner', 'custOwner', 'machine', 'status', 'due', 'days', 'priority', 'remark'],
  },
  plan: {
    label: '生產排程',
    fields: [
      ['machine', '機台名稱', ['machine', '機台', '機台名稱']], ['group', 'Group', ['group', '測試產品group', '產品group']], ['product', '產品名稱', ['product', '測試產品名稱', '產品名稱', '產品']],
      ['hw', 'HW', ['hw', 'hwteam', 'hw開關']], ['start', '開始日', ['start', '開始日', '開始']], ['end', '結束日', ['end', '結束日', '結束']], ['remark', '備註', ['remark', '備註']],
    ],
    order: ['machine', 'group', 'product', 'hw', 'start', 'end', 'remark'],
  },
};
const normH = (x) => String(x || '').toLowerCase().replace(/[\s_（）()]/g, '');
function mapImport(kind, grid) {
  const cfg = IMPORT[kind];
  if (!grid.length) return { cols: [], items: [], header: false };
  const first = grid[0].map(normH);
  const cols = first.map((h) => { const f = cfg.fields.find(([, , syn]) => syn.some((s) => normH(s) === h)); return f ? f[0] : null; });
  const header = cols.filter(Boolean).length >= 2;
  const use = header ? cols : grid[0].map((_, i) => cfg.order[i] || null);
  const items = (header ? grid.slice(1) : grid).map((cells) => {
    const o = {}, warn = [];
    use.forEach((k, i) => { if (k) o[k] = (cells[i] || '').trim(); });
    if (kind === 'eng') {
      const SYN = { '等客戶': '等客戶回覆', '等待客戶': '等客戶回覆', 'pending customer': '等客戶回覆', 'hold': '暫停', 'on hold': '暫停', '擱置': '暫停', 'wip': '進行中', 'done': '已完成', 'open': '未開始' };
      if (o.status && SYN[o.status.toLowerCase()]) o.status = SYN[o.status.toLowerCase()];
      if (o.status && !STATUS.includes(o.status)) { warn.push(`狀態「${o.status}」改為未開始`); o.status = '未開始'; }
      if (o.priority && !PRIO.includes(o.priority)) { warn.push(`優先度「${o.priority}」改為普通`); o.priority = '普通'; }
      const dd = parseDay(o.due); if (dd === null) { warn.push(`截止日「${o.due}」看不懂，留空`); o.due = ''; } else o.due = dd;
      if (o.days !== undefined) { const n = Number(o.days); o.days = o.days === '' ? 1 : Number.isFinite(n) ? n : 1; }
      if (!o.item) warn.push('沒有工作項目');
    } else {
      o.hw = /^(y|yes|v|✓|✔|true|1|是|需要|on|o)$/i.test(o.hw || '');
      for (const k of ['start', 'end']) { const dd = parseDay(o[k]); if (dd === null) { warn.push(`${k === 'start' ? '開始日' : '結束日'}「${o[k]}」看不懂，留空`); o[k] = ''; } else o[k] = dd; }
      if (o.start && o.end && o.end < o.start) warn.push('結束日早於開始日');
    }
    return { o, warn };
  });
  return { cols: use, items, header };
}

function ImportModal({ S, onClose }) {
  const kinds = Object.keys(IMPORT).filter((k) => (k === 'eng' ? S.canEdit : S.canPlan));
  const [kind, setKind] = useState(kinds[0] || 'eng');
  const [text, setText] = useState('');
  const [addNew, setAddNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const cfg = IMPORT[kind];
  const res = useMemo(() => mapImport(kind, parseTSV(text)), [kind, text]);
  const newOwners = kind === 'eng' ? [...new Set(res.items.map((x) => x.o.owner).filter((n) => n && !S.owners.includes(n)))] : [];
  const newMachines = [...new Set(res.items.map((x) => x.o.machine).filter((n) => n && !S.machines.includes(n)))];
  const go = async () => {
    setBusy(true);
    if (addNew && S.canAdmin) { for (const n of newOwners) await S.addOwner(n); for (const n of newMachines) await S.addMachine(n); }
    let ord = Math.max(0, ...S.rows.map((r) => Number(r.order) || 0));
    for (const { o } of res.items) {
      if (kind === 'eng') { ord += 1024; await S.add({ ...o, order: ord }); }
      else await S.addPlan('', { machine: '', group: '', product: '', hw: false, start: '', end: '', remark: '', ...o });
    }
    S.say(`已匯入 ${res.items.length} 筆${cfg.label}`);
    setBusy(false); onClose();
  };
  const shownCols = cfg.fields.filter(([k]) => res.cols.includes(k));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,19,17,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 920, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>從 Excel 貼上匯入</span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
              {Object.entries(IMPORT).filter(([k]) => kinds.includes(k)).map(([k, c]) => <button key={k} onClick={() => setKind(k)} style={{ ...FSEL, ...(kind === k ? FON : null) }}>匯入到{c.label}</button>)}
            </div>
            <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: V.muted }}>×</button>
          </div>
          <div style={{ fontSize: 12, color: V.muted, lineHeight: 1.6 }}>
            在 Excel 選取多列（建議連標題列一起）複製後貼到下面。有標題列會依欄名對應（{cfg.fields.map((f) => f[1]).join('、')}，中英文欄名都可）；
            沒有標題列則依這個順序對應。日期可用 2026/10/21、2026-10-21 或 10/21。
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus rows={5} placeholder="在這裡貼上（Ctrl+V）" style={{ ...fld, height: 'auto', padding: '8px 10px', fontFamily: MONO, fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', borderTop: `1px solid ${V.line}`, borderBottom: `1px solid ${V.line}`, minHeight: 80 }}>
          {res.items.length === 0 ? <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: V.muted2 }}>貼上後會在這裡預覽</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['#', ...shownCols.map((f) => f[1]), '提醒'].map((h) => <th key={h} style={{ position: 'sticky', top: 0, background: V.head, textAlign: 'left', padding: '6px 8px', fontWeight: 500, color: V.ink2, borderBottom: `1px solid ${V.line2}`, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {res.items.slice(0, 200).map(({ o, warn }, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${V.line}` }}>
                    <td style={{ padding: '5px 8px', fontFamily: MONO, color: V.faint }}>{i + 1}</td>
                    {shownCols.map(([k]) => <td key={k} style={{ padding: '5px 8px', whiteSpace: 'pre-wrap', maxWidth: 260, verticalAlign: 'top' }}>{k === 'hw' ? (o.hw ? 'Y' : '') : String(o[k] ?? '')}</td>)}
                    <td style={{ padding: '5px 8px', color: 'oklch(0.55 0.13 50)', fontSize: 11 }}>{warn.join('；')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: V.muted }}>{res.items.length ? `${res.header ? '已辨識標題列，' : '沒有標題列，依欄位順序對應，'}共 ${res.items.length} 筆` : ''}</span>
          {(newOwners.length > 0 || newMachines.length > 0) && !S.canAdmin && (
            <span style={{ fontSize: 12, color: SOON.fg }}>清單裡沒有的{newOwners.length ? '成員' : ''}{newOwners.length && newMachines.length ? '、' : ''}{newMachines.length ? '機台' : ''}會照樣匯入文字，但要請管理員加入清單才會出現在下拉選單。</span>
          )}
          {(newOwners.length > 0 || newMachines.length > 0) && S.canAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: V.ink2 }}>
              <input type="checkbox" checked={addNew} onChange={(e) => setAddNew(e.target.checked)} />
              一併加入清單：{[...newOwners.map((n) => '成員 ' + n), ...newMachines.map((n) => '機台 ' + n)].join('、')}
            </label>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={lineBtn}>取消</button>
            <button onClick={go} disabled={!res.items.length || busy} style={{ ...darkBtn, opacity: res.items.length && !busy ? 1 : 0.5 }}>{busy ? '匯入中…' : `匯入 ${res.items.length} 筆`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { csvCell, toCSV, ENG_HEAD, PLAN_HEAD, exportCSV, parseTSV, parseDay, IMPORT, normH, mapImport, ImportModal };
