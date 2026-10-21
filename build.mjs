// 建置：把 src/main.jsx 打包成 dist/app.js，並產生 dist/index.html
// 用法：SUPABASE_URL=... SUPABASE_KEY=... node build.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_KEY || '';
if (!url || !key) console.warn('⚠ 沒有設定 SUPABASE_URL / SUPABASE_KEY，建出來的是「本機試用」版（資料只存在瀏覽器）');

mkdirSync('dist', { recursive: true });
const r = await build({
  entryPoints: ['src/main.jsx'],
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
  outfile: 'dist/app.js',
  metafile: true,
});
const v = Date.now().toString(36);

const LIGHT = `--bg:#f4f3ef;--surface:#ffffff;--surface2:#fbfaf7;--tint:#faf9f6;
--line:#ebe8e2;--line2:#d9d5cc;--line3:#cfcbc2;
--ink:#1f1e1b;--ink2:#3a3833;--muted:#6b6862;--muted2:#7a766e;--faint:#9a968e;
--head:#efede8;--headHover:#e7e4dd;--btnBg:#1f1e1b;--btnFg:#f6f5f2;
--todayBg:oklch(0.965 0.02 250);--todayHead:oklch(0.93 0.03 250);--accent:oklch(0.5 0.12 250);--link:oklch(0.48 0.12 250);--linkHover:oklch(0.38 0.12 250);--rowHover:#fbfaf7;--delBg:oklch(0.95 0.03 25);--delFg:oklch(0.5 0.14 25);`;
const DARK = `--bg:#161513;--surface:#1f1e1b;--surface2:#1b1a17;--tint:#232220;
--line:#2c2a26;--line2:#3a3833;--line3:#4a4741;
--ink:#f1efe9;--ink2:#d9d6ce;--muted:#a8a49a;--muted2:#8f8b82;--faint:#75726a;
--head:#26241f;--headHover:#2e2c27;--btnBg:#f1efe9;--btnFg:#1b1a17;
--todayBg:oklch(0.28 0.03 250);--todayHead:oklch(0.33 0.05 250);--accent:oklch(0.78 0.11 250);--link:oklch(0.78 0.11 250);--linkHover:oklch(0.86 0.09 250);--rowHover:#232220;--delBg:oklch(0.3 0.05 25);--delFg:oklch(0.8 0.12 25);`;
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
`;

writeFileSync('dist/index.html', `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>團隊工程清單與排程</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="app.js?v=${v}"></script>
</body>
</html>
`);
writeFileSync('dist/.nojekyll', '');
writeFileSync('dist/robots.txt', 'User-agent: *\nDisallow: /\n');
const kb = (Object.values(r.metafile.outputs)[0].bytes / 1024).toFixed(0);
console.log(`✓ dist/index.html、dist/app.js（${kb} KB）${url ? '— 已連到 Supabase' : '— 本機試用版'}`);
