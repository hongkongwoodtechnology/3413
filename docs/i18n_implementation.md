# 國際化 (i18n) 機制實作文件

## 1. 支援語言清單
目前應用程式支援以下 11 種語言（定義於 `src/lib/i18n.ts` 的 `LANGUAGES` 常數中）：

| 語言代碼 (Code) | 顯示名稱 (Label) | 國旗/圖示 | 備註 |
| :--- | :--- | :--- | :--- |
| `en` | English | 🇺🇸 | 預設語言 (Fallback) |
| `zh-TW` | 繁體中文 | 🇹🇼 | 包含 `zh-HK` 偵測 |
| `zh-CN` | 简体中文 | 🇨🇳 | 包含 `zh-SG`, `zh` 偵測 |
| `es` | Español | 🇪🇸 | 西班牙語 |
| `ar` | العربية | 🇸🇦 | 阿拉伯語 |
| `fr` | Français | 🇫🇷 | 法語 |
| `ru` | Русский | 🇷🇺 | 俄語 |
| `de` | Deutsch | 🇩🇪 | 德語 |
| `ja` | 日本語 | 🇯🇵 | 日語 |
| `ko` | 한국어 | 🇰🇷 | 韓語 |
| `pt` | Português | 🇵🇹 | 葡萄牙語 |

## 2. 自動偵測與 Fallback 規則
語言偵測邏輯實作於 `src/components/LanguageProvider.tsx` 的 `useEffect` 中，遵循以下優先順序：

1.  **使用者手動覆蓋 (Local Storage)**：
    *   系統首先檢查 `localStorage.getItem('app-language')`。
    *   若存在且為支援的語言代碼，則優先套用此設定。
2.  **作業系統/瀏覽器語言偵測 (Browser Locale)**：
    *   若無本地儲存設定，系統讀取 `navigator.language` (例如：`en-US`, `zh-TW`, `fr`)。
    *   **精確比對**：如果完全匹配支援清單中的 `code`。
    *   **模糊比對 (Base Code)**：如果開頭匹配（例如 `fr-CA` 會匹配到 `fr`）。
    *   **特殊中文處理**：將 `zh-HK` 歸類為 `zh-TW`；將 `zh-SG` 或純 `zh` 歸類為 `zh-CN`。
3.  **退回機制 (Fallback)**：
    *   如果瀏覽器語言不在上述支援清單內（例如義大利文 `it`），或者解析失敗，系統會預設使用 `en` (English)。
    *   若在某個語言的翻譯字典中缺少特定的 Key，`t()` 翻譯函數也會自動退回使用 `en` 字典中的對應值。

## 3. 手動切換與持久化
*   **執行期切換**：透過 `LanguageProvider` 提供的 `setLanguage` 函數，允許使用者在 UI 上（如右上角的 `LanguageSwitcher` 組件）動態切換語言。
*   **持久化**：當調用 `setLanguage(lang)` 時，系統會同步執行 `localStorage.setItem('app-language', lang)`，確保使用者重整頁面或下次開啟應用程式時，維持其選擇。

## 4. 新增語言步驟與命名規範

若未來需要新增語言（例如義大利語 `it`），請依循以下步驟：

### 步驟 1：更新語言型別與清單
在 `src/lib/i18n.ts` 中：
1. 將新代碼加入 `Language` type：
   ```typescript
   export type Language = 'en' | 'zh-TW' | ... | 'it';
   ```
2. 將新語言物件加入 `LANGUAGES` 陣列：
   ```typescript
   export const LANGUAGES = [
     // ...
     { code: 'it', label: 'Italiano', flag: '🇮🇹' },
   ];
   ```

### 步驟 2：新增翻譯字典
在 `src/lib/i18n.ts` 中，找到 `BASE_TRANSLATIONS` 物件，並新增該語言的鍵值對（Key-Value pairs）：
```typescript
const BASE_TRANSLATIONS: Record<Language, Record<string, string>> = {
  // ...
  it: {
    'app.title': 'Arena della Profezia',
    'hero.title.1': 'Predici lo Sport.',
    // ... 確保所有英文有的 key 都被翻譯
  }
}
```
*備註：如果該專案有多個模組的翻譯（例如目前的 `REFERRAL_KEYS`），請確保也在該模組下新增對應的語言區塊。*

### 步驟 3：更新 API 路由 (若涉及外部資料)
如果該語言需要對接外部 API（例如本專案的 ESPN API）的本地化支援，需更新 `src/app/api/matches/route.ts` 中的 `localeMap` 與 `TEAM_NAMES`：
```typescript
const localeMap: Record<string, string> = {
  // ...
  'it': 'it',
};
```

---
## 5. 測試驗證計畫 (Testing Strategy)

建議使用 Jest 或 Cypress/Playwright 進行以下測試：

### 單元測試 (Unit Tests - `LanguageProvider`)
*   **預設行為**：Mock `navigator.language` 為 `fr`，Mock `localStorage` 為空，驗證 `language` state 是否初始化為 `fr`。
*   **Fallback 測試**：Mock `navigator.language` 為 `it` (不支援)，驗證 `language` state 是否 Fallback 至 `en`。
*   **中文特例測試**：Mock `navigator.language` 為 `zh-HK`，驗證是否映射至 `zh-TW`。
*   **字典 Fallback**：呼叫 `t('missing_key')` 於非英語系，驗證是否返回英文翻譯或 key 字串。

### 整合測試 (E2E Tests)
*   **持久化測試**：在瀏覽器中點擊切換為 `ja`，斷言介面文字變更為日文。重新整理頁面 (Reload)，斷言介面依然保持為日文。
*   **覆蓋測試**：設定瀏覽器預設語言為 `de`，但 `localStorage` 中已有 `es`。載入頁面後，斷言顯示西班牙語 (`es`) 而非德語。
