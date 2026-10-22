# 團隊工程清單與排程

總覽、每日、複合排程、工程清單、生產排程、卡片看板的團隊共用網頁（含進度紀錄）。

- **網頁**：GitHub Pages（這個 repo 自動建置部署）
- **資料**：Supabase（PostgreSQL＋帳號登入＋權限）
- **大檔案**（datalog、驗機資料、mail）：**不進資料庫、不進 GitHub**，放在公司內部網路磁碟，資料庫只存路徑

> ⚠ 這是 public repo。**不要 commit 任何真實資料**（客戶名稱、料號、datalog、匯出的 CSV）。真實資料只存在 Supabase。

---

## 第一次架設（約 15 分鐘）

### 1. Supabase：建資料表
1. 到 [supabase.com](https://supabase.com) 用 GitHub 登入 → **New project**（Region 選 Tokyo 或 Singapore）
2. 左側 **SQL Editor** → **New query** → 把 [`supabase/schema.sql`](supabase/schema.sql) 整份貼上 → **Run**
   （可以重複執行，不會刪資料；之後 schema 有更新時再貼一次即可）

### 2. Supabase：關掉 email 確認
Supabase 內建的寄信服務**只會寄給專案團隊成員、每小時只能寄 2 封**，同事註冊時收不到確認信。
因為新帳號本來就要管理員核准，所以直接關掉 email 確認：

**Authentication → Sign In / Providers → Email → 關閉「Confirm email」→ Save**

### 3. 取得連線資訊
右上角 **Connect**（或 **Project Settings → API Keys**），記下：
- **Project URL**：`https://xxxxxxxx.supabase.co`
- **Publishable key**：`sb_publishable_...`（舊專案叫 `anon` key）

> Publishable key 本來就是設計給網頁用的公開金鑰，資料安全靠資料庫的權限（RLS）保護。
> **絕對不要**把 `secret` key 或 `service_role` key 放到這裡。

### 4. GitHub：設定變數並開啟 Pages
1. 這個 repo → **Settings → Secrets and variables → Actions → Variables** 分頁 → **New repository variable**，新增兩個：
   - `SUPABASE_URL` = 上面的 Project URL
   - `SUPABASE_KEY` = 上面的 Publishable key
2. **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**
3. **Actions** 分頁 → 「部署到 GitHub Pages」→ **Run workflow**（之後每次 push 到 main 都會自動部署）
4. 完成後網址是 `https://<你的帳號>.github.io/<repo 名稱>/`

### 5. 第一次登入
1. 打開網址 → **註冊新帳號**。**第一個註冊的人自動成為管理員**，所以請你自己先註冊。
2. （選用）把舊資料匯入：SQL Editor 貼上搬移用的 SQL 執行（這個檔案不放在 repo）。
3. 把網址給同事註冊 → 你在 **帳號管理** 分頁選權限核准。

---

## 權限

帳號有兩個獨立的設定：**狀態**（待核准／使用中／已停用）和**權限**（下表）。
新註冊的人是「待核准」，權限預設「只能看」；管理員需要的話先改權限，再按「核准」。按「停用」會暫停使用，按「恢復」回到原本的權限。
未核准的人登入會看到「帳號尚未核准」，被停用的人會看到「帳號已被停用」。

**停用**或**刪除**（不論從網頁或 Supabase 後台）的帳號會從成員清單移除，不再出現在 Owner 下拉；他負責的未完成工作會在工程清單標示「⚠ 已不在清單」，篩選列也會提示「N 筆工作的負責人已不在清單」，點一下只看這些、方便改派。恢復帳號後會自動回到成員清單。

**★ 最高管理員**（第一個註冊的人）是唯一能**刪除帳號**的人，也不能被其他管理員降級或停用。
要換人當最高管理員，請在 Supabase SQL Editor 執行：
```sql
update public.profiles set is_owner = false;
update public.profiles set is_owner = true where email = '新的最高管理員 email';
```

| 權限 | 可以做什麼 |
|---|---|
| 待核准／停用 | 只看得到「等待核准」畫面，看不到任何資料 |
| 只能看 | 瀏覽所有頁面、匯出 CSV |
| 工程師 | 新增、修改、刪除工程項目、進度紀錄、附件連結；生產排程只能看 |
| Planner | 新增、修改、刪除機台生產排程；工程清單、進度紀錄只能看 |
| 管理員 | 全部都能改＋帳號管理＋成員／機台清單＋共用設定（日曆天／工作天） |

### 團隊成員與帳號
- 帳號被核准為**工程師／Planner／管理員**後，自動加入「團隊成員」清單：工程師、管理員 → 工程師組；Planner → Planner 組。
  清單裡已有同名成員（不分大小寫）時會直接連上，不會重複。
- 註冊名稱跟清單裡的寫法不同時，管理員在「帳號管理 → 對應團隊成員」選要連的成員，舊資料就會歸到這個帳號。
- **只有管理員能改名**：在「團隊成員」面板按 ✎，或在「帳號管理」改顯示名稱。Owner、紀錄人、更新者會一起改。
- 工程清單的 Owner 下拉只列「工程師」組。沒有帳號的人可以由管理員手動新增到任一組。
- 已連結帳號的成員不能直接從清單移除，要停用請到「帳號管理」把權限改成「待核准／停用」。

權限由資料庫（RLS）把關，就算直接呼叫 API 也改不了沒權限的資料。
schema 更新後（例如這次新增工程師／Planner），請把 `supabase/schema.sql` 重新貼到 SQL Editor 執行一次，舊的「可編輯」會自動轉成「工程師」。

- 「更新者」由資料庫自動填入登入者的顯示名稱，無法冒用。
- 至少會保留一位管理員，無法把最後一位管理員降級。
- 忘記密碼：Supabase 內建寄信寄不到同事信箱，請最高管理員在「帳號管理」刪除該帳號（可保留成員名字），讓同事重新註冊後再核准。

## 檔案（datalog、驗機資料等）

附件欄只存**連結或網路磁碟路徑**（例如 `\\server\share\資料夾\檔名`），檔案本體放公司內部網路磁碟。
瀏覽器無法直接開啟網路磁碟路徑，點一下會複製路徑，再貼到檔案總管開啟（需要公司內網與該資料夾的權限）。

## 免費方案的限制

- 資料庫 500 MB（純文字資料，幾年內用不完）
- **一週沒有資料庫活動，專案會被暫停**。已加上自動保活：`.github/workflows/keepalive.yml` 每天台灣時間 08:17 呼叫一次 `keepalive()`（只寫一筆時間戳）。
  - 可在 GitHub → Actions →「Supabase 保活」→ Run workflow 手動測試；失敗時 GitHub 會寄信通知。
  - public repo 若 **60 天沒有任何 commit**，GitHub 會自動停用排程；保活排程每天也會檢查，距上次 commit 超過 50 天就自動提交一筆 `.github/keepalive.txt` 時間紀錄，避免被停用（平常有在更新程式就不會多出這筆 commit）。
  - 萬一還是被暫停：Supabase 後台選專案 → **Resume project**，資料與設定都會回來（暫停後一年內可恢復）。
- 建議定期用頁面上的「匯出 CSV」備份，存到公司網路磁碟

---

## 開發

```bash
npm install
node build.mjs                                   # 沒有設定 Supabase → 本機試用版（資料存在瀏覽器）
SUPABASE_URL=... SUPABASE_KEY=... node build.mjs # 連到 Supabase
npx serve dist                                   # 或任何靜態伺服器，開 http://localhost:3000
```

### 結構
```
src/main.jsx            前端（React，單一檔案）
build.mjs               esbuild 打包 → dist/index.html + dist/app.js
supabase/schema.sql     資料表、權限（RLS）、觸發器、即時同步
.github/workflows/      GitHub Pages 自動部署
```

### 資料層
畫面只透過 `useStore()` 存取資料；`useStore` 底下是可替換的後端：
`supabaseBackend()`（線上）與 `localBackend()`（本機試用），介面相同：

```
subscribe(res, cb, onErr) → unsubscribe     // cb(list) 收到該資源完整清單
create(res, id, body) / update(res, id, patch) / remove(res, id)
```

| 前端資源 | 資料表 | 說明 |
|---|---|---|
| rows | `eng_items` | 工程項目 |
| logs | `eng_logs` | 進度紀錄（`row_id` → `eng_items.id`，刪除項目時一併刪除） |
| files | `eng_files` | 連結／網路磁碟路徑（`row_id` → `eng_items.id`） |
| plans | `prod_plans` | 機台生產排程 |
| members / machines | `members` / `machines` | 團隊成員、機台清單 |
| settings | `settings` | 共用設定（一筆 `id = app`） |
| — | `profiles` | 帳號名稱與權限（對應 Supabase `auth.users`） |

右上角「👥 線上 N 人」使用 Supabase Realtime Presence，點開可看誰在線、目前在哪一頁（不存資料庫）。
即時同步使用 Supabase Realtime；若網路擋住 WebSocket，會自動改成每 20 秒重新讀取（右上角會顯示）。
