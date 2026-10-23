import React from 'react';
import { V } from '../lib/theme';
import { copyText } from '../lib/util';
import { addChip } from '../ui/common';
import { LinkAdd, uploadMsg } from './parts';

/* 附件（連結／網路磁碟路徑）：工程清單的附件欄、工作詳情側欄共用 */
function FileList({ r, S, ro, wide }) {
  const files = S.filesByRow.get(r.id) || [];
  const maxW = wide ? 320 : 110;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', minWidth: 0 }}>
      {files.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%', background: V.tint, border: `1px solid ${V.line2}`, borderRadius: 4, padding: '2px 4px 2px 6px', fontSize: 11.5 }}>
          {f.kind === 'link' && /^\\\\/.test(f.url)
            ? <a href="#" onClick={(e) => { e.preventDefault(); copyText(f.url).then((ok) => S.say(ok ? '已複製網路磁碟路徑，請貼到檔案總管開啟。' : f.url)); }} title={f.url + '\n（點一下複製路徑）'} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: maxW }}>📁 {f.name}</a>
            : <a href={f.url || '/_blob/' + f.assetId} {...(f.kind === 'link' ? {} : { download: f.name })} target="_blank" rel="noreferrer" title={f.kind === 'link' ? f.url : f.name} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: maxW }}>{f.kind === 'link' ? '🔗 ' : ''}{f.name}</a>}
          {!ro && <button onClick={() => S.delFile(r.id, f)} title="移除附件" aria-label="移除附件" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: V.faint, fontSize: 12, padding: '0 2px', lineHeight: 1 }}>×</button>}
        </div>
      ))}
      {S.canUpload && !ro && (
        <label className="file-add" title="夾帶檔案" style={addChip}>
          ＋ 檔案
          <input type="file" multiple style={{ display: 'none' }} onChange={async (e) => {
            const picked = Array.from(e.target.files || []); e.target.value = '';
            for (const f of picked) { try { await S.addFile(r.id, await S.upload(f)); } catch (err) { S.say(uploadMsg(f.name, err)); } }
          }} />
        </label>
      )}
      {!ro && <LinkAdd onAdd={(f) => S.addFile(r.id, f)} />}
      {files.length === 0 && ro && <span style={{ fontSize: 12, color: V.faint }}>—</span>}
    </div>
  );
}

export { FileList };
