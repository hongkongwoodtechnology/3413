# Referral Feature Copy Migration Design

## 背景

目前 `GAMBLE` 與 `GAMBLE-referral-direct-bet-visibility` 在 referral 功能上已經分叉。

主專案保留了部分較新的安全與授權處理，但 feature 副本才是目前你確認要採納的產品行為基準，差異主要集中在：

- referral 佣金狀態採 `pending / approved / settled` 三段式
- 存在 `reconcile_commissions` 流程，用於將可對帳佣金從 `pending` 推進到 `approved`
- 首頁下注成功後的前端狀態更新順序，以副本版本為準
- referral 直接下注資料與佣金可見性，以副本版本為準
- 體驗金首注限制，以副本版本為準

本設計定義如何把 `GAMBLE-referral-direct-bet-visibility` 的 referral 行為搬回 `GAMBLE`，並保留你已確認的邊界：

- 以副本更新為準
- 不覆蓋實際業務資料
- 只做必要資料結構調整與相容處理

## 目標

- 讓 `GAMBLE` 的 referral 流程與 `GAMBLE-referral-direct-bet-visibility` 對齊
- 將 referral 佣金狀態升級為 `pending / approved / settled`
- 搬回 `reconcile_commissions` 分支與相關資料欄位
- 搬回首頁下注成功時序、體驗金首注限制、direct bet 可見性等副本行為
- 確保舊 referral 資料在不覆蓋真實業務資料的前提下可正常讀寫

## 非目標

- 本次不合併 `GAMBLE-risk-supervisor` 的任何變更
- 本次不重做整個 admin / leaderboard / cron 支付架構
- 本次不手動覆蓋 `data/referral_db.json` 或任何 backup 檔案
- 本次不清理既有歷史資料，只做執行期相容與必要欄位補齊

## 最終決策

本次採用「副本優先、主專案補強」策略。

具體規則如下：

1. referral 業務行為以 `GAMBLE-referral-direct-bet-visibility` 為準。
2. 主專案現有程式只保留那些不會改變產品語意、但能提供更安全或更穩定行為的部分。
3. 若主專案與副本在 referral 行為上衝突，以副本的產品定義優先。
4. 若主專案擁有與資料安全、權限驗證、舊資料相容直接相關的補強，則在不改變副本語意的前提下保留。

這代表本次不是「補幾個欄位」，而是把主專案 referral 子系統重對齊到 feature 副本。

## 為什麼採副本優先

這次的核心目標不是只修一個顯示問題，而是把已經在副本中被驗證的 referral 流程搬回主專案。

如果保留主專案作為基準，只局部吸收副本改動，會出現幾個問題：

- 三段式佣金狀態會被壓回兩段式
- `reconcile_commissions` 的存在意義消失
- 前端頁面顯示與後端狀態語意無法對齊
- 直接下注可見性與佣金生命週期會繼續分裂

因此，這次需要承認 feature 副本是 referral 功能的較新業務定義，而不是單純的實驗分支。

## 影響範圍

核心後端：

- `src/app/api/referral/route.ts`

核心前端：

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/[locale]/referral/page.tsx`
- `src/components/ReferralHandler.tsx`

核心邏輯與測試：

- `src/lib/referral-binding.ts`
- `src/components/ReferralHandler.test.tsx`
- `src/lib/referral-binding.test.ts`
- referral API 與 referral page 的對應測試

資料檔：

- `data/referral_db.json`

但注意：

- 只讀取並相容既有資料
- 不從副本複製任何真實 `data/*.json` 到主專案

## 資料模型設計

### Commission 狀態

主專案目前的 referral 佣金狀態需要升級成副本版本：

- `pending`
- `approved`
- `settled`

其語意定義如下：

- `pending`：佣金已建立，但尚未完成對帳或尚未具備支付條件
- `approved`：佣金已通過對帳，可進入支付或後續結算流程
- `settled`：佣金已完成最終結算

### Commission 欄位

主專案需要支援副本已有的佣金欄位：

- `id`
- `referee`
- `betAmount`
- `fee`
- `commission`
- `timestamp`
- `status`
- `signature`
- `approvedAt`
- `settledAt`
- `settlementTx`

對舊資料的處理原則：

- 若不存在 `approvedAt`、`settledAt`、`settlementTx`，視為 `undefined`
- 不因欄位缺失而拒絕整筆資料
- 不做批次覆寫，只在讀取與新寫入路徑上做相容

### Referee 與 UserData 相容

主專案需保持與副本對齊的 `UserData` 結構能力，包括：

- `stats`
- `commissions`
- `referees`
- `balances`
- `commissionRate`

對既有資料的相容規則：

- 缺 `balances` 時補 `{ usdt: 0, bonus: 0 }`
- 缺 `commissionRate` 時保留既有預設邏輯
- 舊 referee 缺 `rewardIssued` 時視為 `false`
- 缺少 `stats.friends` 時依 `referees.length` 回補顯示與寫入值

## 後端行為設計

### `GET /api/referral`

此路徑應以副本邏輯為基礎，回傳副本所需的 referral 顯示資料。

保留與補強規則：

- 允許主專案已有的穩定讀檔與 JSON 解析容錯
- 保留必要的 no-store 響應行為
- 保留對舊資料缺欄位的相容補值

行為調整規則：

- 不再把主專案現有的兩段式狀態視為唯一真相
- 讀取時允許三態資料
- top summary、history、referral 頁資料供應都以三態模型為基礎

### `POST /api/referral` `place_bet`

此分支需以副本版本為準。

核心行為：

- 寫入佣金時使用副本的狀態語義
- 直接下注產生的 referral 佣金與 volume 可被後續頁面看見
- referral 綁定修復與 canonical referrer 判斷維持現有 helper 能力

與主專案整合時的保留項：

- 若主專案已有較好的 referral admin 驗證或授權邏輯，且不影響副本語意，保留
- 若主專案已有較好的資料夾建立與存檔穩定性，保留

### `POST /api/referral` `reconcile_commissions`

此分支是副本明確存在而主專案沒有的能力，本次必須搬回。

設計要求：

- 掃描指定用戶的 `pending` 佣金
- 把符合條件的紀錄推進為 `approved`
- 寫入 `approvedAt`
- 流程需冪等，重複執行不應重複升級同一筆紀錄

本次不擴大範圍到完整 cron 重做，但主專案必須支援這個 reconcile API，因為它是副本三段式流程的一部分。

### 其他 action

以下 action 沿用副本版本作為 referral 功能基準：

- `airdrop_bonus`
- `update_commission_rate`
- `withdraw_commission`
- `get_leaderboard`

但若主專案已有更好的管理員驗證方法，允許在不改變輸出語意的前提下保留。

## 前端行為設計

### 首頁下注成功時序

首頁下注後的前端更新流程，以副本版本為準。

設計規則：

1. 下注交易成功後，先把 bet 送到 `/api/bets`
2. 只有 `/api/bets` 成功，才更新本地 `myBets`
3. 只有 `/api/bets` 成功，才進一步刷新或推進成功 UI 狀態
4. referral 的 `place_bet` 通知在 `/api/bets` 成功後再執行

這樣可以避免：

- 鏈上成功但 bet 沒寫進後端，前端卻已經顯示成功
- 本地 `myBets` 與真實持久化資料不一致

### 多語首頁

若 `src/app/[locale]/page.tsx` 存在與首頁不同步的下注流程，本次需要一起對齊。

規則是：

- 相同下注生命週期
- 相同 referral 呼叫順序
- 相同體驗金首注限制

不得出現 `/page.tsx` 與 `/[locale]/page.tsx` 行為不一致。

### 體驗金首注限制

以副本版本為準：

- 當使用 `trial funds`
- 且當前賽事 `realTotalPool === 0`
- 則禁止首筆體驗金下注

這個限制應反映在：

- 按鈕 disabled 狀態
- 下注前的 guard
- 必要時的提示文案

### Referral 頁直接下注可見性

`src/app/[locale]/referral/page.tsx` 需以副本邏輯為準，讓 direct bet 與佣金狀態可被清楚看見。

設計要求：

- 顯示直接推薦帶來的下注量與佣金
- 支援三態佣金的呈現
- 不因舊資料缺欄位而整頁報錯
- 若部分欄位缺失，只局部降級，不讓整頁崩潰

## 資料遷移與相容策略

本次不做實體資料覆蓋，但需要執行期相容。

### 原則

- 不從 feature 副本複製 `data/referral_db.json`
- 不覆蓋主專案目前真實 referral 資料
- 只在 API 讀寫時補足缺欄位與預設值

### 相容策略

- 舊兩態資料中的 `pending` 照常接受
- 舊兩態資料中的 `settled` 照常接受
- 新寫入資料可產生 `approved`
- 未來頁面與統計必須能處理三態混合資料

### 禁止事項

- 禁止一次性用副本資料直接覆蓋主專案資料庫
- 禁止在本次搬移中偷偷清洗或重排所有歷史資料
- 禁止把 feature 副本的 backup 檔寫回主專案

## 錯誤處理

- referral 資料載入失敗時，維持既有錯誤 UI，但避免因單欄位缺失造成整體失敗
- 若 commission 記錄缺少新欄位，使用預設值或 `undefined`
- 若舊資料缺少 `balances` 或 `rewardIssued`，在執行期補值
- 若 referral 頁單筆資料格式不完整，只略過不可計算欄位，不使整頁崩潰

## 測試策略

### API 測試

- `GET /api/referral` 可讀取舊兩態資料與新三態資料
- `place_bet` 會產生副本預期的佣金生命週期資料
- `reconcile_commissions` 可把符合條件的 `pending` 升級為 `approved`
- 舊資料缺 `balances`、`commissionRate`、`rewardIssued` 時仍可正常處理

### 前端測試

- 首頁下注時只有 `/api/bets` 成功後才顯示最終成功狀態
- `/api/bets` 失敗時，不應留下假成功的 `myBets` 狀態
- 體驗金首注在 `realTotalPool === 0` 時按鈕 disabled
- referral 頁可正確顯示 direct bet 與三態佣金

### 回歸測試

- `ReferralHandler` 既有 canonical referrer 綁定不退化
- referral 綁定唯一性 helper 測試持續通過
- 舊資料不需要人工修改即可被頁面與 API 使用

## 風險

- 主專案目前 `src/app/page.tsx` 已很大，局部搬移容易漏掉一條舊路徑
- 若只搬前端、不完整搬 API，會造成三態顯示與兩態資料源衝突
- 若不處理舊資料相容，referral 頁容易因缺欄位而報錯
- 若主專案保留過多舊邏輯，最後會變成「看似合併，實際雙標準並存」

本次實作時要優先避免的，是把 feature 副本「搬成半套」。

## 建議實作順序

1. 先把 `src/app/api/referral/route.ts` 對齊到副本行為，並補上主專案必要的相容與授權保留
2. 補齊三態資料模型與舊資料相容 helper
3. 搬回 `reconcile_commissions`
4. 調整 `src/app/page.tsx` 與 `src/app/[locale]/page.tsx` 的下注成功時序
5. 調整 referral 頁的 direct bet 與佣金可見性
6. 補 API 與前端測試

## 預期結果

完成後：

- `GAMBLE` referral 流程與 `GAMBLE-referral-direct-bet-visibility` 對齊
- 主專案能支援三態佣金生命週期
- direct bet 與 referral 佣金在頁面上可被正確看見
- 首頁下注成功狀態不再早於後端持久化
- 舊資料不需人工覆寫，系統可自行相容
- 主專案不會因本次合併而被副本資料檔覆蓋
