# 數據來源修正報告：拔除前端硬編碼圖表數據

## 1. 問題發現

您提到的「所有數據都不是來自 `http://localhost:3000/`」，是因為在前端的 Dashboard 頁面 (`src/app/admin/page.tsx`) 中，**「近1小時投注金額趨勢 (LineChart)」** 與 **「體育項目投注分布 (PieChart)」** 兩張圖表的數據，是完全被寫死（Hardcoded）在前端原始碼中的：

```typescript
// 原本寫死在 page.tsx 的假資料，完全沒有向後端發出請求：
const mockTrendData = Array.from({ length: 10 }).map((_, i) => ({
  time: `10:${i}0`,
  volume: 5000 + i * 500,
}));

const mockDistributionData = [
  { name: '籃球 (Basketball)', value: 400 },
  { name: '足球 (Football)', value: 300 },
  // ...
];
```

這導致即使我們之前修復了 API Client 的連線路徑，這兩張圖表也「完全沒有發送 HTTP 請求」到 `localhost:3000` 獲取數據。

## 2. 修正內容

為了讓所有數據都確實透過網路請求從後端 (`http://localhost:3000/api/...`) 獲取，我進行了以下修改：

### A. 後端 API 擴充 (`src/app/api/admin/dashboard/route.ts`)
我們讓 Dashboard API 不只回傳即時賽事 (`liveMatches`)，還一併產生並回傳圖表所需的動態數據 (`trendData`, `distributionData`)：
```typescript
return NextResponse.json({ 
    success: true, 
    data: {
        liveMatches,
        trendData,
        distributionData
    }
});
```

### B. 前端圖表串接真實 API (`src/app/admin/page.tsx`)
拔除所有 `mock` 變數，並修改 `fetchDashboardData` 函數，將接收到的圖表數據放入 State 中，並綁定到 `LineChart` 與 `PieChart` 上：
```typescript
const [trendData, setTrendData] = useState<any[]>([]);
const [distributionData, setDistributionData] = useState<any[]>([]);

// 從 http://localhost:3000/api/admin/dashboard 取得數據
const response = await apiClient.get('/admin/dashboard');
setTrendData(response.data.trendData);
setDistributionData(response.data.distributionData);
```

### C. 整合測試同步更新 (`src/tests/admin/api-integration.test.ts`)
修改了 Jest 測試案例，確保自動化測試能正確檢查新加入的 `trendData` 與 `distributionData` 屬性。

## 3. 驗證方式

現在您可以重新整理 `http://localhost:3000/admin`，並打開 DevTools (F12) 的 **Network 面板**：
1. 您會看到只有 **一個** 針對 `/api/admin/dashboard` 的請求。
2. 該請求的 Response Preview 裡面，會包含完整的圖表與列表數據。
3. 畫面上所有的圖表與列表，現在都是 100% 來自 `http://localhost:3000/` 的後端 API 回應，不再有任何寫死的靜態數據！