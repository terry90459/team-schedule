import React, { useState } from 'react';
import { MONO, V } from '../lib/theme';
import { Avatar, darkBtn, fld, lineBtn, mvBtn } from '../ui/common';

/* ---------- 團隊成員面板：分「工程師」「Planner」兩組；管理員可改名、換組、移除 ---------- */
const TEAM_LABEL = { engineer: '工程師', planner: 'Planner' };
function MemberRow({ m, S, roA, onRemove, other }) {
  const [edit, setEdit] = useState(false), [v, setV] = useState(m.name);
  const cnt = S.rows.filter((r) => r.owner === m.name).length;
  const save = async () => { if (await S.renameMember(m.id, v)) setEdit(false); };
  return (
    <div className="member-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, fontSize: 13 }}>
      <Avatar name={m.name} size={20} />
      {edit ? (
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEdit(false); setV(m.name); } }}
          style={{ ...fld, height: 26, flex: 1, fontSize: 12.5 }} />
      ) : (
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}{m.profileId && <span title="已連結登入帳號：名稱和組別跟著帳號" style={{ marginLeft: 5, fontSize: 10.5, color: 'oklch(0.5 0.1 155)' }}>● 帳號</span>}</span>
      )}
      {edit ? (
        <>
          <button onClick={save} style={{ ...darkBtn, height: 26, padding: '0 8px', fontSize: 12 }}>儲存</button>
          <button onClick={() => { setEdit(false); setV(m.name); }} style={{ ...lineBtn, height: 26, padding: '0 8px', fontSize: 12 }}>取消</button>
        </>
      ) : (
        <>
          {m.team !== 'planner' && <span style={{ fontFamily: MONO, fontSize: 11, color: V.faint }}>{cnt} 件</span>}
          {!roA && <button className="mv" onClick={() => { setV(m.name); setEdit(true); }} title="改名（Owner、紀錄人、更新者會一起改）" style={{ ...mvBtn, width: 22, fontSize: 12 }}>✎</button>}
          {!roA && !m.profileId && <button className="mv" onClick={() => S.setMemberTeam(m.id, other)} title={other === 'planner' ? '移到 Planner 成員（生產排程頁）' : '移到工程師成員（工程清單頁）'} style={{ ...mvBtn, width: 22, fontSize: 12 }}>⇅</button>}
          {!roA && <button disabled={!!m.profileId} onClick={() => onRemove(m.name)} title={m.profileId ? '已連結帳號的成員，請到「帳號管理」停用' : '移除'} style={{ border: 'none', background: 'transparent', cursor: m.profileId ? 'not-allowed' : 'pointer', color: V.faint, fontSize: 14, opacity: m.profileId ? 0.35 : 1 }}>×</button>}
        </>
      )}
    </div>
  );
}
// team：這個頁面只管哪一組（工程清單頁 → engineer，生產排程頁 → planner）
function MemberPanel({ S, roA, onRemove, onClose, team }) {
  const [name, setName] = useState('');
  const other = team === 'planner' ? 'engineer' : 'planner';
  const add = () => { const n = name.trim(); if (!n) return; const dup = S.members.find((m) => m.name.toLowerCase() === n.toLowerCase()); if (dup) { S.say(`「${n}」已經在${TEAM_LABEL[dup.team]}組裡`); return; } S.addOwner(n, team); setName(''); };
  const list = S.members.filter((m) => (m.team || 'engineer') === team);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
      <div style={{ position: 'absolute', top: 38, right: 0, width: 360, background: V.surface, border: `1px solid ${V.line2}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{team === 'planner' ? 'Planner 成員' : '工程師成員'}</div>
        <div style={{ fontSize: 11.5, color: V.muted2, lineHeight: 1.6 }}>
          {team === 'planner'
            ? '帳號在「帳號管理」核准為 Planner 後會自動加入這裡（標示 ● 帳號）。'
            : '帳號在「帳號管理」核准為工程師或管理員後會自動加入這裡（標示 ● 帳號），工程清單的 Owner 就是這份名單。'}
          {roA && <><br />只有管理員可以新增、改名或移除成員。</>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflow: 'auto' }}>
          {list.length === 0 && <div style={{ fontSize: 12, color: V.faint, padding: '4px 8px' }}>（還沒有成員）</div>}
          {list.map((m) => <MemberRow key={m.id} m={m} S={S} roA={roA} onRemove={onRemove} other={other} />)}
        </div>
        {!roA && (
          <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${V.line}`, paddingTop: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="手動新增（沒有帳號的人）"
              style={{ ...fld, flex: 1, fontSize: 12.5 }} />
            <button onClick={add} style={darkBtn}>新增</button>
          </div>
        )}
      </div>
    </>
  );
}

export { TEAM_LABEL, MemberRow, MemberPanel };
