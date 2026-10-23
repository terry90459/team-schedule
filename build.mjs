// 建置：把 src/main.jsx（及 src/ 底下各模組）打包成 dist/app.js，並產生 dist/index.html
// 用法：SUPABASE_URL=... SUPABASE_KEY=... node build.mjs
//       DEMO=1 node build.mjs → dist-demo/：預覽版（模擬資料庫＋假資料，不連任何 Supabase）
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const demo = !!process.env.DEMO;
const OUT = demo ? 'dist-demo' : 'dist';
const url = demo ? '' : process.env.SUPABASE_URL || '';
const key = demo ? '' : process.env.SUPABASE_KEY || '';
if (!demo && (!url || !key)) console.warn('⚠ 沒有設定 SUPABASE_URL / SUPABASE_KEY，建出來的是「本機試用」版（資料只存在瀏覽器）');

mkdirSync(OUT, { recursive: true });
const r = await build({
  entryPoints: [demo ? 'src/demo/main.jsx' : 'src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  charset: 'utf8',
  jsx: 'transform',
  loader: { '.jsx': 'jsx' },
  define: {
    __SUPABASE_URL__: JSON.stringify(url),
    __SUPABASE_KEY__: JSON.stringify(key),
    'process.env.NODE_ENV': '"production"',
  },
  outfile: `${OUT}/app.js`,
  metafile: true,
});
const v = Date.now().toString(36);

const LIGHT = `--bg:#f4f3ef;--surface:#ffffff;--surface2:#fbfaf7;--tint:#faf9f6;
--line:#ebe8e2;--line2:#d9d5cc;--line3:#cfcbc2;
--ink:#1f1e1b;--ink2:#3a3833;--muted:#6b6862;--muted2:#7a766e;--faint:#9a968e;
--head:#efede8;--headHover:#e7e4dd;--btnBg:#1f1e1b;--btnFg:#f6f5f2;
--todayBg:oklch(0.965 0.02 250);--todayHead:oklch(0.93 0.03 250);--accent:oklch(0.5 0.12 250);--link:oklch(0.48 0.12 250);--linkHover:oklch(0.38 0.12 250);--rowHover:#fbfaf7;--delBg:oklch(0.95 0.03 25);--delFg:oklch(0.5 0.14 25);
--holHead:#141414;--holFg:#ffffff;--holBody:rgba(20,20,20,0.50);
--ok:oklch(0.4 0.1 155);--over:oklch(0.52 0.16 25);`;
const DARK = `--bg:#161513;--surface:#1f1e1b;--surface2:#1b1a17;--tint:#232220;
--line:#2c2a26;--line2:#3a3833;--line3:#4a4741;
--ink:#f1efe9;--ink2:#d9d6ce;--muted:#a8a49a;--muted2:#8f8b82;--faint:#75726a;
--head:#26241f;--headHover:#2e2c27;--btnBg:#f1efe9;--btnFg:#1b1a17;
--todayBg:oklch(0.28 0.03 250);--todayHead:oklch(0.33 0.05 250);--accent:oklch(0.78 0.11 250);--link:oklch(0.78 0.11 250);--linkHover:oklch(0.86 0.09 250);--rowHover:#232220;--delBg:oklch(0.3 0.05 25);--delFg:oklch(0.8 0.12 25);
--holHead:#000000;--holFg:#e8e6e0;--holBody:rgba(0,0,0,0.60);
--ok:oklch(0.78 0.12 155);--over:oklch(0.72 0.15 25);`;
const CSS = `
:root{${LIGHT}color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${DARK}color-scheme:dark}}
:root[data-theme="dark"]{${DARK}color-scheme:dark}
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
html{scroll-padding-top:env(safe-area-inset-top,0px);height:100%}
*{box-sizing:border-box}
body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
#root{height:100%}
a{color:var(--link);text-decoration:none}a:hover{color:var(--linkHover);text-decoration:underline}
input,select,textarea,button{font-family:inherit;color:inherit}
select option{background:var(--surface);color:var(--ink)}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:-2px}
button:disabled,select:disabled,input:disabled,textarea:disabled{cursor:default}
select:disabled,input:disabled,textarea:disabled{opacity:1;-webkit-text-fill-color:currentColor}
.row:hover{background:var(--rowHover)}
.wcard:hover{border-color:var(--line3)!important}
.mv:hover:not(:disabled){color:var(--ink)!important;background:var(--line)!important}
.colgrip{position:absolute;right:0;top:0;bottom:0;width:10px;cursor:col-resize;touch-action:none}
.colgrip::after{content:'';position:absolute;right:4px;top:8px;bottom:8px;width:2px;border-radius:1px;background:var(--line3)}
.colgrip:hover::after{background:var(--accent)}
.tbl-head .colgrip::after{opacity:0;transition:opacity .12s}.tbl-head:hover .colgrip::after{opacity:1}
.mv:disabled{opacity:.3;cursor:default!important}
.grip:hover{color:var(--ink)!important}
.cin:hover:not(:disabled){border-color:var(--line2)!important;background:var(--surface)!important}
.cin:focus{background:var(--surface)!important;border-color:var(--line3)!important}
.head-cell:hover{background:var(--headHover)}
.btn-dark:hover:not(:disabled){opacity:.85}
.member-btn:hover{border-color:var(--faint)!important}
.member-item:hover{background:var(--tint)}
.person-row:hover{background:var(--rowHover)}
.add-row:hover{background:var(--tint);color:var(--ink)!important}
.file-add:hover{border-color:var(--faint)!important;color:var(--ink2)!important}
.logcell:hover{border-color:var(--line3)!important;background:var(--surface)!important}
.del:hover:not(:disabled){background:var(--delBg)!important;color:var(--delFg)!important}
input[type=date]{color-scheme:inherit}
button:focus-visible,a:focus-visible,[tabindex]:focus-visible,input[type=checkbox]:focus-visible,input[type=radio]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.app-nav{scrollbar-width:none;-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}.app-nav::-webkit-scrollbar{display:none}
.show-md{display:none}
/* ---- 共用元件（新寫的介面一律用 class，不再寫 inline style） ---- */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--line2);background:var(--surface);color:var(--ink);border-radius:7px;cursor:pointer;font-size:13px;white-space:nowrap}
.btn:hover:not(:disabled){border-color:var(--faint)}
.btn:disabled{opacity:.5}
.btn-sm{height:28px;padding:0 10px;font-size:12px}
.btn-primary{border-color:var(--btnBg);background:var(--btnBg);color:var(--btnFg);font-weight:500}
.btn-primary:hover:not(:disabled){opacity:.85;border-color:var(--btnBg)}
.btn-ghost{border-color:transparent;background:transparent;color:var(--muted2)}
.btn-ghost:hover:not(:disabled){background:var(--line);color:var(--ink);border-color:transparent}
.btn.on{border-color:var(--btnBg);background:var(--btnBg);color:var(--btnFg)}
.badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;font-size:11px;font-family:'IBM Plex Mono',ui-monospace,monospace;background:var(--accent);color:#fff}
.chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--line2);background:var(--surface);color:var(--muted);border-radius:14px;cursor:pointer;font-size:12px;white-space:nowrap}
.chip:hover{border-color:var(--faint);color:var(--ink)}
.chip.on{border-color:var(--btnBg);background:var(--btnBg);color:var(--btnFg)}
.chip .n{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;opacity:.7}
.chip-warn{border-color:oklch(0.85 0.06 25);background:oklch(0.97 0.02 25);color:var(--over)}
.chip-warn.on{background:var(--over);border-color:var(--over);color:#fff}
:root[data-theme="dark"] .chip-warn:not(.on){background:transparent;border-color:var(--delBg)}
.seg{display:inline-flex;border:1px solid var(--line2);border-radius:8px;padding:2px;background:var(--surface);gap:2px}
.seg button{height:28px;padding:0 12px;border:none;background:transparent;border-radius:6px;cursor:pointer;font-size:13px;color:var(--muted);white-space:nowrap}
.seg button:hover{color:var(--ink)}
.seg button.on{background:var(--btnBg);color:var(--btnFg);font-weight:500}
.field{height:32px;border:1px solid var(--line2);border-radius:7px;padding:0 10px;font-size:13px;background:var(--surface);min-width:0}
.search{padding-left:30px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:10px center}
.pop-veil{position:fixed;inset:0;z-index:29}
.pop{position:absolute;z-index:30;background:var(--surface);border:1px solid var(--line2);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.15);padding:6px;display:flex;flex-direction:column;min-width:200px}
.pop-fixed{position:fixed}
.pop-title{padding:6px 10px 4px;font-size:11px;font-weight:500;color:var(--muted2)}
.pop-sep{height:1px;background:var(--line);margin:4px 0}
.mi{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:none;background:transparent;padding:7px 10px;border-radius:6px;font-size:13px;cursor:pointer;color:var(--ink);white-space:nowrap}
.mi:hover:not(:disabled){background:var(--tint)}
.mi:disabled{opacity:.4}
.mi .k{margin-left:auto;font-size:11px;color:var(--faint)}
.mi.danger{color:var(--over)}
.mi.danger:hover{background:var(--delBg)}
label.mi input{margin:0}
.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 24px;background:var(--surface2);border-bottom:1px solid var(--line);flex:none}
.toolbar .grow{flex:1 1 0}
.muted{color:var(--muted2)}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
.info-toggle{align-self:flex-start;border:none;background:transparent;color:var(--muted2);cursor:pointer;font-size:12px;padding:2px 4px;border-radius:4px}
.info-toggle:hover{color:var(--ink);background:var(--line)}
.info-box{font-size:12.5px;line-height:1.7;color:var(--muted);background:var(--tint);border:1px solid var(--line);border-radius:8px;padding:10px 14px}
.subnav{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:18px}
.subnav button{height:36px;padding:0 14px;border:none;background:transparent;border-bottom:2px solid transparent;cursor:pointer;font-size:13.5px;color:var(--muted)}
.subnav button.on{color:var(--ink);border-bottom-color:var(--ink);font-weight:500}
.subnav button:hover{color:var(--ink)}
@media (max-width:640px){.toolbar{padding:8px 12px}}
/* ---- 視覺降噪：表格平常像文件，滑鼠移到那一列才出現控制項 ---- */
.toolbar.flat{background:transparent;border-bottom:none;padding:14px 24px 4px}
.tbl{background:var(--surface);border:1px solid var(--line2);border-radius:10px}
.tbl-head{display:grid;position:sticky;top:0;z-index:6;background:var(--surface);border-bottom:1px solid var(--line2);border-radius:10px 10px 0 0;box-shadow:0 -16px 0 var(--bg)}
.tbl-head>div{position:relative;padding:9px 10px;font-size:11.5px;font-weight:500;color:var(--muted2);display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden}
.tbl .wcard{border:none!important;border-radius:0!important;border-bottom:1px solid var(--line)!important;background:transparent!important}
.tbl [data-card]:last-of-type .wcard,.tbl>.wcard:last-of-type{border-bottom:none!important;border-radius:0 0 10px 10px!important}
.tbl .wcard:hover,.tbl .wcard:focus-within{background:var(--rowHover)!important}
.wcard select.cin,.wcard select.pill{-webkit-appearance:none;appearance:none;background-image:none}
.wcard input[type=date].cin::-webkit-calendar-picker-indicator{opacity:0;cursor:pointer}
.wcard input[type=date].cin{position:relative}
.wcard:hover select.cin:not(:disabled),.wcard select.cin:focus,.wcard:hover select.pill:not(:disabled){background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center}
.wcard:hover input[type=date].cin:not(:disabled)::-webkit-calendar-picker-indicator,.wcard input[type=date].cin:focus::-webkit-calendar-picker-indicator{opacity:.55}
.wcard .grip,.wcard .row-actions{opacity:0;transition:opacity .12s}
.wcard:hover .grip,.wcard:hover .row-actions,.wcard:focus-within .row-actions,.wcard .row-actions:has([aria-expanded=true]){opacity:1}
@media (hover:none){.wcard .grip,.wcard .row-actions{opacity:1}}
.pill{border:none;border-radius:12px;height:24px;padding:0 10px;font-size:12px;font-weight:500;cursor:pointer;max-width:100%}
.wcard:hover .pill:not(:disabled){padding-right:20px}
.prio{border:none;background:transparent;height:28px;padding:0 6px;font-size:12.5px;cursor:pointer;width:100%;color:var(--muted2)}
.prio.p0{color:var(--over);font-weight:600}
.prio.p1{color:oklch(0.55 0.13 50);font-weight:500}
.prio.p3{color:var(--faint)}
.scope{display:flex;align-items:flex-end;gap:2px;padding:0 24px;border-bottom:1px solid var(--line);flex:none;background:var(--surface2);overflow-x:auto;scrollbar-width:none}
.scope::-webkit-scrollbar{display:none}
.scope button{height:38px;padding:0 12px;border:none;background:transparent;border-bottom:2px solid transparent;cursor:pointer;font-size:13px;color:var(--muted);white-space:nowrap;display:flex;align-items:center;gap:6px}
.scope button:hover{color:var(--ink)}
.scope button.on{color:var(--ink);border-bottom-color:var(--accent);font-weight:600}
.scope .n{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;color:var(--faint);font-weight:400}
.scope .lab{font-size:11.5px;color:var(--faint);margin-right:6px;align-self:center}
.seg .n{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;opacity:.6;margin-left:5px}
.status-dot{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid var(--line2);border-radius:15px;background:var(--surface);font-size:12px;cursor:pointer;white-space:nowrap;color:var(--muted)}
.status-dot:hover{border-color:var(--faint)}
.status-dot i{width:7px;height:7px;border-radius:4px;background:currentColor;display:inline-block}
.icon-btn{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line2);border-radius:8px;background:var(--surface);cursor:pointer;font-size:15px;color:var(--muted)}
.icon-btn:hover{border-color:var(--faint);color:var(--ink)}
@media (max-width:1180px){.hide-lg{display:none!important}}
@media (max-width:980px){.hide-md{display:none!important}.show-md{display:inline!important}}
@media (max-width:640px){.hide-sm{display:none!important}.app-head{padding:0 12px!important;gap:10px!important}.app-title{display:none!important}}
`;

// 預覽版發布成 claude.ai 頁面：外框（doctype／head／body）由平台加上，這裡只寫內容
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">`;
const THEME_JS = `<script>try{var t=localStorage.getItem('theme')||'light';if(t!=='auto')document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}</script>`;
if (demo) writeFileSync(`${OUT}/index.html`, `<title>工程清單預覽版</title>
${THEME_JS}
${FONTS}
<style>${CSS}</style>
<div id="root"></div>
<script type="module" src="app.js"></script>
`);
else writeFileSync(`${OUT}/index.html`, `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${demo ? '工程清單預覽版' : '團隊工程清單與排程'}</title>
<script>try{var t=localStorage.getItem('theme')||'light';if(t!=='auto')document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="app.js${demo ? '' : '?v=' + v}"></script>
</body>
</html>
`);
writeFileSync(`${OUT}/.nojekyll`, '');
writeFileSync(`${OUT}/robots.txt`, 'User-agent: *\nDisallow: /\n');
const kb = (Object.values(r.metafile.outputs)[0].bytes / 1024).toFixed(0);
console.log(`✓ ${OUT}/index.html、${OUT}/app.js（${kb} KB）${demo ? '— 預覽版（假資料）' : url ? '— 已連到 Supabase' : '— 本機試用版'}`);
