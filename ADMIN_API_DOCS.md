# ADMIN 系統架構與 API 服務指引

## 系統架構設計

為確保 ADMIN 管理介面的安全性、效能與擴展性，我們導入了以下架構與機制：

1. **統一的 API 服務層 (`src/lib/api/client.ts`)**：
   - 所有前端對後端的請求皆透過 `apiClient` 發送，它封裝了原生的 `fetch`。
   - 內建超時控制 (預設 8 秒)。
   - 自動在 Request Header 夾帶身份驗證 Token (`Authorization: Bearer <token>`)。
   - 統一攔截並處理非 200 狀態碼，並拋出標準化的 `ApiError`，供前端 UI 捕捉並顯示友善錯誤訊息。

2. **真實後端 API 路由 (`src/app/api/admin/*`)**：
   - 運用 Next.js 的 Route Handlers (App Router) 建構完整的 RESTful API 端點，目前運行於 `http://localhost:3000/api/admin/...`。
   - 支援分頁 (`?page=1&limit=10`) 與多維度搜尋 (`?search=...&type=...`)。
   - 內建延遲模擬 (Simulated Network Latency)，以真實反映非同步載入過程中的 UI 狀態。

3. **使用者體驗 (UX) 優化**：
   - 導入 Skeleton / Spinner Loading 機制，資料載入時不阻塞畫面。
   - 實作「錯誤捕捉與重試機制 (Error Handling & Retry)」，當 API 發生錯誤時，提供使用者明確的錯誤訊息與重新整理按鈕。

## RESTful API 服務端點文件

所有 API 的 Base URL 為: `http://localhost:3000/api/admin`

### 1. Dashboard 即時監控數據
- **Endpoint**: `/dashboard`
- **Method**: `GET`
- **Description**: 取得即時進行中球賽的投注數據與系統 KPI。
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      { "id": "1", "teamA": "Lakers", "totalPool": 95400, "status": "Live 3Q", ... }
    ]
  }
  ```

### 2. 用戶與介紹人查詢
- **Endpoint**: `/users`
- **Method**: `GET`
- **Query Params**: 
  - `search` (string): 搜尋關鍵字 (ID, 錢包, 介紹代碼)
  - `type` (string): 篩選身份 ('all', 'user', 'referrer')
  - `page` (number): 頁碼
  - `limit` (number): 每頁筆數
- **Response**:
  ```json
  {
    "success": true,
    "data": [...],
    "meta": { "total": 4, "page": 1, "limit": 10 }
  }
  ```

### 3. 語言版本與行為分析
- **Endpoint**: `/analytics`
- **Method**: `GET`
- **Description**: 取得多維度圖表所需的統計數據。

### 4. 系統安全操作日誌 (Audit Logs)
- **Endpoint**: `/logs`
- **Method**: `GET`
- **Query Params**: `search` (string)
- **Description**: 取得管理員的敏感操作紀錄（已實作資料脫敏）。

## 單元測試與驗證

專案中包含針對 API Client 核心層的單元測試，確保 HTTP 請求機制穩健。

**執行測試命令：**
```bash
npm run test
# 或
npx jest src/tests/admin
```
測試範圍涵蓋：成功資料獲取、404 等狀態碼錯誤攔截、以及 Network Timeout 的邊界條件。

## 部署與驗收指引

1. **環境變數設置**：部署前請確認 `.env` 檔案中是否需要設定 `NEXT_PUBLIC_API_URL`（若未設定則預設指向自身 `http://localhost:3000/api`）。
2. **啟動專案**：
   ```bash
   npm run build
   npm run start
   ```
3. **功能驗收標準**：
   - 進入 `/admin` 系列路由，應可看見 Spinner 載入畫面，隨後真實渲染資料。
   - 嘗試在瀏覽器 Network 面板中將網路設為 Offline，觀察介面是否能正確彈出紅色的「資料載入失敗」提示框與重試按鈕。
   - 在 `/admin/users` 頁面輸入搜尋關鍵字並按下 Enter 或點擊搜尋，確認資料列表能即時過濾。
