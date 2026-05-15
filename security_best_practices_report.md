# PolyBall 安全審查報告

**專案名稱：** PolyBall (solana-sports-prediction)  
**技術棧：** Next.js 16.1.x (TypeScript) + Solana Web3 + 檔案式 JSON 資料庫  
**審查日期：** 2026-05-15  
**審查範圍：** 全站原始碼（前端、後端 API、Solana 程式入口）  

---

## 執行摘要

本報告針對 PolyBall 博弈平台進行**全站安全審查**，共發現 **12 個安全問題**，其中 **2 個嚴重級 (Critical)**、**4 個高風險級 (High)**、**4 個中等級 (Medium)**、**2 個低風險級 (Low)**。

最嚴重的兩個問題：
1. **所有管理員 API 完全缺乏伺服器端認證** － 攻擊者可以透過偽造請求任意操作資金、調整手續費率、空投體驗金。
2. **Helius API 金鑰以明文形式硬編碼於原始碼中** － 已公開在程式碼倉庫中，任何有權限存取倉庫的人（含離職員工）都可取得。

---

## 一、嚴重級 (Critical)

### [FINDING-001] 管理員 API 完全缺乏伺服器端認證

- **規則 ID:** NEXT-AUTH-001
- **嚴重性:** Critical
- **位置:** 多個檔案（詳見下方）
- **影響:** 攻擊者可以偽造任意 `adminAddress` 參數來執行所有管理操作，包括調整佣金率、空投體驗金、查看所有用戶資料、操作平台收益提現。**無需任何密碼或私鑰即可進行資金相關操作。**

#### 證據

以下管理操作直接從 request body 讀取 `adminAddress` 來做「驗證」，而這個值完全由客戶端提供：

**1. 空投體驗金** — [referral/route.ts:L1109-L1128](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/referral/route.ts#L1109-L1128)
```typescript
if (body.action === 'airdrop_bonus') {
    const { adminAddress, targetAddress, amount } = body;
    // 攻擊者只需傳入 adminAddress='2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K'
    if (adminAddress !== '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    // 無任何伺服器端簽名驗證
    targetData.balances.bonus += amount;
```

**2. 調整佣金率** — [referral/route.ts:L1131-L1136](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/referral/route.ts#L1131-L1136)
```typescript
if (body.action === 'update_commission_rate') {
    const { adminAddress, targetAddress, rate } = body;
    if (adminAddress !== '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
```

**3. 領導者榜查詢與營收報表** — [referral/route.ts:L1496-L1529](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/referral/route.ts#L1496-L1529)
```typescript
if (body.action === 'get_admin_revenue') {
    const { adminAddress, range, category, page, pageSize } = body;
    if (adminAddress !== '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
```

**4. 平台收益查詢與提現** — [referral/route.ts:L1329-L1360](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/referral/route.ts#L1329-L1360)
```typescript
if (body.action === 'get_platform_revenue_status') {
    const { adminAddress } = body;
    if (adminAddress !== HOUSE_WALLET.toBase58()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
}
```

**5. 以下管理端 API 路由完全沒有任何認證檢查：**
- [admin/analytics/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/analytics/route.ts) — 分析數據查詢，無任何認證
- [admin/dashboard/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/dashboard/route.ts) — 儀表板數據，無任何認證
- [admin/logs/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/logs/route.ts) — 審計日誌查詢，無任何認證
- [admin/matches/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/matches/route.ts) — 賽事數據查詢，無任何認證
- [admin/users/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/users/route.ts) — 用戶數據查詢，無任何認證
- [admin/stats/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/stats/route.ts) — 統計數據，無任何認證
- [admin/reserve/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/reserve/route.ts) — 儲備池查詢，無任何認證

#### 修復建議

1. **短期方案（緊急）：** 在所有管理端 API 中，要求呼叫者以 Solana 錢包簽署一段 challenge message，並在伺服器端驗證簽名。簽署者必須是 `HOUSE_WALLET` 或 `ADMIN_ADDRESS`。
2. **中期方案：** 引入 JWT 或 session 認證，管理員登入時簽署 challenge 換取短期 token，後續請求攜帶 token。
3. **長期方案：** 使用多簽錢包（Gnosis Safe），所有管理操作需經過多簽確認後才執行。

---

### [FINDING-002] Helius API 金鑰以明文硬編碼於原始碼

- **規則 ID:** NEXT-SECRETS-001
- **嚴重性:** Critical
- **位置:** [rpc/route.ts:L10](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/rpc/route.ts#L10)
- **影響:** Helius API 金鑰 `2c0a4b88-b8f9-4ef8-82e5-7e2f4e7e5a3d` 直接寫死在程式碼中，任何有倉庫存取權限的人（含已離職員工、承包商）都可以取得。攻擊者可以利用此金鑰消耗配額、進行 DDoS 攻擊，或透過 RPC 端點進行未授權操作。

#### 證據
```typescript
const RPC_HOSTS = [
  { hostname: "rpc.ankr.com", path: "/solana" },
  { hostname: "api.mainnet-beta.solana.com" },
  { hostname: "solana-api.projectserum.com" },
  { hostname: "solana-rpc.publicnode.com" },
  { hostname: "mainnet.helius-rpc.com", path: "/?api-key=2c0a4b88-b8f9-4ef8-82e5-7e2f4e7e5a3d" },  // ← 金鑰明文
];
```

#### 修復建議

1. **立即:** 在 Helius Dashboard 中撤銷現有 API 金鑰並重新生成。
2. 將 API 金鑰移至 `.env.local` 環境變數中（如 `HELIUS_API_KEY=xxx`）。
3. 確認 `.gitignore` 已包含 `.env*` 檔案（目前已包含），並掃描 git 歷史確保金鑰未被提交。
4. 使用 `git filter-branch` 或 BFG Repo-Cleaner 從 git 歷史中移除金鑰。

---

## 二、高風險級 (High)

### [FINDING-003] 圖片代理端點存在 SSRF 風險

- **規則 ID:** NEXT-SSRF-001
- **嚴重性:** High
- **位置:** [image-proxy/route.ts:L3-L37](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/image-proxy/route.ts#L3-L37)
- **影響:** `/api/image-proxy?url=xxx` 端點接受任意 URL 並以伺服器身分發起 HTTP 請求，攻擊者可以：
  - 掃描內部網路服務（`http://localhost:3000`、`http://169.254.169.254` 雲端 metadata 端點）
  - 將伺服器作為代理進行攻擊或繞過 IP 限制
  - 下載惡意內容導致伺服器資源耗盡

#### 證據
```typescript
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');  // ← 用戶完全可控
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }
  try {
    const res = await fetch(url, {  // ← 無任何限制，直接請求任意 URL
```

#### 修復建議

1. 限制只允許 fetch 來自 `livescore.com` 等已知圖片 CDN 的 URL。
2. 至少加入 hostname allowlist 和 protocol 檢查（只允許 `https:`）。
3. 封鎖私有 IP 範圍（`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`）。
4. 加入請求超時和回應大小限制。

---

### [FINDING-004] RPC 代理端點開放給任意用戶濫用

- **規則 ID:** NEXT-AUTH-001
- **嚴重性:** High
- **位置:** [rpc/route.ts:L69-L83](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/rpc/route.ts#L69-L83)
- **影響:** `/api/rpc` 端點無任何認證，直接將任意 POST body 轉發至多個 Solana RPC 節點（含付費 Helius 節點）。攻擊者可以：
  - 利用此端點消耗 Helius 付費 API 配額
  - 將此端點作為公開 RPC 節點代理，繞過前端 CORS 限制
  - 發送大量請求導致 API 金鑰被限流或封鎖

#### 證據
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();     // ← 任意請求體，無驗證
    const result = await rpcProxy(body);  // ← 直接轉發
    return new NextResponse(result, { ... });
```

#### 修復建議

1. 對此端點加入 referer/origin 檢查，僅允許來自自身網站的請求。
2. 考慮加入速率限制（rate limiting）。
3. 對 RPC 請求內容進行基本白名單過濾（只允許 `getBalance`, `getAccountInfo`, `getParsedTransaction` 等讀取方法，拒絕 `sendTransaction` 等寫入方法）。

---

### [FINDING-005] 自動結算端點缺乏認證保護

- **規則 ID:** NEXT-AUTH-001
- **嚴重性:** High
- **位置:** [cron/settle/route.ts:L266-L473](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/cron/settle/route.ts#L266-L473)
- **影響:** `/api/cron/settle` (GET) 是一個極其敏感的端點，會使用 `ADMIN_SECRET_KEY` 執行實際的鏈上資金轉移（派彩 + 退款 + 佣金轉帳）。雖然它不像 [FINDING-001] 那樣可被偽造參數攻擊（因為它使用伺服器端的環境變數），但任何能發送 HTTP GET 請求至此端點的人都可以觸發完整的派彩流程。攻擊者可以透過反覆呼叫來消耗 SOL 作為 gas 費用、或觸發資金在非預期時間轉出。

#### 證據
```typescript
export async function GET(request: Request) {  // ← 單純的 GET，無任何 caller 驗證
    // ...
    const adminKeypair = Keypair.fromSecretKey(secretKey); // ← 從 env 載入私鑰
    // 直接執行鏈上轉帳...
```

#### 修復建議

1. 加入 caller 驗證：要求請求必須帶有一個由 `ADMIN_SECRET_KEY` 簽署的 timestamp/challenge，或使用 shared secret HMAC 驗證。
2. 將此端點改用 POST 方法，避免 GET 請求被瀏覽器預加載或快取觸發。
3. 加入冪等性檢查（idempotency key），防止重複派彩。

---

### [FINDING-006] 下注 API 缺乏金額上限與速率限制

- **規則 ID:** NEXT-DOS-001 / NEXT-INPUT-001
- **嚴重性:** High
- **位置:** [bets/route.ts:L138-L299](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/bets/route.ts#L138-L299)
- **影響:** `/api/bets` (POST) 沒有對 `amount` 欄位進行上限驗證（目前的 85% 持倉上限檢查僅針對單一市場內的比例，不限制絕對金額）。攻擊者在冷啟動階段可以利用手續費補貼機制（`isFeeFundedCold`）發送極大金額投注，使得市場賠率失真或儲備池數學出現異常。

#### 證據
```typescript
// bets/route.ts 中沒有絕對金額上限檢查
const newBet: BetRecord = {
    id: `bet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    amount,  // ← amount 僅在前端限制了類型，沒有服務端絕對上限
```

#### 修復建議

1. 加入單筆下注的絕對金額上限（如 10,000 USDT）。
2. 加入每個用戶的總投注上限。
3. 加入按 IP 或用戶地址的速率限制。

---

## 三、中等級 (Medium)

### [FINDING-007] CORS 設定過於寬鬆：全 API 路徑使用 Origin 萬用字元

- **規則 ID:** NEXT-CORS-001
- **嚴重性:** Medium
- **位置:** [vercel.json:L10-L16](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/vercel.json#L10-L16)
- **影響:** 所有 `/api/*` 路徑都設定 `Access-Control-Allow-Origin: *`，這意味任何網站都可以從用戶瀏覽器向 PolyBall API 發起跨站請求。雖然目前認證不是基於 cookie（因此 CSRF 風險相對較低），但這會讓攻擊者可以在惡意網站上讀取 API 回應（如用戶餘額、投注紀錄等敏感資訊）。

#### 證據
```json
{
  "source": "/api/(.*)",
  "headers": [
    { "key": "Access-Control-Allow-Origin", "value": "*" },
    { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
```

#### 修復建議

1. 將 `Access-Control-Allow-Origin` 改為具體的允許來源（如 `https://polyball.xyz`）。
2. 若需要支援多個子域名，可在伺服器端動態讀取 `Origin` header 並與 allowlist 比對後設定。

---

### [FINDING-008] 管理員 Token 存於 localStorage，易受 XSS 攻擊竊取

- **規則 ID:** JS-STORAGE-001
- **嚴重性:** Medium
- **位置:** [client.ts:L27](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/lib/api/client.ts#L27)
- **影響:** 管理員認證 token 儲存在 `localStorage` 中。若網站存在任何 XSS 漏洞（包括第三方依賴庫的供應鏈攻擊），攻擊者可以透過 `localStorage.getItem('admin_token')` 竊取 token 並冒充管理員。

#### 證據
```typescript
const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
// ...
...(token ? { 'Authorization': `Bearer ${token}` } : {}),
```

#### 修復建議

1. 將 token 改存於 `HttpOnly` cookie 中（需要後端配合設定）。
2. 若必須使用 localStorage，至少應將 token 存在 closure 變數中而非 localStorage。
3. 加入 CSP 防禦層以降低 XSS 的影響範圍。

---

### [FINDING-009] Content-Security-Policy 過於薄弱

- **規則 ID:** JS-CSP-001 / NEXT-CSP-001
- **嚴重性:** Medium
- **位置:** [layout.tsx:L110](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/[locale]/layout.tsx#L110)
- **影響:** 目前的 CSP 僅設定 `upgrade-insecure-requests`，這幾乎沒有提供任何 XSS 防護。對於一個處理金錢交易的 DeFi 應用，這是非常不足的——一旦出現 XSS 漏洞，攻擊者可以注入任意腳本竊取錢包連接資訊或操縱交易。

#### 證據
```html
<meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
```

#### 修復建議

1. 加入 `script-src 'self'` 限制腳本來源。
2. 加入 `connect-src` 限制可連接的 API 端點。
3. 加入 `frame-ancestors 'none'` 防止點擊劫持（注意：需在 HTTP header 中設定，`<meta>` 不支援 `frame-ancestors`）。
4. 考慮使用 `nonce` 模式而非 `unsafe-inline`。

---

### [FINDING-010] 管理員地址為公開硬編碼常數

- **規則 ID:** NEXT-SECRETS-001（變體）
- **嚴重性:** Medium
- **位置:** 多處（見下方）
- **影響:** 管理員錢包地址 `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K` 在多個位置作為硬編碼常數出現。雖然 Solana 地址本質上是公開資訊，但將管理員地址寫死於多個檔案的程式碼中會降低日後更換管理員錢包的靈活性，也讓攻擊者更容易識別高價值目標。

#### 證據
- [wallets.ts:L10](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/lib/wallets.ts#L10) — `HOUSE_WALLET` 預設值
- [cron/settle/route.ts:L8](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/cron/settle/route.ts#L8) — `ADMIN_ADDRESS`
- [page.tsx:L399](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/[locale]/page.tsx#L399) — 前端判斷管理員

#### 修復建議

1. 將管理員地址統一從環境變數讀取，不要有 hardcoded fallback。
2. 若必須有 fallback，應在啟動時記錄警告。

---

## 四、低風險級 (Low)

### [FINDING-011] 使用 `dangerouslySetInnerHTML`（資料安全但為不良模式）

- **規則 ID:** NEXT-XSS-001
- **嚴重性:** Low
- **位置:** [layout.tsx:L111-L114](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/[locale]/layout.tsx#L111-L114)
- **影響:** 目前注入的內容是 `JSON.stringify(jsonLd)`，其中 `jsonLd` 是硬編碼的常數 JSON，因此沒有實際的 XSS 風險。但使用 `dangerouslySetInnerHTML` 是警示信號，未來開發者可能複製此模式用於注入用戶可控內容。

#### 證據
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

#### 修復建議

1. 使用 Next.js 的 `<Script>` 組件搭配 `strategy="beforeInteractive"` 或使用 `dangerouslySetInnerHTML` 的替代方案。
2. 若保留此寫法，加入明確的程式碼註釋說明「僅用於靜態 JSON-LD，勿用於用戶內容」。

---

### [FINDING-012] 部分 API 回應暴露過多內部錯誤資訊

- **規則 ID:** NEXT-ERROR-001
- **嚴重性:** Low
- **位置:** 多處 API catch block
- **影響:** 多個 API 端點在 catch block 中直接將錯誤訊息返回給客戶端，可能暴露內部實作細節或 RPC 節點資訊。

#### 證據
```typescript
// bets/route.ts 結尾
} catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: 'Failed to save bet' }, { status: 500 });
}
```
此處做了基本的錯誤隱藏，但其他端點（如 [referral/route.ts:L1543](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/referral/route.ts#L1543)）使用 `'Invalid request'` 可能誤導除錯過程。

#### 修復建議

1. 統一錯誤處理模式：對客戶端返回通用錯誤訊息，詳細錯誤僅記錄在伺服器日誌中。
2. 確保生產環境不啟用 `DEBUG_MATCH_SETTLEMENT`、`DEBUG_MATCH_CLEANUP` 等除錯環境變數。

---

## 五、正面發現

以下是審查中發現的良好安全實踐：

1. **安全 Header 配置完善** — [vercel.json](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/vercel.json) 已設定 HSTS（max-age=2年）、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`。
2. **`.gitignore` 正確配置** — `.env*` 檔案已被排除，不會意外提交環境變數。
3. **現金流數學驗證** — `verifySplitTransfer` 函數（[referral/route.ts:L517-L610](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/referral/route.ts#L517-L610)）對鏈上交易進行了詳細的 token transfer 金額驗證，防止金額造假。
4. **資料脫敏機制** — Admin 端的用戶列表（ [admin/users/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/users/route.ts) ）和審計日誌（ [admin/logs/route.ts](file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/admin/logs/route.ts) ）使用了 `maskWalletAddress` 和 `maskAdminName` 脫敏函數。
5. **Next.js 版本較新** — 專案使用 Next.js 16.1.6，屬於受支援版本，未有已知的 react2shell (CVE-2025-66478) 漏洞影響。
6. **每日滾動備份** — `saveDatabase` 函數會自動建立每日 JSON 備份，降低資料損毀風險。

---

## 六、優先修復建議

| 優先級 | Finding | 修復動作 |
|--------|---------|----------|
| 🔴 P0 | FINDING-001 | 所有管理端 API 加入錢包簽名驗證 |
| 🔴 P0 | FINDING-002 | 撤銷並旋轉 Helius API 金鑰，移入環境變數 |
| 🟠 P1 | FINDING-003 | 限制圖片代理端點的目標域名 |
| 🟠 P1 | FINDING-004 | 加入 RPC 代理端點的來源檢查與速率限制 |
| 🟠 P1 | FINDING-005 | 自動結算端點加入 caller 驗證 |
| 🟡 P2 | FINDING-006 | 加入下注金額上限 |
| 🟡 P2 | FINDING-007 | 縮小 CORS 允許範圍 |
| 🟡 P2 | FINDING-008 | Token 改存 HttpOnly cookie |
| 🟢 P3 | FINDING-009 | 強化 CSP 策略 |
| 🟢 P3 | FINDING-010 | 管理員地址移至環境變數 |

---

*報告由自動化安全審查工具輔助生成，基於 Next.js 16.1.x 安全最佳實踐規範（NEXT-SEC-* 規則）與前端 JavaScript 安全規範（JS-* 規則）。*
