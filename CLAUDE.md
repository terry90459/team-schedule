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

## 程式結構（src/）
| 資料夾 | 內容 |
|---|---|
| `lib/` | `config`（Supabase 連線）、`theme`（顏色、狀態常數）、`util`（日期、**台灣國定假日 TW_OFF/TW_WORK**、排序等小工具） |
| `data/` | `backend`（Supabase／本機兩種後端，欄位對照 SB_COLS）、`store`（`useStore` 資料層，畫面只透過它存取資料）、`derive`（儀表板衍生資料、甘特圖區間） |
| `ui/` | `common`（共用按鈕、輸入框、欄寬）、`menu`（下拉選單 Dropdown／MenuItem、ⓘ 說明 InfoToggle）、`tabs`（客戶分頁列、分頁管理 TabAdmin、客戶可見欄位 CUST_ENG_COLS/CUST_PLAN_COLS） |
| `worklist/` | 工程清單頁、每一列（WorkCard，欄位見 `parts.jsx` 的 HEADS／COL_DEFAULT）、工作詳情抽屜（`logs.jsx`）、附件（`files.jsx`）、匯出 CSV／Excel 匯入、成員面板 |
| `dashboard/` | 總覽、工程排程甘特圖（時程圖頁使用）、卡片看板 |
| `plan/` | 生產排程頁、每一列、時程圖頁 TimelinePage（工程／生產／合併三種）與 DailyGrid |
| `daily/` | 每日頁 |
| `account/` | 登入／註冊、⚙ 管理頁 ManagePage（帳號／成員／機台／客戶分頁）、帳號列表（可見分頁、允許註冊名單、備份還原） |
| `app/` | App 外框（分頁、客戶模式）、右上角設定、線上人數、資料庫版本提醒 |
| `demo/` | 預覽版用的模擬 Supabase（`fakeSupabase.js`，要跟 schema 的權限規則保持一致）與假資料（`seed.js`） |

依賴方向：`lib` → `data` → `ui` → 各頁面 → `app`。不要讓底層 import 上層。

## 介面原則（2026-10 版面簡化後）
- 給每天用的人：常用的放外面（搜尋、狀態、只看我的、新增），偶爾用的收進「篩選 ▾」「⋯ 更多」，只有管理員用的放「⚙ 管理」。
- 工程清單預設只顯示 8 欄，其他欄位在「工作詳情」側欄；新增欄位時先想「是不是每天都要看」，不是就放側欄。
- 新寫的介面用 `build.mjs` 裡的共用 class（`.btn` `.chip` `.seg` `.field` `.pop` `.mi` `.toolbar`…），不要再寫一大串 inline style；舊元件改到時順手換掉。
- 1366px 寬（一般筆電）不能出現左右捲動；手機寬度至少要能切換頁面、不被裁切（smoke.cjs 有檢查）。

## 資料庫（supabase/schema.sql）
- 可以重複執行、不刪資料。**改了 schema 要做三件事**：
  1. 檔案最後 `schema_version()` 的數字加 1，並同步改 `src/data/backend.js` 的 `SCHEMA_VERSION`
  2. 同步更新 `src/demo/fakeSupabase.js`（預覽版的權限模擬）
  3. 告訴 Hank 要把整份 `schema.sql` 貼到 Supabase → SQL Editor 執行（資料庫沒更新前，管理員頁面會出現提醒）
- 權限一律在資料庫（RLS／檢視表／觸發器）把關，畫面隱藏只是輔助。
- 角色：`viewer`／`engineer`／`planner`／`admin`／`customer`；`profiles.tabs` 是可見分頁（內部帳號 null＝全部；客戶＝綁定的分頁）。客戶帳號只能讀 `cust_items`／`cust_plans` 檢視表。
- 更新時間、更新者由資料庫填（伺服器台灣時間），前端送的值會被覆蓋。

## 驗證流程
1. `node dev-test/smoke.cjs` 全部 PASS；新功能要在 `smoke.cjs` 加對應檢查
2. 有改 schema：在 Linux／WSL 跑 `dev-test/linux-db/` 的資料庫測試（見該資料夾 README）
3. 建預覽版給 Hank 看（可以把 `dist-demo/` 用任何靜態伺服器開起來；預覽版的 `index.html` 只有內容片段，`smoke.cjs` 裡有補外框的寫法）
4. Hank 確認後才 commit＋push，push 後到 GitHub → Actions 確認「部署到 GitHub Pages」成功

## 每年要做
- 人事行政總處約每年 6 月公布隔年「政府行政機關辦公日曆表」→ 把隔年的放假日加進 `src/lib/util.js` 的 `TW_OFF`（補班的週六放 `TW_WORK`）。目前有 2026、2027。

## 待辦（摘自 Hank 的清單）
- B1 多人同時改同一格的衝突提示　B2 變更歷史　B3 忘記密碼　B4 e2e 測試放進 repo、部署前自動跑
- C1 甘特圖拖曳改日期　C2 工程項目可設開始日　C3 依進度紀錄產生週報　C4 email 通知（需 SMTP）　C5「每日」手機版
