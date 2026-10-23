import React, { useState, useEffect, useMemo, useRef } from 'react';
import { byName, lsGet, lsSet, sortRows, stamp, strip, uid, uniqNames } from '../lib/util';
import { RES, localBackend, supabaseBackend } from './backend';

/* ============================================================
   資料層：畫面只呼叫這裡，不直接碰後端
   ============================================================ */

function useStore(sb, profile) {
  const [d, setD] = useState(() => Object.fromEntries(RES.map((r) => [r, []])));
  const [mode, setMode] = useState('connecting'); // connecting | sb | local
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState(null); // { text, action?: { label, run } }
  const [localMe, setMeState] = useState(() => lsGet('me'));
  const me = profile ? profile.name : localMe;
  // 角色：engineer 改工程清單／紀錄／附件；planner 改生產排程；admin 全部（含成員、機台、設定）；viewer 只能看
  const role = profile ? (profile.status && profile.status !== 'active' ? 'none' : profile.role === 'editor' ? 'engineer' : profile.role) : 'admin';
  const isCust = role === 'customer';   // 客戶帳號：全站唯讀，只有自己的分頁
  const canEngR = role === 'engineer' || role === 'admin', canPlanR = role === 'planner' || role === 'admin';
  const readOnly = !canEngR && !canPlanR;
  const S = useRef({ be: null, assets: null, queues: {}, d: null }).current;
  S.d = d; S.me = me;

  const say = (text, action) => { setNotice({ text, action }); clearTimeout(S.nt); S.nt = setTimeout(() => setNotice(null), action ? 10000 : 9000); };

  useEffect(() => {
    let dead = false;
    const unsubs = [];
    (async () => {
      const be = sb ? supabaseBackend(sb, setLive, isCust) : localBackend();
      S.be = be;
      const onErr = (e) => { if (!S.errShown) { S.errShown = true; say('讀取資料失敗：' + ((e && (e.message || e.code)) || '未知原因') + '。請重新整理頁面。'); } };
      RES.forEach((r) => unsubs.push(be.subscribe(r, (list) => setD((x) => ({ ...x, [r]: list })), onErr)));
      setMode(be.kind);
    })();
    return () => { dead = true; unsubs.forEach((u) => u && u()); };
  }, [sb]);

  // 同一筆資料的寫入排隊，一次一個
  const run = (key, fn) => {
    const prev = S.queues[key] || Promise.resolve();
    const next = prev.catch(() => {}).then(fn).catch((e) => {
      if (e && e.code === '42501') say('儲存失敗：你的帳號沒有編輯權限。');
      else if (e && e.code === 'not_found') say('儲存失敗：這筆資料可能已被其他人刪除。');
      else say('儲存失敗' + (e && e.message ? '：' + e.message : '，請檢查網路後再試一次。'));
    });
    S.queues[key] = next;
    return next;
  };
  const be = () => S.be;
  const C = (res, id, body) => run(res + '/' + id, () => be().create(res, id, body));
  const U = (res, id, p) => run(res + '/' + id, () => be().update(res, id, p));
  const X = (res, id) => run(res + '/' + id, () => be().remove(res, id));
  const who = () => ({ updated: stamp(), updatedBy: S.me || '' });

  const rows = useMemo(() => sortRows(d.rows), [d.rows]);
  const memberList = useMemo(() => [...d.members].map((m) => ({ ...m, team: m.team || 'engineer' })).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || byName(a.name, b.name)), [d.members]);
  const owners = useMemo(() => uniqNames(memberList.filter((m) => m.team !== 'planner')), [memberList]);   // 工程清單 Owner 下拉
  const planners = useMemo(() => uniqNames(memberList.filter((m) => m.team === 'planner')), [memberList]);
  const machines = useMemo(() => uniqNames(d.machines).sort(byName), [d.machines]);
  const settings = d.settings.find((x) => x.id === 'app') || {};
  const customers = useMemo(() => [...d.customers].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || byName(a.name, b.name)), [d.customers]);
  // 附件：依工程項目分組
  const filesByRow = useMemo(() => {
    const m = new Map();
    [...d.files].sort((a, b) => (a.created || '').localeCompare(b.created || '')).forEach((f) => { if (!m.has(f.rowId)) m.set(f.rowId, []); m.get(f.rowId).push(f); });
    return m;
  }, [d.files]);

  // 刪除前先留快照，提供「復原」
  const restore = async (snap) => { for (const [res, list] of snap) for (const x of list) await C(res, x.id, strip(x)); };
  const offerUndo = (text, snap) => say(text, { label: '復原', run: () => { setNotice(null); restore(snap); } });

  const api = {
    rows, owners, planners, machines, settings, plans: d.plans, logs: d.logs, members: memberList, filesByRow, customers,
    mode, live, readOnly, notice, me, profile,
    role, isCust,
    canEdit: canEngR && mode !== 'connecting',   // 工程清單、進度紀錄、附件
    canPlan: canPlanR && mode !== 'connecting',  // 機台生產排程
    canAdmin: role === 'admin' && mode !== 'connecting', // 成員／機台清單、共用設定
    canUpload: mode === 'local', // 線上版不存檔案本體，附件一律貼網路磁碟路徑或連結
    setMe(n) { setMeState(n); lsSet('me', n); },
    clearNotice: () => setNotice(null),
    patch(id, p) { return U('rows', id, { ...p, ...who() }); },
    add(extra) {
      const id = uid();
      return C('rows', id, { item: '', owner: '', custOwner: '', machine: '', status: '未開始', due: '', priority: '普通', remark: '', days: 1, order: Date.now(), ...extra, ...who() }).then(() => id);
    },
    async del(id) {
      const row = d.rows.find((r) => r.id === id); if (!row) return;
      const logs = d.logs.filter((x) => x.rowId === id), files = d.files.filter((x) => x.rowId === id);
      // 自建 server 時改由資料庫 ON DELETE CASCADE 處理，下面兩行可拿掉
      for (const l of logs) await X('logs', l.id);
      for (const f of files) await X('files', f.id);
      await X('rows', id);
      offerUndo(`已刪除「${(row.item || '未命名').split('\n')[0].slice(0, 30)}」${logs.length ? `（含 ${logs.length} 則紀錄）` : ''}`, [['rows', [row]], ['logs', logs], ['files', files]]);
    },
    // 成員、機台：一人／一台一筆
    addOwner(name, team = 'engineer') { const n = name.trim(); if (!n || memberList.some((m) => m.name.toLowerCase() === n.toLowerCase())) return; return C('members', 'm' + uid().slice(1), { name: n, sort: d.members.length, team }); },
    setMemberTeam(id, team) { return U('members', id, { team }); },
    // 改名：Owner、紀錄人、更新者一併改；有連帳號的，帳號名稱也一起改
    async renameMember(id, name) {
      const m = memberList.find((x) => x.id === id), n = (name || '').trim();
      if (!m || !n || n === m.name) return true;
      if (memberList.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) { say(`「${n}」已經有人使用`); return false; }
      try {
        if (S.be.rpc) { await S.be.rpc('rename_member', { member_id: id, new_name: n }); await S.be.refresh(); }
        else {
          for (const r of d.rows) { const p = {}; if (r.owner === m.name) p.owner = n; if (r.updatedBy === m.name) p.updatedBy = n; if (Object.keys(p).length) await U('rows', r.id, p); }
          for (const l of d.logs) if (l.author === m.name) await U('logs', l.id, { author: n });
          await U('members', id, { name: n });
          if (S.me === m.name) { setMeState(n); lsSet('me', n); }
        }
        say(`已改名為「${n}」，相關的 Owner、紀錄人、更新者都已更新`);
        return true;
      } catch (e) { say('改名失敗：' + ((e && e.message) || '未知原因')); return false; }
    },
    async linkMember(profileId, memberId) {
      try { await S.be.rpc('link_member', { p_profile: profileId, member_id: memberId }); await S.be.refresh(); return true; }
      catch (e) { say('連結失敗：' + ((e && e.message) || '未知原因')); return false; }
    },
    refresh: () => S.be && S.be.refresh && S.be.refresh(),
    async delOwnerOnly(name) { for (const m of d.members.filter((x) => x.name === name && !x.profileId)) await X('members', m.id); },
    addMachine(name) { const n = name.trim(); if (!n || machines.includes(n)) return; return C('machines', 'k' + uid().slice(1), { name: n }); },
    async delMachine(name) { for (const m of d.machines.filter((x) => x.name === name)) await X('machines', m.id); },
    setSetting(p) { return d.settings.some((x) => x.id === 'app') ? U('settings', 'app', p) : C('settings', 'app', p); },
    // 生產排程
    patchPlan(id, p) { return U('plans', id, { ...p, ...who() }); },
    addPlan(machine, copy, extra) {
      const id = 'p' + uid().slice(1);
      const base = copy ? strip(copy) : { machine: machine || '', group: '', product: '', hw: false, start: '', end: '', remark: '' };
      return C('plans', id, { ...base, ...extra, ...who() }).then(() => id);
    },
    // 分頁（客戶別）：管理員新增／改名／排序／刪除（裡面要是空的）
    async addTab(name) {
      const n = (name || '').trim(); if (!n) return;
      if (customers.some((c) => c.name.toLowerCase() === n.toLowerCase())) { say(`「${n}」已經有了`); return; }
      const id = 'c' + uid().slice(1);
      const body = { name: n, sort: customers.reduce((m, c) => Math.max(m, c.sort ?? 0), 0) + 1, internal: false };
      try { await be().create('customers', id, body); } catch (e) { say('新增分頁失敗：' + ((e && e.message) || '未知原因')); return null; }
      return id;
    },
    renameTab(id, name) {
      const n = (name || '').trim(); if (!n) return;
      if (customers.some((c) => c.id !== id && c.name.toLowerCase() === n.toLowerCase())) { say(`「${n}」已經有了`); return; }
      return U('customers', id, { name: n });
    },
    async shiftTab(id, dir) {
      const i = customers.findIndex((c) => c.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= customers.length) return;
      const l = [...customers]; [l[i], l[j]] = [l[j], l[i]];
      for (let k = 0; k < l.length; k++) if (l[k].sort !== k) await U('customers', l[k].id, { sort: k });
    },
    async delTab(id) {
      const c = customers.find((x) => x.id === id); if (!c) return;
      const n = d.rows.filter((r) => r.customer === id).length + d.plans.filter((p) => p.customer === id).length;
      if (n) { say(`「${c.name}」還有 ${n} 筆資料，請先移到其他分頁或刪除`); return; }
      await X('customers', id);
    },
    // 移到其他分頁
    moveRowTab(id, tab) { return U('rows', id, { customer: tab, ...who() }); },
    movePlanTab(id, tab) { return U('plans', id, { customer: tab, ...who() }); },
    async delPlan(id) {
      const p = d.plans.find((x) => x.id === id); if (!p) return;
      await X('plans', id);
      offerUndo(`已刪除排程「${p.machine || ''} ${p.product || p.group || ''}」`, [['plans', [p]]]);
    },
    // 進度紀錄
    addLog({ rowId, date, author, text }) {
      const id = 'l' + uid().slice(1), t = stamp();
      return C('logs', id, { rowId, date, author: author || '', text, created: t, updated: t }).then(() => api.patch(rowId, {}));
    },
    patchLog(id, p) { return U('logs', id, { ...p, updated: stamp() }); },
    async delLog(id) {
      const l = d.logs.find((x) => x.id === id); if (!l) return;
      await X('logs', id);
      offerUndo('已刪除一則進度紀錄', [['logs', [l]]]);
    },
    // 附件／連結
    addFile(rowId, f) { const id = 'f' + uid().slice(1); return C('files', id, { rowId, ...f, created: stamp() }).then(() => api.patch(rowId, {})); },
    delFile(rowId, f) { return X('files', f.id).then(() => api.patch(rowId, {})); },
    setOrder(id, ord) { return U('rows', id, { order: ord }); },
    async move(id, beforeId) {
      const me = rows.find((r) => r.id === id);
      if (!me) return;
      const oi = rows.findIndex((r) => r.id === id);
      const list = rows.filter((r) => r.id !== id);
      let idx = beforeId ? list.findIndex((r) => r.id === beforeId) : list.length;
      if (idx < 0) idx = list.length;
      if (idx === oi) return;
      const prev = list[idx - 1], next = list[idx];
      const po = prev ? Number(prev.order) : null, no = next ? Number(next.order) : null;
      let ord;
      if (po == null && no == null) ord = 1;
      else if (po == null) ord = no - 1;
      else if (no == null) ord = po + 1;
      else ord = (po + no) / 2;
      const ok = Number.isFinite(ord) && (po == null || ord > po) && (no == null || ord < no);
      if (ok) return api.setOrder(id, ord);
      const seq = [...list.slice(0, idx), me, ...list.slice(idx)];
      for (let i = 0; i < seq.length; i++) {
        const o = (i + 1) * 1024;
        if (seq[i].order !== o) await api.setOrder(seq[i].id, o);
      }
    },
    async removeOwner(name, plan) {
      for (const r of rows.filter((x) => x.owner === name)) {
        const c = plan[r.id];
        if (c === '__del__') {
          for (const l of d.logs.filter((x) => x.rowId === r.id)) await X('logs', l.id);
          for (const f of d.files.filter((x) => x.rowId === r.id)) await X('files', f.id);
          await X('rows', r.id);
        } else await api.patch(r.id, { owner: c || '' });
      }
      await api.delOwnerOnly(name);
    },
    async upload(file) {
      return new Promise((ok, no) => {
        if (file.size > 1.5e6) return no(new Error('too big'));
        const fr = new FileReader();
        fr.onload = () => ok({ name: file.name, url: fr.result });
        fr.onerror = no;
        fr.readAsDataURL(file);
      });
    },
    // 匯出檔案（C3）
    async saveFile(filename, text, type) {
      const blob = new Blob(['﻿' + text], { type: type || 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
    say,
  };
  return api;
}

export { useStore };
