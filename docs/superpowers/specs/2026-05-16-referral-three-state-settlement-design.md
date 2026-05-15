# Referral Three-State Settlement Design

## 背景

目前推薦佣金只有 `pending` 與 `settled` 兩種狀態，但系統實際上同時存在三個不同階段：

1. 佣金已生成
2. 佣金已通過對帳、可進入打款流程
3. 佣金已成功打到介紹人地址

現況把這三個階段壓縮進兩個狀態，造成幾個問題：

- `pending` 同時代表「剛生成」、「尚未對帳」、「尚未打款」，語義混亂
- 若規則要求「只有真實打款後才算 settled」，就會出現 `pending -> settled` 缺少中間橋接條件的死循環
- 前端統計、可提現金額與實際支付流程難以對齊

本設計將推薦佣金改為三態流程，明確拆分「生成佣金」「可支付」「已支付」。

## 目標

- 將推薦佣金狀態明確拆為 `pending`、`approved`、`settled`
- 建立可執行的狀態遷移路徑，消除 `pending` 永遠無法轉正的死循環
- 保持 `settled` 的嚴格語義：只有真實打款成功後才算 `settled`
- 讓前端統計、可提現口徑與 cron 打款流程一致
- 兼容現有舊資料，允許既有 `pending` 逐步被升級處理

## 非目標

- 本次不新增 `failed` 狀態
- 本次不重做整個打款架構
- 本次不修改 `WITHDRAWAL` 的既有資料形態
- 本次不重寫整個 referral UI，只做與三態流程直接相關的顯示調整

## 狀態定義

### `pending`

代表佣金已生成，但尚未完成對帳或尚未具備支付條件。

典型來源：

- 下注完成後剛建立的佣金紀錄
- 歷史資料中尚未完成重驗證的舊紀錄

### `approved`

代表佣金已完成對帳，且符合支付條件，等待 cron 實際打款。

典型來源：

- `pending` 經過對帳流程驗證成功
- 舊資料經修復流程判定可支付

### `settled`

代表 cron 已成功將佣金打到介紹人地址。

這是最終完成態，且應對應實際鏈上支付結果或成功回執。

## 狀態遷移規則

唯一合法流程如下：

`pending -> approved -> settled`

### `pending -> approved`

當以下條件成立時執行：

- 佣金紀錄關聯的下注資料存在
- 對帳流程驗證該筆佣金金額與業務規則一致
- 該筆佣金尚未被標記為已支付

執行位置：

- 可由專用 repair/reconcile 流程處理
- 也可在 GET 修復或排程修復中補做，但必須保證冪等

### `approved -> settled`

當以下條件成立時執行：

- cron 對這筆 `approved` 佣金發起實際打款
- 鏈上交易成功
- 已取得成功回執或可識別的成功信號

執行位置：

- `src/app/api/cron/settle/route.ts`

### 不允許的遷移

- `pending -> settled`
- `settled -> pending`
- `settled -> approved`

除非是人工資料修復腳本，正式業務路徑不應直接跨越中間態。

## 統計口徑

### 累計佣金

應包含所有有效佣金收入：

- `pending`
- `approved`
- `settled`

但不包含：

- `WITHDRAWAL`

### 本月佣金

統計近 30 天內的有效佣金收入，口徑與累計佣金一致：

- `pending`
- `approved`
- `settled`

### 可提現佣金

只統計 `approved`。

原因：

- `pending` 尚未完成對帳，不應允許提現
- `settled` 已經打到介紹人地址，不能再重複提現

因此：

- `approved` = 待支付、可提現
- `settled` = 已打款完成

### 已提現記錄

仍沿用既有 `WITHDRAWAL` ledger，不把它混入佣金狀態列舉中。

## 後端資料設計

### Commission 狀態列舉

`Commission.status` 由：

- `'settled' | 'pending'`

調整為：

- `'pending' | 'approved' | 'settled'`

### 舊欄位兼容

保留既有欄位：

- `id`
- `referee`
- `betAmount`
- `fee`
- `commission`
- `timestamp`
- `signature`

必要時允許補充輕量欄位：

- `approvedAt`
- `settledAt`
- `settlementTx`

若實作期評估改動過大，可先不新增，僅用 `status` 切換與既有時間欄位支撐。

## API 行為調整

### `POST /api/referral` `place_bet`

新規則：

- 下注產生佣金時先寫入 `pending`
- 不再在下注當下直接把佣金寫成 `settled`

理由：

- `settled` 必須保留給「實際打款完成」
- 下注當下最多只能證明佣金成立，不代表已支付完成

### `GET /api/referral`

新規則：

- 統計口徑改為使用三態規則
- 不再把舊的無 `signature` `settled` 直接粗暴降回 `pending`
- 若需要修復，只能透過明確的 reconcile 邏輯執行，不能在 GET 中做不透明的狀態回退

### Reconcile / Repair 流程

新增或抽離專用流程，負責：

- 掃描 `pending`
- 對帳驗證可支付性
- 將符合條件的紀錄標記為 `approved`

此流程必須冪等，重跑不應重複放大金額或重複遷移。

## Cron 打款流程調整

### 現況問題

目前 cron 主要依賴 referee 聚合值 `earnedCommissionValue`，而不是逐筆佣金狀態。

這會導致：

- 單筆佣金缺乏可追蹤的支付生命週期
- 無法明確區分哪些紀錄已可支付、哪些只是待驗證

### 新規則

cron 只處理 `approved` 的佣金紀錄。

處理流程：

1. 找出所有 `approved`
2. 依介紹人地址彙總本次應付款
3. 執行實際打款
4. 打款成功後，將本批對應佣金改成 `settled`
5. 若打款失敗，維持 `approved`，等待重試

### 重試策略

本次不新增 `failed` 狀態。

支付失敗時：

- 保持 `approved`
- 記錄錯誤日誌
- 下次 cron 重試

## 前端顯示調整

### 近期佣金動態

需支援顯示三種狀態標籤：

- `pending`
- `approved`
- `settled`

文案建議：

- `pending`：待對帳
- `approved`：待打款
- `settled`：已結算

### 統計卡片

- `累計佣金`：顯示三態總和
- `本月佣金`：顯示近 30 天三態總和
- `可提現佣金`：只顯示 `approved`

### 篩選器

現有 `全部 / 已結算 / 待結算` 不足以表達三態。

建議調整為：

- `全部`
- `待對帳`
- `待打款`
- `已結算`

若為降低改動成本，也可短期保留：

- `待結算` = `pending + approved`
- `已結算` = `settled`

但正式文案應逐步與三態一致。

## 舊資料相容與修復

### 舊 `pending`

舊資料中的 `pending` 保留，不直接丟棄。

透過 reconcile 流程：

- 可驗證者轉 `approved`
- 已確認完成支付者轉 `settled`

### 舊 `settled`

若歷史上存在語義不準的舊 `settled`，需以一次性修復或明確規則重判，不能在每次 GET 時隱式改寫。

### `WITHDRAWAL`

保持原樣：

- 不納入三態佣金收入
- 不參與 `pending/approved/settled` 流轉

## 測試策略

### 單元測試

- 三態統計口徑
- `pending -> approved` 對帳決策
- `approved -> settled` 轉換邏輯

### API 測試

- 下注後建立 `pending`
- 對帳後升級為 `approved`
- GET 統計口徑正確

### Cron 測試

- 只支付 `approved`
- 打款成功後轉 `settled`
- 打款失敗時保留 `approved`

### 頁面測試

- 三態標籤顯示
- `可提現佣金 = approved`
- `累計佣金 / 本月佣金` 包含三態收入

## 風險與注意事項

- 若同時沿用 referee 聚合值與逐筆佣金狀態，可能出現雙重來源不一致
- 若 reconcile 與 cron 沒有冪等保護，可能導致重複支付
- 若前端 tab 文案不調整，使用者會混淆 `pending` 與 `approved`

因此實作時應優先保證：

- 單筆佣金狀態為支付流程唯一真實來源
- cron 僅以 `approved` 為輸入
- 統計與 UI 以狀態機為準，不再依賴模糊推導

## 建議實作順序

1. 先抽出三態統計 helper
2. 再改 `place_bet` 只產生 `pending`
3. 補 reconcile 機制，實現 `pending -> approved`
4. 改 cron 只支付 `approved` 並在成功後寫回 `settled`
5. 最後更新 referral 頁面文案、篩選與統計口徑
