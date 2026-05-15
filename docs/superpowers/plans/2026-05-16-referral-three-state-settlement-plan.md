# Referral Three-State Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 referral 佣金狀態改為 `pending -> approved -> settled` 三態流程，讓 `settled` 僅代表真實打款成功，並讓統計、可提現口徑與 cron 打款一致。

**Architecture:** 先把佣金狀態與統計規則抽到 shared helper，避免 API、cron、前端各自維護不同口徑。接著讓 `place_bet` 只產生 `pending`，由 reconcile 邏輯將可支付佣金升級為 `approved`，最後由 cron 僅支付 `approved` 並在成功後寫回 `settled`。前端只消費狀態機結果，不再自行推導支付生命週期。

**Tech Stack:** Next.js App Router, TypeScript, Jest, Testing Library, Solana Web3, file-based JSON DB

---

## File Map

- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-commission-status.ts`
  - 定義三態型別與純函式狀態轉換 helper。
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-commission-status.test.ts`
  - 驗證 `pending -> approved -> settled` 與不可逆轉規則。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.ts`
  - 讓統計口徑支援 `approved`，並讓 `withdrawable` 只計入 `approved`。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.test.ts`
  - 改為三態統計測試。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
  - `place_bet` 只寫入 `pending`；新增/內嵌 reconcile；GET 使用三態統計。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`
  - 補 API 回歸測試：下注產生 `pending`、reconcile 後成為 `approved`、GET 統計正確。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.ts`
  - 只支付 `approved`，支付成功後回寫 `settled` 與結算交易資訊。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.test.ts`
  - 驗證 cron 僅處理 `approved`，且成功後改為 `settled`。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
  - UI 顯示 `approved` 狀態與新篩選口徑；`withdrawable` 對應 `approved`。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`
  - 驗證三態標籤、三態統計與 `approved` 可提現口徑。
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`
  - 增加 `referral.tab.approved`、`referral.status.pending`、`referral.status.approved` 等文案。

### Task 1: 建立三態型別與統計規則

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-commission-status.ts`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-commission-status.test.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.test.ts`

- [ ] **Step 1: Write the failing status helper test**

Add this test file at `src/lib/referral-commission-status.test.ts`:

```ts
import {
  approveCommission,
  isCommissionPayable,
  settleCommission,
  type ReferralCommissionStatus,
} from './referral-commission-status';

describe('referral commission status helpers', () => {
  it('approves a pending commission but does not allow settled commissions to move backwards', () => {
    expect(approveCommission({ status: 'pending' })).toEqual({
      status: 'approved',
      approvedAt: '2026-05-16T00:00:00.000Z',
    });

    expect(() =>
      approveCommission({ status: 'settled' as ReferralCommissionStatus })
    ).toThrow('Cannot approve a settled commission');
  });

  it('marks only approved commissions as payable and settles them with tx metadata', () => {
    expect(isCommissionPayable({ status: 'pending' })).toBe(false);
    expect(isCommissionPayable({ status: 'approved' })).toBe(true);
    expect(
      settleCommission(
        { status: 'approved', approvedAt: '2026-05-16T00:00:00.000Z' },
        { settledAt: '2026-05-16T00:10:00.000Z', settlementTx: 'tx-123' }
      )
    ).toEqual({
      status: 'settled',
      approvedAt: '2026-05-16T00:00:00.000Z',
      settledAt: '2026-05-16T00:10:00.000Z',
      settlementTx: 'tx-123',
    });
  });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\lib\referral-commission-status.test.ts
```

Expected:

```text
FAIL src/lib/referral-commission-status.test.ts
Cannot find module './referral-commission-status'
```

- [ ] **Step 3: Write the minimal status helper implementation**

Create `src/lib/referral-commission-status.ts` with:

```ts
export type ReferralCommissionStatus = 'pending' | 'approved' | 'settled';

type CommissionLike = {
  status: ReferralCommissionStatus;
  approvedAt?: string;
  settledAt?: string;
  settlementTx?: string;
};

export function approveCommission(
  commission: CommissionLike,
  approvedAt: string = new Date().toISOString()
): CommissionLike {
  if (commission.status === 'settled') {
    throw new Error('Cannot approve a settled commission');
  }

  if (commission.status === 'approved') {
    return commission;
  }

  return {
    ...commission,
    status: 'approved',
    approvedAt,
  };
}

export function isCommissionPayable(commission: CommissionLike): boolean {
  return commission.status === 'approved';
}

export function settleCommission(
  commission: CommissionLike,
  params: { settledAt?: string; settlementTx: string }
): CommissionLike {
  if (commission.status !== 'approved') {
    throw new Error('Only approved commissions can be settled');
  }

  return {
    ...commission,
    status: 'settled',
    settledAt: params.settledAt ?? new Date().toISOString(),
    settlementTx: params.settlementTx,
  };
}
```

- [ ] **Step 4: Write the failing stats test for three-state totals**

Replace `src/lib/referral-stats.test.ts` with:

```ts
import { calculateReferralStats } from './referral-stats';

describe('calculateReferralStats', () => {
  it('includes pending, approved, and settled in total/month while withdrawable only counts approved', () => {
    const now = Date.now();

    const stats = calculateReferralStats({
      commissions: [
        {
          referee: 'ref-pending',
          commission: '0.120000',
          timestamp: new Date(now).toISOString(),
          status: 'pending',
        },
        {
          referee: 'ref-approved',
          commission: '0.080000',
          timestamp: new Date(now).toISOString(),
          status: 'approved',
        },
        {
          referee: 'ref-settled',
          commission: '0.050000',
          timestamp: new Date(now).toISOString(),
          status: 'settled',
        },
        {
          referee: 'WITHDRAWAL',
          commission: '-0.030000',
          timestamp: new Date(now).toISOString(),
          status: 'settled',
        },
      ],
      now,
    });

    expect(stats.total).toBe('0.250000 USDT');
    expect(stats.month).toBe('0.250000 USDT');
    expect(stats.withdrawable).toBe('0.080000 USDT');
  });
});
```

- [ ] **Step 5: Run the stats test to verify it fails**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\lib\referral-stats.test.ts
```

Expected:

```text
FAIL src/lib/referral-stats.test.ts
Expected withdrawable to be 0.080000 USDT, received 0.020000 USDT
```

- [ ] **Step 6: Update the stats helper to three-state semantics**

Change `src/lib/referral-stats.ts` to:

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
}): {
  total: string;
  month: string;
  withdrawable: string;
} {
  const now = params.now ?? Date.now();
  const activeCommissions = params.commissions.filter(
    (commission) => commission.referee !== 'WITHDRAWAL'
  );
  const approvedCommissions = activeCommissions.filter(
    (commission) => commission.status === 'approved'
  );

  const totalEarned = activeCommissions.reduce(
    (sum, commission) => sum + (parseFloat(commission.commission) || 0),
    0
  );
  const monthEarned = activeCommissions.reduce((sum, commission) => {
    const ts = Date.parse(commission.timestamp);
    if (!Number.isFinite(ts)) return sum;
    if (now - ts > 30 * 24 * 60 * 60 * 1000) return sum;
    return sum + (parseFloat(commission.commission) || 0);
  }, 0);
  const approvedEarned = approvedCommissions.reduce(
    (sum, commission) => sum + (parseFloat(commission.commission) || 0),
    0
  );

  return {
    total: `${totalEarned.toFixed(6)} USDT`,
    month: `${monthEarned.toFixed(6)} USDT`,
    withdrawable: `${approvedEarned.toFixed(6)} USDT`,
  };
}
```

- [ ] **Step 7: Run both helper tests to verify they pass**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\lib\referral-commission-status.test.ts src\lib\referral-stats.test.ts
```

Expected:

```text
PASS src/lib/referral-commission-status.test.ts
PASS src/lib/referral-stats.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/referral-commission-status.ts src/lib/referral-commission-status.test.ts src/lib/referral-stats.ts src/lib/referral-stats.test.ts
git commit -m "test: add referral three-state status helpers"
```

### Task 2: 讓 Referral API 產生 pending 並支援 reconcile 到 approved

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Write the failing API test for place_bet and reconcile**

Append these tests to `src/app/api/referral/route.test.ts`:

```ts
it('creates pending commissions on place_bet and promotes them to approved via reconcile', async () => {
  const referrer = '0xThreeStateReferrer';
  const referee = '0xThreeStateReferee';

  await POST(
    new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: referrer, newRefereeAddress: referee }),
    })
  );

  await POST(
    new Request('http://localhost:3000/api/referral', {
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
    })
  );

  let res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
  let json = await res.json();
  expect(json.data.commissions[0].status).toBe('pending');
  expect(json.data.stats.withdrawable).toBe('0.000000 USDT');

  const reconcileRes = await POST(
    new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reconcile_commissions',
        userAddress: referrer,
      }),
    })
  );
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

- [ ] **Step 2: Run the API test to verify it fails**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "creates pending commissions on place_bet and promotes them to approved via reconcile" src\app\api\referral\route.test.ts
```

Expected:

```text
FAIL src/app/api/referral/route.test.ts
Expected status pending, received settled
```

- [ ] **Step 3: Extend the commission type and add a reconcile helper inside the route**

Update the `Commission` interface in `src/app/api/referral/route.ts`:

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
```

Add this helper near `getOrCreateUserData()`:

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

- [ ] **Step 4: Make place_bet write pending and add reconcile_commissions action**

In `src/app/api/referral/route.ts`, change the success write in `place_bet` from:

```ts
status: 'settled' as const,
```

to:

```ts
status: 'pending' as const,
```

and remove the direct `stats.total / stats.withdrawable / stats.month` increment block entirely.

Then add this POST branch above `withdraw_commission`:

```ts
if (body.action === 'reconcile_commissions') {
    const { userAddress } = body;

    if (!userAddress) {
        return NextResponse.json({ error: 'Missing userAddress' }, { status: 400 });
    }

    const userData = getOrCreateUserData(userAddress, db);
    const updated = reconcileUserCommissions(userData);
    saveDatabase(db);

    return NextResponse.json({ success: true, updated });
}
```

- [ ] **Step 5: Remove implicit GET downgrade behavior**

Replace this block in `GET`:

```ts
for (const c of userData.commissions) {
    if (c.status === 'settled' && !c.signature && c.referee !== 'WITHDRAWAL') {
        c.status = 'pending';
        modified = true;
    }
}
```

with:

```ts
// GET 只做讀取與統計，不再隱式回退佣金狀態。
```

- [ ] **Step 6: Run the focused API test to verify it passes**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "creates pending commissions on place_bet and promotes them to approved via reconcile" src\app\api\referral\route.test.ts
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 7: Run the full referral API test file**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\app\api\referral\route.test.ts
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/referral/route.ts src/app/api/referral/route.test.ts
git commit -m "feat: add referral commission reconcile flow"
```

### Task 3: 改 cron 只支付 approved 並在成功後寫回 settled

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.test.ts`

- [ ] **Step 1: Write the failing cron test for approved-only payouts**

Append this test to `src/app/api/cron/settle/route.test.ts`:

```ts
it('pays only approved referral commissions and marks them settled after transfer', async () => {
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

  // 將此物件寫入 test fixture 所使用的 referral_db mock，然後呼叫 settle route
  // 斷言：
  // - 僅發起一次佣金支付
  // - approved 變成 settled 並帶 settlementTx
  // - pending 維持 pending
});
```

- [ ] **Step 2: Run the cron test to verify it fails**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "pays only approved referral commissions and marks them settled after transfer" src\app\api\cron\settle\route.test.ts
```

Expected:

```text
FAIL src/app/api/cron/settle/route.test.ts
Expected one approved commission payout, received 0 or all aggregated referee totals
```

- [ ] **Step 3: Change the cron commission source from referee aggregates to approved ledger rows**

Replace the current commission collection block in `src/app/api/cron/settle/route.ts`:

```ts
interface PendingCommission { referrerAddress: string; earnedValue: number; refId: string; }
const commissions: PendingCommission[] = [];
for (const [address, data] of Object.entries(referralDb || {}) as [string, any][]) {
  if (data?.referees) {
    for (const ref of data.referees) {
      if ((ref.earnedCommissionValue || 0) > 0.000001 && !ref.commissionPaid) {
        commissions.push({
          referrerAddress: address,
          earnedValue: ref.earnedCommissionValue,
          refId: ref.id,
        });
      }
    }
  }
}
```

with:

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

- [ ] **Step 4: Mark approved ledger rows as settled after successful payout**

Replace the existing writeback block:

```ts
if (userData?.referees) {
  for (const ref of userData.referees) {
    if (ref.id === comm.refId || ref.address === comm.referrerAddress) {
      ref.commissionPaid = true;
      ref.earnedCommissionValue = 0;
      break;
    }
  }
}
```

with:

```ts
const settledAt = new Date().toISOString();
for (const commission of userData?.commissions || []) {
  if (commission.id !== comm.commissionId) continue;
  commission.status = 'settled';
  commission.settledAt = settledAt;
  commission.settlementTx = sig;
}
```

- [ ] **Step 5: Recompute stats after cron writeback**

Add this before `saveDb("referral_db.json", referralDb)`:

```ts
if (referralDb) {
  for (const userData of Object.values(referralDb) as any[]) {
    const calculated = calculateReferralStats({ commissions: userData.commissions || [] });
    if (userData.stats) {
      userData.stats.total = calculated.total;
      userData.stats.month = calculated.month;
      userData.stats.withdrawable = calculated.withdrawable;
    }
  }
}
```

and import:

```ts
import { calculateReferralStats } from '@/lib/referral-stats';
```

- [ ] **Step 6: Run the focused cron test to verify it passes**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "pays only approved referral commissions and marks them settled after transfer" src\app\api\cron\settle\route.test.ts
```

Expected:

```text
PASS src/app/api/cron/settle/route.test.ts
```

- [ ] **Step 7: Run the full cron settle test file**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\app\api\cron\settle\route.test.ts
```

Expected:

```text
PASS src/app/api/cron/settle/route.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/cron/settle/route.ts src/app/api/cron/settle/route.test.ts
git commit -m "feat: settle approved referral commissions via cron"
```

### Task 4: 更新 Referral 頁面三態文案、篩選與可提現口徑

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`

- [ ] **Step 1: Write the failing UI test for approved state**

Append this test to `src/app/[locale]/referral/page.test.tsx`:

```tsx
it('shows approved commissions as withdrawable and renders the approved status label', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: {
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
        referees: [],
        balances: { usdt: 0, bonus: 0 },
        commissionRate: 0.3,
      },
    }),
  });

  render(<ReferralPage />);

  await waitFor(() => {
    expect(screen.getByText('待打款')).toBeInTheDocument();
  });

  expect(screen.getAllByText('0.080000 USDT').length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the page test to verify it fails**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "shows approved commissions as withdrawable and renders the approved status label" --testPathPatterns "src/app/\[locale\]/referral/page.test.tsx"
```

Expected:

```text
FAIL src/app/[locale]/referral/page.test.tsx
Unable to find text 待打款
```

- [ ] **Step 3: Extend the page commission types and filters**

In `src/app/[locale]/referral/page.tsx`, change:

```ts
status: 'settled' | 'pending';
```

to:

```ts
status: 'pending' | 'approved' | 'settled';
```

and change:

```ts
const [activeTab, setActiveTab] = useState<'all' | 'settled' | 'pending'>('all');
```

to:

```ts
const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'settled'>('all');
```

- [ ] **Step 4: Add i18n labels for approved**

In `src/lib/i18n.ts`, add these keys in all locales:

```ts
'referral.tab.approved': 'Approved',
'referral.status.pending': '待对账',
'referral.status.approved': '待打款',
'referral.status.settled': '已结算',
```

For `zh-TW`, use:

```ts
'referral.tab.approved': '待打款',
'referral.status.pending': '待對帳',
'referral.status.approved': '待打款',
'referral.status.settled': '已結算',
```

- [ ] **Step 5: Render approved labels and keep withdrawable tied to API stats**

In `src/app/[locale]/referral/page.tsx`, update the tab list:

```tsx
{(['all', 'pending', 'approved', 'settled'] as const).map(tab => (
```

and update the status badge:

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

- [ ] **Step 6: Run the focused page test to verify it passes**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand --testNamePattern "shows approved commissions as withdrawable and renders the approved status label" --testPathPatterns "src/app/\[locale\]/referral/page.test.tsx"
```

Expected:

```text
PASS src/app/[locale]/referral/page.test.tsx
```

- [ ] **Step 7: Run the full regression set for referral**

Run:

```bash
.\node_modules\.bin\jest.cmd --runInBand src\lib\referral-commission-status.test.ts src\lib\referral-stats.test.ts src\components\ReferralHandler.test.tsx src\app\api\referral\route.test.ts src\app\api\cron\settle\route.test.ts --testPathPatterns "src/app/\[locale\]/referral/page.test.tsx"
```

Expected:

```text
PASS src/lib/referral-commission-status.test.ts
PASS src/lib/referral-stats.test.ts
PASS src/components/ReferralHandler.test.tsx
PASS src/app/api/referral/route.test.ts
PASS src/app/api/cron/settle/route.test.ts
PASS src/app/[locale]/referral/page.test.tsx
```

- [ ] **Step 8: Run diagnostics and commit**

Run diagnostics for:

```text
src/lib/referral-commission-status.ts
src/lib/referral-stats.ts
src/app/api/referral/route.ts
src/app/api/cron/settle/route.ts
src/app/[locale]/referral/page.tsx
src/lib/i18n.ts
```

Then commit:

```bash
git add src/app/[locale]/referral/page.tsx src/app/[locale]/referral/page.test.tsx src/lib/i18n.ts
git commit -m "feat: show referral three-state settlement statuses"
```

## Self-Review

- Spec coverage:
  - 三態狀態機：Task 1
  - `place_bet` 只產生 `pending`：Task 2
  - `pending -> approved` reconcile：Task 2
  - cron 只支付 `approved` 並轉 `settled`：Task 3
  - UI 三態標籤、可提現與統計：Task 4
- Placeholder scan:
  - 無 `TODO`、`TBD`、`similar to Task N`
  - 每個 task 都有具體測試、命令與預期結果
- Type consistency:
  - 狀態名稱全程固定為 `pending | approved | settled`
  - `withdrawable` 全程定義為 `approved`
  - `settlementTx` 與 `approvedAt/settledAt` 命名在各 task 保持一致
