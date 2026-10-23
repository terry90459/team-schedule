# 團隊工程清單與排程

團隊共用的工程清單＋機台生產排程網頁。React 18 前端（esbuild 打包）→ GitHub Pages；資料在 Supabase（PostgreSQL＋登入＋RLS 權限）。
使用者是 Hank（最高管理員，也是唯一的開發者）。詳細架設與功能說明見 `README.md`。

## 一定要遵守
- **一律用繁體中文（台灣用語）**：介面文字、註解、commit 訊息、回覆都是。
- **這是 public repo**：不可放任何客戶資料、料號、datalog、匯出的 CSV／備份 JSON、帳密、secret key，也不要寫入公司名稱或公司網域、真實客戶名稱（範例一律用 `@company.com`、`客戶 1` 之類）。
- **不碰公司 IT**：不接 AD、不架公司伺服器、不建議申請 IT 權限。
- **大改動先列清單給 Hank 確認再動手**；不確定要改哪一版就先問。
- **push 前先讓 Hank 看過**：用預覽版（見下方）給他確認，他說可以才 push 到 main（push 就會自動部署上線）。
- commit 作者：`Hank <terry90459@users.noreply.github.com>`，訊息結尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。

## 常用指令（Windows PowerShell）
```powershell
npm install
node build.mjs                                          # 本機試用版（資料存在瀏覽器）→ dist/
$env:DEMO=1; node build.mjs; Remove-Item Env:DEMO       # 預覽版（假資料、模擬 Supabase、左下角可切換身分）→ dist-demo/
node dev-test/smoke.cjs                                 # 快速測試（要先建預覽版；第一次見 dev-test/README.md）
```
正式版由 GitHub Actions 帶入 `SUPABASE_URL`／`SUPABASE_KEY` 建置，本機不需要。

## 程式結構（src/）——V2 版面（2026-10，分支 V2-test）
外框是「左側欄＋主內容＋右側詳情」：側欄切換頁面與範圍（全部客戶／某個分頁），任何頁面點一筆工作或排程，都在右側詳情面板修改。

| 資料夾 | 內容 |
|---|---|
| `lib/` | `config`（Supabase 連線）、`theme`（顏色、狀態常數）、`util`（日期、**台灣國定假日 TW_OFF/TW_WORK**、排序等小工具） |
| `data/` | `backend`（Supabase／本機兩種後端，欄位對照 SB_COLS）、`store`（`useStore` 資料層，畫面只透過它存取資料）、`derive`（衍生資料、甘特圖區間） |
| `ui/` | `common`（CellText、Avatar…）、`menu`（Dropdown／MenuItem、InfoToggle）、`icons`（側欄圖示）、`tabs`（分頁名稱、範圍、分頁管理 TabAdmin） |
| `app/` | `App`（外框：側欄、範圍、頁面切換、右側詳情、版本提醒、線上人數）、`SettingsMenu`（設定面板） |
| `home/` | `MyWork`：我的工作（工程師的首頁） |
| `worklist/` | `ListPage`（工程清單）、`ItemRow`（一列＋狀態膠囊）、`ItemDetail`（工作詳情與進度紀錄）、`files`、`logs`（LogEntry）、`io`（匯出 CSV／Excel 匯入）、`members`、`parts`（撞機台、成員移除…） |
| `plan/` | `PlanList`（生產排程清單＋排程詳情）、`timeline`（時程圖頁 TimelinePage、DailyGrid） |
| `dashboard/` | 總覽統計 `Overview`、工程甘特圖 `Gantt`、看板 `Board` |
| `daily/` | 每日（在總覽的子分頁） |
| `account/` | 登入／註冊、管理頁 ManagePage（帳號／成員／機台／客戶分頁）、帳號列表（可見分頁、允許註冊名單、備份還原） |
| `demo/` | 預覽版用的模擬 Supabase（`fakeSupabase.js`，要跟 schema 的權限規則保持一致）與假資料（`seed.js`） |

依賴方向：`lib` → `data` → `ui` → 各頁面 → `app`。不要讓底層 import 上層。

## 介面原則
- **清單只看、詳情才改**：清單上只有狀態可以直接切換，其他欄位在右側詳情修改；不要再把輸入框放回清單。
- 首頁依角色：工程師 → 我的工作；Planner → 生產排程；管理員／只能看 → 總覽；客戶 → 工程清單。
- 給每天用的人：常用的放外面，偶爾用的收進「篩選與分組」「⋯」，只有管理員用的放「管理」。
- 顏色只用來表示狀態與到期／逾期；樣式用 `build.mjs` 的共用 class（`.item` `.list` `.detail` `.d-in` `.btn` `.seg` `.chip` `.tag`…），不要寫一大串 inline style。
- 1366px 寬開著詳情也不能左右捲；1180px 以下詳情浮在上面；760px 以下側欄收進 ☰（smoke.cjs 有檢查）。

## 資料庫（supabase/schema.sql）
- 可以重複執行、不刪資料。**改了 schema 要做三件事**：
  1. 檔案最後 `schema_version()` 的數字加 1，並同步改 `src/data/backend.js` 的 `SCHEMA_VERSION`
  2. 同步更新 `src/demo/fakeSupabase.js`（預覽版的權限模擬）
  3. 推到 main 後，GitHub Actions「更新 Supabase 資料庫」（`.github/workflows/db-update.yml`）會自動在 Supabase 執行整份 schema.sql（單一交易，出錯全部復原）；到 Actions 確認成功。需要 Secret `SUPABASE_DB_URL`（Session pooler 連線字串）。失敗時才請 Hank 手動貼到 SQL Editor
- 權限一律在資料庫（RLS／檢視表／觸發器）把關，畫面隱藏只是輔助。
- 角色：`viewer`／`engineer`／`planner`／`admin`／`customer`；`profiles.tabs` 是可見分頁（內部帳號 null＝全部；客戶＝綁定的分頁）。客戶帳號只能讀 `cust_items`／`cust_plans` 檢視表。
- 更新時間、更新者由資料庫填（伺服器台灣時間），前端送的值會被覆蓋。

## 驗證流程
1. `node dev-test/smoke.cjs` 全部 PASS；新功能要在 `smoke.cjs` 加對應檢查
2. 有改 schema：在 Linux／WSL 跑 `dev-test/linux-db/` 的資料庫測試（見該資料夾 README）
3. 建預覽版給 Hank 看（可以把 `dist-demo/` 用任何靜態伺服器開起來；預覽版的 `index.html` 只有內容片段，`smoke.cjs` 裡有補外框的寫法）
4. Hank 確認後才 commit＋push，push 後到 GitHub → Actions 確認「部署到 GitHub Pages」成功（有改 schema 的話，「更新 Supabase 資料庫」也要成功）

## 每年要做
- 人事行政總處約每年 6 月公布隔年「政府行政機關辦公日曆表」→ 把隔年的放假日加進 `src/lib/util.js` 的 `TW_OFF`（補班的週六放 `TW_WORK`）。目前有 2026、2027。

## 待辦（摘自 Hank 的清單）
- B1 多人同時改同一格的衝突提示　B2 變更歷史　B3 忘記密碼　B4 e2e 測試放進 repo、部署前自動跑
- C1 甘特圖拖曳改日期　C2 工程項目可設開始日　C3 依進度紀錄產生週報　C4 email 通知（需 SMTP）　C5「每日」手機版
