# Referral Feature Copy Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 `GAMBLE-referral-direct-bet-visibility` 的 referral 行為完整搬回 `GAMBLE`，包含三態佣金、`reconcile_commissions`、下注成功時序、體驗金首注限制與 referral 頁 direct bet 可見性，同時保留主專案必要的相容與授權補強。

**Architecture:** 先把 referral API 與統計口徑對齊到副本，讓主專案能接受 `pending / approved / settled` 三態資料並支援 `reconcile_commissions`。接著將首頁與多語首頁的下注成功流程改為「先持久化 `/api/bets`，再更新成功 UI」，再把 referral 頁與 i18n 對齊到副本行為。整體實作遵守「不覆蓋 `data/referral_db.json`，只做執行期相容」原則。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Jest, Testing Library, file-based JSON DB, Solana Web3

---

## File Structure

### Files to modify

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
  - 對齊副本的佣金資料模型、`reconcile_commissions` 分支、三態讀寫與舊資料相容補值。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`
  - 補三態與 reconcile 的 API 回歸測試。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.ts`
  - 將 referral 統計 helper 擴充為三態口徑。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.test.ts`
  - 驗證 `total / month / withdrawable` 的三態統計口徑。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.ts`
  - 只結算 `approved` 佣金並回寫 `settled`。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.test.ts`
  - 補 `approved` 專用結算測試。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
  - 讓下注成功流程以 `/api/bets` 成功為前提，之後才更新 bet 與 success UI。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.test.tsx`
  - 驗證非 locale 首頁的下注成功時序與失敗回退。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx`
  - 對齊 locale 首頁相同的下注成功時序。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.test.tsx`
  - 驗證 locale 首頁下注成功時序與失敗回退。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
  - 對齊副本的三態顯示與 direct bet 可見性。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`
  - 驗證三態標籤、direct bet 顯示與 aggregate fallback。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`
  - 補 `referral.status.*` 與 `referral.tab.approved` 等文案。

### Files to reference only

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\ReferralHandler.tsx`
  - 確認 canonical referrer 綁定行為不需改動。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\ReferralHandler.test.tsx`
  - 作為回歸測試，確保推薦綁定邏輯未退化。
- `c:\Users\USER\Documents\trae_projects\GAMBLE\data\referral_db.json`
  - 只作為現有資料格式參考，不可覆蓋。

## Task 1: 對齊 Referral API 的三態資料模型與 reconcile 流程

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.test.ts`

- [ ] **Step 1: 為三態統計先寫失敗測試**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.test.ts` 加入這個測試：

```ts
import { calculateReferralStats } from './referral-stats';

describe('calculateReferralStats', () => {
  it('counts pending, approved, and settled toward total and month while only approved is withdrawable', () => {
    const now = Date.parse('2026-05-16T12:00:00.000Z');

    const result = calculateReferralStats({
      commissions: [
        {
          referee: 'ref-pending',
          commission: '0.120000',
          timestamp: '2026-05-16T08:00:00.000Z',
          status: 'pending',
        },
        {
          referee: 'ref-approved',
          commission: '0.080000',
          timestamp: '2026-05-16T09:00:00.000Z',
          status: 'approved',
        },
        {
          referee: 'ref-settled',
          commission: '0.050000',
          timestamp: '2026-05-16T10:00:00.000Z',
          status: 'settled',
        },
        {
          referee: 'WITHDRAWAL',
          commission: '-0.030000',
          timestamp: '2026-05-16T11:00:00.000Z',
          status: 'settled',
        },
      ],
      now,
    });

    expect(result.total).toBe('0.250000 USDT');
    expect(result.month).toBe('0.250000 USDT');
    expect(result.withdrawable).toBe('0.080000 USDT');
  });
});
```

- [ ] **Step 2: 執行統計測試確認先失敗**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\lib\referral-stats.test.ts
```

Expected:

```text
FAIL src/lib/referral-stats.test.ts
Expected: "0.080000 USDT"
Received: "0.000000 USDT" or a settled-only value
```

- [ ] **Step 3: 實作三態統計 helper**

將 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.ts` 的核心 helper 改成：

```ts
type ReferralCommission = {
  referee: string;
  commission: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'settled';
};

export function calculateReferralStats(params: {
  commissions: ReferralCommission[];
  now?: number;
}) {
  const now = params.now ?? Date.now();
  const active = params.commissions.filter((commission) => commission.referee !== 'WITHDRAWAL');
  const monthWindowMs = 30 * 24 * 60 * 60 * 1000;

  const total = active.reduce((sum, commission) => {
    return sum + (Number.parseFloat(commission.commission) || 0);
  }, 0);

  const month = active.reduce((sum, commission) => {
    const ts = Date.parse(commission.timestamp);
    if (!Number.isFinite(ts) || now - ts > monthWindowMs) return sum;
    return sum + (Number.parseFloat(commission.commission) || 0);
  }, 0);

  const withdrawable = active.reduce((sum, commission) => {
    if (commission.status !== 'approved') return sum;
    return sum + (Number.parseFloat(commission.commission) || 0);
  }, 0);

  return {
    total: `${total.toFixed(6)} USDT`,
    month: `${month.toFixed(6)} USDT`,
    withdrawable: `${withdrawable.toFixed(6)} USDT`,
  };
}
```

- [ ] **Step 4: 為 API reconcile 與三態讀寫加失敗測試**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts` 追加：

```ts
it('creates pending commission rows on place_bet and promotes them to approved via reconcile', async () => {
  const referrer = '0xThreeStateReferrer';
  const referee = '0xThreeStateReferee';

  await POST(new Request('http://localhost:3000/api/referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: referrer, newRefereeAddress: referee }),
  }));

  await POST(new Request('http://localhost:3000/api/referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'place_bet',
      userAddress: referee,
      referrerAddress: referrer,
      betAmount: 5,
      poolAmount: 4.6,
      houseAmount: 0.28,
      commissionAmount: 0.12,
      signature: 'mock-signature-three-state',
    }),
  }));

  let res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
  let json = await res.json();

  expect(json.data.commissions[0].status).toBe('pending');
  expect(json.data.stats.withdrawable).toBe('0.000000 USDT');

  const reconcileRes = await POST(new Request('http://localhost:3000/api/referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'reconcile_commissions',
      userAddress: referrer,
    }),
  }));
  const reconcileJson = await reconcileRes.json();

  expect(reconcileJson.success).toBe(true);
  expect(reconcileJson.updated).toBe(1);

  res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
  json = await res.json();

  expect(json.data.commissions[0].status).toBe('approved');
  expect(json.data.stats.total).toBe('0.120000 USDT');
  expect(json.data.stats.withdrawable).toBe('0.120000 USDT');
});
```

- [ ] **Step 5: 執行 API 測試確認先失敗**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "creates pending commission rows on place_bet and promotes them to approved via reconcile" src\app\api\referral\route.test.ts
```

Expected:

```text
FAIL src/app/api/referral/route.test.ts
Expected: "pending"
Received: "settled" or missing reconcile branch
```

- [ ] **Step 6: 對齊 referral route 的 Commission 介面與相容補值**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`：

1. 把 `Commission.status` 改成三態。
2. 補上 `approvedAt`、`settledAt`、`settlementTx`。
3. 在 `loadDatabase()` 後增加一個 normalize helper，確保舊資料可讀。

加入這段型別與 normalize helper：

```ts
interface Commission {
    id: string;
    referee: string;
    betAmount: string;
    fee: string;
    commission: string;
    timestamp: string;
    status: 'pending' | 'approved' | 'settled';
    signature?: string;
    approvedAt?: string;
    settledAt?: string;
    settlementTx?: string;
}

function normalizeUserData(address: string, db: Record<string, UserData>): UserData {
    const existing = db[address];
    if (!existing) {
        db[address] = {
            stats: { total: '0 USDT', withdrawable: '0 USDT', month: '0 USDT', friends: 0 },
            commissions: [],
            referees: [],
            balances: { usdt: 0, bonus: 0 },
        };
        return db[address];
    }

    existing.balances = existing.balances ?? { usdt: 0, bonus: 0 };
    existing.commissions = (existing.commissions ?? []).map((commission) => ({
        ...commission,
        status: commission.status ?? 'pending',
    }));
    existing.referees = (existing.referees ?? []).map((referee) => ({
        ...referee,
        rewardIssued: referee.rewardIssued ?? false,
    }));
    existing.stats = {
        total: existing.stats?.total ?? '0 USDT',
        withdrawable: existing.stats?.withdrawable ?? '0 USDT',
        month: existing.stats?.month ?? '0 USDT',
        friends: existing.stats?.friends ?? existing.referees.length,
    };

    return existing;
}
```

- [ ] **Step 7: 讓 `place_bet` 產生 `pending`，並加入 `reconcile_commissions`**

在同一個 route 檔中：

1. 把成功下注的佣金紀錄從 `settled` 改成 `pending`。
2. 移除下注當下直接累加 `stats.total / stats.month / stats.withdrawable` 的區塊，統一交給 `calculateReferralStats()`。
3. 新增 reconcile action。

使用這段 helper 與 action：

```ts
function reconcileUserCommissions(userData: UserData): number {
    let updated = 0;

    for (const commission of userData.commissions) {
        if (commission.referee === 'WITHDRAWAL') continue;
        if (commission.status !== 'pending') continue;
        if (!commission.signature) continue;

        commission.status = 'approved';
        commission.approvedAt = new Date().toISOString();
        updated += 1;
    }

    return updated;
}
```

```ts
if (body.action === 'reconcile_commissions') {
    const { userAddress } = body;

    if (!userAddress) {
        return NextResponse.json({ error: 'Missing userAddress' }, { status: 400 });
    }

    const userData = getOrCreateUserData(userAddress, db);
    const updated = reconcileUserCommissions(userData);
    const calculated = calculateReferralStats({ commissions: userData.commissions });
    userData.stats.total = calculated.total;
    userData.stats.month = calculated.month;
    userData.stats.withdrawable = calculated.withdrawable;
    saveDatabase(db);

    return NextResponse.json({ success: true, updated });
}
```

下注成功的佣金紀錄則改成：

```ts
referrerData.commissions.unshift({
    id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    referee: userAddress,
    betAmount: betAmount.toFixed(6),
    fee: platformFee.toFixed(6),
    commission: commissionEarned.toFixed(6),
    timestamp: new Date().toISOString(),
    status: 'pending' as const,
    signature,
});
```

- [ ] **Step 8: 執行統計與 API 測試確認通過**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\lib\referral-stats.test.ts src\app\api\referral\route.test.ts
```

Expected:

```text
PASS src/lib/referral-stats.test.ts
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/referral-stats.ts src/lib/referral-stats.test.ts src/app/api/referral/route.ts src/app/api/referral/route.test.ts
git commit -m "feat: align referral api with feature copy workflow"
```

## Task 2: 讓 settle cron 只處理 `approved` 佣金

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.test.ts`

- [ ] **Step 1: 先寫 approved-only 結算測試**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.test.ts` 新增：

```ts
it('settles only approved referral commissions and leaves pending commissions untouched', async () => {
  const referralDb = {
    Referrer111: {
      stats: { total: '0.200000 USDT', withdrawable: '0.080000 USDT', month: '0.200000 USDT', friends: 1 },
      commissions: [
        {
          id: 'comm-approved-1',
          referee: 'Referee111',
          betAmount: '5.000000',
          fee: '0.400000',
          commission: '0.080000',
          timestamp: '2026-05-16T00:00:00.000Z',
          status: 'approved',
          signature: 'sig-approved-1',
          approvedAt: '2026-05-16T00:05:00.000Z',
        },
        {
          id: 'comm-pending-1',
          referee: 'Referee222',
          betAmount: '5.000000',
          fee: '0.400000',
          commission: '0.120000',
          timestamp: '2026-05-16T00:00:00.000Z',
          status: 'pending',
          signature: 'sig-pending-1',
        },
      ],
      referees: [],
      balances: { usdt: 0, bonus: 0 },
    },
  };

  // 依現有測試檔的 fs/saveDb mock 寫入 referralDb 後呼叫 route
  // 斷言:
  // 1. 只有 approved 佣金被送去支付
  // 2. approved 變成 settled 並帶 settlementTx
  // 3. pending 維持 pending
});
```

- [ ] **Step 2: 執行 cron 測試確認先失敗**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "settles only approved referral commissions and leaves pending commissions untouched" src\app\api\cron\settle\route.test.ts
```

Expected:

```text
FAIL src/app/api/cron/settle/route.test.ts
Expected only approved commissions to be settled
```

- [ ] **Step 3: 將 cron 的來源從 referee aggregate 改成 approved ledger**

把 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.ts` 中收集待支付佣金的邏輯改成：

```ts
interface ApprovedCommission {
  referrerAddress: string;
  commissionId: string;
  earnedValue: number;
}

const commissions: ApprovedCommission[] = [];
for (const [address, data] of Object.entries(referralDb || {}) as [string, any][]) {
  for (const commission of data?.commissions || []) {
    if (commission.referee === 'WITHDRAWAL') continue;
    if (commission.status !== 'approved') continue;

    commissions.push({
      referrerAddress: address,
      commissionId: commission.id,
      earnedValue: parseFloat(commission.commission) || 0,
    });
  }
}
```

- [ ] **Step 4: 支付成功後回寫 `settled` 與統計**

把成功回寫區塊改成：

```ts
const settledAt = new Date().toISOString();
for (const commission of userData?.commissions || []) {
  if (commission.id !== comm.commissionId) continue;
  commission.status = 'settled';
  commission.settledAt = settledAt;
  commission.settlementTx = sig;
}

const calculated = calculateReferralStats({ commissions: userData.commissions || [] });
if (userData.stats) {
  userData.stats.total = calculated.total;
  userData.stats.month = calculated.month;
  userData.stats.withdrawable = calculated.withdrawable;
}
```

並在檔案頂部引入：

```ts
import { calculateReferralStats } from '@/lib/referral-stats';
```

- [ ] **Step 5: 執行 cron 測試確認通過**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\app\api\cron\settle\route.test.ts
```

Expected:

```text
PASS src/app/api/cron/settle/route.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/settle/route.ts src/app/api/cron/settle/route.test.ts
git commit -m "feat: settle approved referral commissions only"
```

## Task 3: 修正首頁與多語首頁的下注成功時序

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.test.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.test.tsx`

- [ ] **Step 1: 先為非 locale 首頁寫下注持久化時序測試**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.test.tsx` 追加：

```tsx
it('does not leave a fake successful bet in the UI when /api/bets persistence fails', async () => {
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => 'wallet-111' };
  mockedSendTransaction = jest.fn().mockResolvedValue('sig-111');
  mockedSkipChainProgress = true;
  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(0);

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/balance?address=')) return makeJsonResponse({ success: true, balance: 100 });
    if (url.startsWith('/api/bets?address=')) return makeJsonResponse({ success: true, data: [] });
    if (url === '/api/bets' && init?.method === 'POST') {
      return makeJsonResponse({ success: false, error: 'backend rejected' }, false);
    }
    return makeJsonResponse({ success: true, data: [] });
  }) as jest.Mock;

  window.alert = jest.fn();
  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText('Alpha FC')).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole('button', { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'btn.confirm' }));

  await waitFor(() => {
    expect(window.alert).toHaveBeenCalled();
  });

  expect(screen.queryByText('btn.success')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 執行首頁測試確認先失敗**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "does not leave a fake successful bet in the UI when /api/bets persistence fails" src\app\page.test.tsx
```

Expected:

```text
FAIL src/app/page.test.tsx
Expected alert to have been called or expected btn.success not to appear
```

- [ ] **Step 3: 重排非 locale 首頁的 success timing**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx` 的 `executePrediction()` 中，把本地 bet 寫入與成功 UI 推進放到 `/api/bets` 成功之後。

目標結構改成：

```tsx
const saveRes = await fetch('/api/bets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...newBet,
    odds: lockedOdds,
    userAddress: currentAddress,
    signature: txSignature,
    liveMinute: matchInfo.liveMinute,
  }),
});
const saveJson = await saveRes.json().catch(() => ({}));
if (!saveRes.ok || !saveJson.success) {
  throw new Error(
    typeof saveJson.error === 'string' && saveJson.error.length > 0
      ? saveJson.error
      : saveRes.statusText || 'Failed to save bet to backend.'
  );
}

setMyBets((prev) => [newBet, ...prev]);
setMatchesIfChanged((prevMatches) => prevMatches.map((m) => {
  if (m.id !== selectedMatchId) return m;
  const updatedMatch = { ...m };
  const effectivePoolLegacy = !useBonus ? poolAmountForDisplay : betAmountNum;
  updatedMatch.pools = {
    ...m.pools,
    [outcome]: m.pools[outcome as keyof typeof m.pools] + effectivePoolLegacy,
  };
  return updatedMatch;
}));
setBetsRefreshKey((k) => k + 1);
setTxStatus('success');
```

- [ ] **Step 4: 對 locale 首頁加同一個失敗測試**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.test.tsx` 追加同構測試，差別只在 `window.history.replaceState({}, '', '/zh-TW')` 與 `mockedLanguage = 'zh-TW'`。

測試核心保持：

```tsx
expect(window.alert).toHaveBeenCalled();
expect(screen.queryByText('btn.success')).not.toBeInTheDocument();
```

- [ ] **Step 5: 對 locale 首頁套用相同 success timing 重排**

將 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx` 的 `executePrediction()` 對齊到與非 locale 首頁相同的 `/api/bets` 成功後才更新本地狀態邏輯。

保留與同步的關鍵片段：

```tsx
if (!saveRes.ok || !saveJson.success) {
  throw new Error(
    typeof saveJson.error === 'string' && saveJson.error.length > 0
      ? saveJson.error
      : saveRes.statusText || 'Failed to save bet to backend.'
  );
}

setMyBets((prev) => [newBet, ...prev]);
setBetsRefreshKey((k) => k + 1);
setTxStatus('success');
```

- [ ] **Step 6: 執行首頁與多語首頁測試**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\app\page.test.tsx src\app\[locale]\page.test.tsx
```

Expected:

```text
PASS src/app/page.test.tsx
PASS src/app/[locale]/page.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/page.test.tsx src/app/[locale]/page.tsx src/app/[locale]/page.test.tsx
git commit -m "fix: persist bets before showing success state"
```

## Task 4: 對齊 referral 頁三態與 direct bet 可見性

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`

- [ ] **Step 1: 先寫 approved 狀態與 direct bet 顯示測試**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx` 追加：

```tsx
it('shows approved commissions as withdrawable and renders the approved status label', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: buildReferralPayload({
        stats: {
          total: '0.250000 USDT',
          withdrawable: '0.080000 USDT',
          month: '0.250000 USDT',
          friends: 1,
        },
        commissions: [
          {
            id: 'comm-approved-1',
            referee: 'ApprovedReferee111111111111111111111111',
            betAmount: '5.000000',
            fee: '0.400000',
            commission: '0.080000',
            timestamp: '2026-05-16T08:00:00.000Z',
            status: 'approved',
          },
        ],
        referees: [
          {
            id: 'ref-approved-1',
            address: 'ApprovedReferee111111111111111111111111',
            joinDateValue: 0,
            totalVolumeValue: 0,
            earnedCommissionValue: 0,
          },
        ],
      }),
    }),
  });

  render(<ReferralPage />);

  await waitFor(() => {
    expect(screen.getByText('待打款')).toBeInTheDocument();
  });

  expect(screen.getAllByText('0.080000 USDT').length).toBeGreaterThan(0);
  expect(screen.getByText('投注金额: 5.000000 USDT')).toBeInTheDocument();
});
```

- [ ] **Step 2: 執行 referral page 測試確認先失敗**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "shows approved commissions as withdrawable and renders the approved status label" --testPathPatterns "src/app/\[locale\]/referral/page.test.tsx"
```

Expected:

```text
FAIL src/app/[locale]/referral/page.test.tsx
Unable to find an element with the text: 待打款
```

- [ ] **Step 3: 對齊 referral page 的三態篩選與顯示**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`：

1. 把 commission 型別改成三態。
2. 將 tab 改成 `all / pending / approved / settled`。
3. 用 i18n status key 顯示 badge。
4. 維持 direct bet amount 與 ledger fallback。

目標片段：

```tsx
status: 'pending' | 'approved' | 'settled';
```

```tsx
const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'settled'>('all');
```

```tsx
{(['all', 'pending', 'approved', 'settled'] as const).map((tab) => (
  <button key={tab} onClick={() => setActiveTab(tab)}>
    {t(`referral.tab.${tab}`)}
  </button>
))}
```

```tsx
<span
  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
    comm.status === 'settled'
      ? 'bg-success/15 text-success'
      : comm.status === 'approved'
      ? 'bg-primary-blue/15 text-primary-blue'
      : 'bg-neutral-700 text-neutral-300'
  }`}
>
  {t(`referral.status.${comm.status}`)}
</span>
```

- [ ] **Step 4: 補 i18n 文案**

在 `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts` 為各 locale 增加：

```ts
'referral.tab.approved': 'Approved',
'referral.status.pending': 'Pending Review',
'referral.status.approved': 'Ready To Pay',
'referral.status.settled': 'Settled',
```

`zh-TW` 對應：

```ts
'referral.tab.approved': '待打款',
'referral.status.pending': '待對帳',
'referral.status.approved': '待打款',
'referral.status.settled': '已結算',
```

`zh-CN` 對應：

```ts
'referral.tab.approved': '待打款',
'referral.status.pending': '待对账',
'referral.status.approved': '待打款',
'referral.status.settled': '已结算',
```

- [ ] **Step 5: 執行 referral page 與 i18n 測試**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\app\[locale]\referral\page.test.tsx __tests__\i18n-validation.test.ts
```

Expected:

```text
PASS src/app/[locale]/referral/page.test.tsx
PASS __tests__/i18n-validation.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/referral/page.tsx src/app/[locale]/referral/page.test.tsx src/lib/i18n.ts
git commit -m "feat: port referral page visibility from feature copy"
```

## Task 5: 全量回歸、診斷與手動驗證

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`

- [ ] **Step 1: 跑 focused regression**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\lib\referral-stats.test.ts src\components\ReferralHandler.test.tsx src\app\api\referral\route.test.ts src\app\api\cron\settle\route.test.ts src\app\page.test.tsx src\app\[locale]\page.test.tsx src\app\[locale]\referral\page.test.tsx __tests__\i18n-validation.test.ts
```

Expected:

```text
PASS src/lib/referral-stats.test.ts
PASS src/components/ReferralHandler.test.tsx
PASS src/app/api/referral/route.test.ts
PASS src/app/api/cron/settle/route.test.ts
PASS src/app/page.test.tsx
PASS src/app/[locale]/page.test.tsx
PASS src/app/[locale]/referral/page.test.tsx
PASS __tests__/i18n-validation.test.ts
```

- [ ] **Step 2: 檢查 IDE diagnostics**

對以下檔案執行 diagnostics：

```text
src/app/api/referral/route.ts
src/app/api/cron/settle/route.ts
src/app/page.tsx
src/app/[locale]/page.tsx
src/app/[locale]/referral/page.tsx
src/lib/i18n.ts
src/lib/referral-stats.ts
```

Expected:

```text
No new TypeScript, lint, or import errors introduced by this change set
```

- [ ] **Step 3: 手動驗證 referral 流程**

手動檢查：

```text
1. 綁定 referrer 後進行真實資金下注，/api/bets 成功前不會先顯示最終成功
2. /api/bets 失敗時，不會留下假成功 bet
3. 體驗金在 realTotalPool === 0 時仍不可首注
4. referral 頁可看到 pending / approved / settled 狀態
5. referral 頁能看到 direct bet 金額與佣金
6. 現有舊資料不需手動覆蓋即可正常顯示
```

- [ ] **Step 4: Commit 最終驗證結果**

```bash
git add src/app/api/referral/route.ts src/app/api/referral/route.test.ts src/app/api/cron/settle/route.ts src/app/api/cron/settle/route.test.ts src/app/page.tsx src/app/page.test.tsx src/app/[locale]/page.tsx src/app/[locale]/page.test.tsx src/app/[locale]/referral/page.tsx src/app/[locale]/referral/page.test.tsx src/lib/referral-stats.ts src/lib/referral-stats.test.ts src/lib/i18n.ts
git commit -m "feat: migrate referral workflow from feature copy"
```

## Self-Review

Spec coverage:

- 副本優先的 referral API 與三態資料模型：Task 1
- `reconcile_commissions`：Task 1
- approved-only settle cron：Task 2
- 首頁與多語首頁下注成功時序：Task 3
- 體驗金首注限制保持不退化：Task 3 regression
- referral 頁 direct bet 與三態可見性：Task 4
- 不覆蓋真實資料，只做執行期相容：Task 1 normalize 路徑

Placeholder scan:

- 無 `TODO`、`TBD`、`implement later`
- 每個 task 都有具體檔案、測試、命令與期望結果
- 沒有用「類似 Task N」來省略步驟

Type consistency:

- 狀態名稱全程固定為 `pending | approved | settled`
- `withdrawable` 全程定義為 `approved` 的和
- `approvedAt`、`settledAt`、`settlementTx` 命名一致
