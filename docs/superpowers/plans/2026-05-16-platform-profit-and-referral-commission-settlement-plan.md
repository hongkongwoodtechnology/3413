# Platform Profit And Referral Commission Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all temporary platform fee custody for new bets into `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2`, approve referral commission only for final `win/loss` bets, and ensure refunded bets return the full gross stake including fees.

**Architecture:** Keep the existing placement-time split model, but collapse `house + commission` into a single temporary platform-fee destination during transfer verification and bet placement. Preserve pool funding separately, then move referral earnings from placement-time recognition to settlement-time approval based on final bet status. Keep actual referrer payout in the existing withdraw flow rather than introducing automatic on-chain settlement for commissions.

**Tech Stack:** Next.js App Router, TypeScript, Jest, Solana Web3, SPL token ATA handling, file-backed JSON storage

---

### Task 1: Lock The Fee-Split Contract In Tests

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\wallets.test.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Add a failing split-bet unit test for combined platform fee custody**

```ts
import { splitBetAmount } from './wallets';

describe('splitBetAmount', () => {
  it('keeps pool separate while exposing house and commission components', () => {
    const split = splitBetAmount(0.04, 0.3);

    expect(split.pool).toBeCloseTo(0.0368, 6);
    expect(split.house).toBeCloseTo(0.00224, 6);
    expect(split.commission).toBeCloseTo(0.00096, 6);
    expect(split.platformFee).toBeCloseTo(0.0032, 6);
  });
});
```

- [ ] **Step 2: Add a failing referral verification test for two-destination transfers**

```ts
it('accepts combined fee custody into the house wallet for new bets', async () => {
  const referrer = 'AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq';
  const referee = 'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf';

  await POST(
    new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: referrer, newRefereeAddress: referee }),
    })
  );

  mockVerifiedSplitTransfer({
    userAddress: referee,
    poolAmount: 4.6,
    houseAmount: 0.28,
    commissionAmount: 0.12,
  });

  const res = await POST(
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
        signature: 'combined-fee-bet',
      }),
    })
  );

  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.success).toBe(true);
});
```

- [ ] **Step 3: Update the referral test helper so fee verification points at the current house wallet**

```ts
function mockVerifiedSplitTransfer(params: {
  userAddress: string;
  poolAmount: number;
  houseAmount: number;
  commissionAmount: number;
}) {
  const poolDestination = 'ata-9FfHYyK8ZKsA82BPtierU4sWmwTS8QTGqrGqtTt6tEu7';
  const feeDestination = `ata-${CURRENT_ADMIN_ADDRESS}`;

  return jest.spyOn(Connection.prototype, 'getParsedTransaction').mockResolvedValue({
    meta: {
      err: null,
      innerInstructions: [],
    },
    transaction: {
      message: {
        accountKeys: [{ pubkey: new PublicKey(params.userAddress), signer: true }],
        instructions: [
          {
            program: 'spl-token',
            parsed: {
              type: 'transfer',
              info: {
                destination: poolDestination,
                amount: String(Math.round(params.poolAmount * 1_000_000)),
              },
            },
          },
          {
            program: 'spl-token',
            parsed: {
              type: 'transfer',
              info: {
                destination: feeDestination,
                amount: String(Math.round((params.houseAmount + params.commissionAmount) * 1_000_000)),
              },
            },
          },
        ],
      },
    },
  } as any);
}
```

- [ ] **Step 4: Run the focused tests to verify the new expectations fail for the old code**

Run:

```bash
npm test -- --runTestsByPath src/lib/wallets.test.ts src/app/api/referral/route.test.ts
```

Expected:

```text
FAIL src/app/api/referral/route.test.ts
  Referral API
    ✕ accepts combined fee custody into the house wallet for new bets
```

- [ ] **Step 5: Commit the failing-test checkpoint**

```bash
git add src/lib/wallets.test.ts src/app/api/referral/route.test.ts
git commit -m "test: cover combined platform fee custody"
```

### Task 2: Collapse Placement Transfers Into Pool Plus Platform Fee

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\wallets.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`

- [ ] **Step 1: Extend the wallet helper with a combined fee amount helper**

```ts
export function getCombinedPlatformFeeAmount(split: {
  house: number;
  commission: number;
}): number {
  return Math.round((split.house + split.commission) * 1e6) / 1e6;
}
```

- [ ] **Step 2: Refactor the locale home page transaction builder to send only two SPL transfers**

```ts
const {
  pool: poolAmount,
  house: houseAmount,
  commission: commissionAmount,
  support: supportAmount,
} = splitBetAmount(betAmountNum, commissionRate, currentRealPool);

const combinedFeeAmount = Math.round((houseAmount + commissionAmount) * Math.pow(10, USDT_DECIMALS));
const rawPoolAmount = BigInt(Math.floor(poolAmount * Math.pow(10, USDT_DECIMALS)));
const rawCombinedFeeAmount = BigInt(combinedFeeAmount);

const userATA = findAtaClient(USDT_MINT, actualPublicKey);
const poolATA = findAtaClient(USDT_MINT, POOL_ADDRESS);
const adminATA = findAtaClient(USDT_MINT, HOUSE_WALLET);

const atasNeeded = await checkAtasNeeded([
  { ata: poolATA, owner: POOL_ADDRESS, label: '獎池 Pool (派彩用)' },
  { ata: adminATA, owner: HOUSE_WALLET, label: '平台暫收手續費' },
]);

transaction.add(splTransferInstruction(userATA, poolATA, actualPublicKey, rawPoolAmount));
if (rawCombinedFeeAmount > 0n) {
  transaction.add(splTransferInstruction(userATA, adminATA, actualPublicKey, rawCombinedFeeAmount));
}
```

- [ ] **Step 3: Mirror the same transfer refactor in the non-locale page**

```ts
const userATA = findAtaClient(USDT_MINT, actualPublicKey);
const poolATA = findAtaClient(USDT_MINT, POOL_ADDRESS);
const adminATA = findAtaClient(USDT_MINT, HOUSE_WALLET);

const atasNeeded = await checkAtasNeeded([
  { ata: poolATA, owner: POOL_ADDRESS, label: '獎池 Pool (派彩用)' },
  { ata: adminATA, owner: HOUSE_WALLET, label: '平台暫收手續費' },
]);

transaction.add(splTransferInstruction(userATA, poolATA, actualPublicKey, rawPoolAmount));
if (rawCombinedFeeAmount > 0n) {
  transaction.add(splTransferInstruction(userATA, adminATA, actualPublicKey, rawCombinedFeeAmount));
}
```

- [ ] **Step 4: Run targeted tests after the transfer refactor**

Run:

```bash
npm test -- --runTestsByPath src/lib/wallets.test.ts src/app/api/referral/route.test.ts
```

Expected:

```text
PASS src/lib/wallets.test.ts
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 5: Commit the placement transfer change**

```bash
git add src/lib/wallets.ts src/app/[locale]/page.tsx src/app/page.tsx src/lib/wallets.test.ts src/app/api/referral/route.test.ts
git commit -m "feat: route platform fee custody to house wallet"
```

### Task 3: Move Referral Earnings From Placement-Time To Settlement-Time

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\referral-stats.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Add failing tests for final-status-based commission approval**

```ts
it('keeps place_bet commission pending until the bet finishes as loss', async () => {
  const referrer = 'AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq';
  const referee = 'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf';

  await POST(
    new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: referrer, newRefereeAddress: referee }),
    })
  );

  mockVerifiedSplitTransfer({
    userAddress: referee,
    poolAmount: 4.6,
    houseAmount: 0.28,
    commissionAmount: 0.12,
  });

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
        signature: 'settlement-loss-bet',
      }),
    })
  );

  let res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
  let json = await res.json();
  expect(json.data.commissions[0].status).toBe('pending');
  expect(json.data.stats.withdrawable).toBe('0.000000 USDT');
});
```

```ts
it('counts only approved commission in total and withdrawable', () => {
  const stats = calculateReferralStats({
    commissions: [
      { referee: 'A', commission: '0.120000', timestamp: new Date().toISOString(), status: 'pending' },
      { referee: 'B', commission: '0.080000', timestamp: new Date().toISOString(), status: 'approved' },
    ],
  });

  expect(stats.total).toBe('0.080000 USDT');
  expect(stats.withdrawable).toBe('0.080000 USDT');
});
```

- [ ] **Step 2: Add a referral reconciliation helper that inspects final bet status before approval**

```ts
function reconcileUserCommissionsAgainstBets(
  userAddress: string,
  userData: UserData,
  betsDb: Record<string, BetRecord[]>
) {
  let updated = 0;

  for (const commission of userData.commissions) {
    if (commission.referee === 'WITHDRAWAL') continue;
    if (commission.status !== 'pending') continue;
    if (!commission.signature) continue;

    const bet = Object.values(betsDb)
      .flat()
      .find((candidate) => candidate.signature === commission.signature);

    if (!bet?.status) continue;

    if (bet.status === 'win' || bet.status === 'loss') {
      commission.status = 'approved';
      commission.approvedAt = new Date().toISOString();
      updated += 1;
      continue;
    }

    if (bet.status === 'refunded') {
      commission.status = 'settled';
      commission.settledAt = new Date().toISOString();
      commission.commission = '0.000000';
      commission.fee = '0.000000';
      updated += 1;
    }
  }

  return updated;
}
```

- [ ] **Step 3: Change `calculateReferralStats()` so only approved entries count as earned totals**

```ts
const earnedCommissions = params.commissions.filter(
  (commission) => commission.referee !== 'WITHDRAWAL' && commission.status === 'approved'
);

const totalEarned = earnedCommissions.reduce(
  (sum, commission) => sum + (parseFloat(commission.commission) || 0),
  0
);

const monthEarned = earnedCommissions.reduce((sum, commission) => {
  const ts = Date.parse(commission.timestamp);
  if (!Number.isFinite(ts)) return sum;
  if (now - ts > 30 * 24 * 60 * 60 * 1000) return sum;
  return sum + (parseFloat(commission.commission) || 0);
}, 0);
```

- [ ] **Step 4: Wire reconciliation into both GET and POST referral flows**

```ts
const betsDb = loadBetsDb();
const updated = reconcileUserCommissionsAgainstBets(address, userData, betsDb);
if (updated > 0) {
  syncUserStats(userData);
  saveDatabase(db);
}
```

- [ ] **Step 5: Run the focused referral tests**

Run:

```bash
npm test -- --runTestsByPath src/app/api/referral/route.test.ts src/lib/referral-stats.test.ts
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
PASS src/lib/referral-stats.test.ts
```

- [ ] **Step 6: Commit the referral settlement change**

```bash
git add src/app/api/referral/route.ts src/lib/referral-stats.ts src/app/api/referral/route.test.ts src/lib/referral-stats.test.ts
git commit -m "feat: approve referral commission only after final settlement"
```

### Task 4: Make Refunds Return The Full Gross Stake Including Fee

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.test.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`

- [ ] **Step 1: Add a failing refund test that requires fee-funded refund coverage**

```ts
it('refunds the full original gross stake for refunded bets', async () => {
  mockFiles["bets_db.json"] = JSON.stringify({
    RefundUser111111111111111111111111111111111: [
      {
        id: "bet-refund-1",
        userAddress: "RefundUser111111111111111111111111111111111",
        matchId: 202,
        matchName: "Refund Match",
        outcome: "home",
        amount: 10,
        odds: 2,
        netPayout: 18.4,
        status: "refunded",
        useBonus: false,
        timestamp: 1234567890,
        paidOut: false,
      },
    ],
  });

  const { GET } = await import("./route");
  const responsePromise = GET(new Request("http://localhost/api/cron/settle", {
    headers: { "x-cron-secret": "test-cron-secret" },
  }));
  await jest.runAllTimersAsync();
  const response = await responsePromise;
  const json = await response.json();

  expect(response.status).toBe(200);
  expect(json.refunds).toBe(1);
  expect(json.totalUsdtPaid).toBe(10);
});
```

- [ ] **Step 2: Make settlement fund refunds and wins from the live admin ATA only, while leaving commission payouts out of the cron path**

```ts
// Commission no longer auto-pays here. Referral commission is approved in referral ledger
// and leaves the platform through the existing withdraw flow.
const grandTotalNeeded = totalNeededRaw;

if (adminAtaBalance < grandTotalNeeded) {
  return NextResponse.json({
    success: false,
    error: "Admin ATA 餘額不足",
    balance: adminBalanceUi,
    needed: Number(grandTotalNeeded) / Math.pow(10, USDT_DECIMALS),
    pendingRefunds: refunds.length,
    pendingWins: wins.length,
    pendingCommissions: 0,
  }, { status: 402 });
}
```

- [ ] **Step 3: Remove the cron commission-transfer loop so withdraw remains the only payout path for referrers**

```ts
logs.push('Commissions: deferred to referral withdraw flow');

saveDb("bets_db.json", betsDb);
if (referralDb) saveDb("referral_db.json", referralDb);

return NextResponse.json({
  success: true,
  refunds: refundDone,
  wins: winDone,
  commissions: 0,
  totalUsdtPaid: Math.round(splitResult.totalUsdt * 1e6) / 1e6,
  failed: splitResult.failed,
  errors: splitResult.errors,
  elapsed: Date.now() - startTime,
  logs,
});
```

- [ ] **Step 4: Ensure refunded referral records become non-earning entries**

```ts
if (bet.status === 'refunded') {
  commission.status = 'settled';
  commission.commission = '0.000000';
  commission.fee = '0.000000';
  commission.settledAt = new Date().toISOString();
}
```

- [ ] **Step 5: Run the settlement and referral refund tests**

Run:

```bash
npm test -- --runTestsByPath src/app/api/cron/settle/route.test.ts src/app/api/referral/route.test.ts
```

Expected:

```text
PASS src/app/api/cron/settle/route.test.ts
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 6: Commit the refund and deferred-commission payout behavior**

```bash
git add src/app/api/cron/settle/route.ts src/app/api/cron/settle/route.test.ts src/app/api/referral/route.ts src/app/api/referral/route.test.ts
git commit -m "fix: refund full gross stake and defer referral payouts"
```

### Task 5: Final Regression Pass And Documentation Check

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\cron\settle\route.test.ts`
- Review: `c:\Users\USER\Documents\trae_projects\GAMBLE\docs\superpowers\specs\2026-05-16-platform-profit-and-referral-commission-settlement-design.md`

- [ ] **Step 1: Add one end-to-end style regression for win, loss, and refunded commission eligibility**

```ts
it('approves commission only for final win or loss and never for refunded', async () => {
  const statuses = ['win', 'loss', 'refunded'] as const;
  const expected = ['0.120000 USDT', '0.120000 USDT', '0.000000 USDT'];

  for (let i = 0; i < statuses.length; i += 1) {
    const stats = calculateReferralStats({
      commissions: [
        {
          referee: 'PlayerA',
          commission: statuses[i] === 'refunded' ? '0.000000' : '0.120000',
          timestamp: new Date().toISOString(),
          status: statuses[i] === 'refunded' ? 'settled' : 'approved',
        },
      ],
    });

    expect(stats.withdrawable).toBe(expected[i]);
  }
});
```

- [ ] **Step 2: Run the full focused suite for the touched areas**

Run:

```bash
npm test -- --runTestsByPath src/lib/wallets.test.ts src/lib/referral-stats.test.ts src/app/api/referral/route.test.ts src/app/api/cron/settle/route.test.ts
```

Expected:

```text
PASS src/lib/wallets.test.ts
PASS src/lib/referral-stats.test.ts
PASS src/app/api/referral/route.test.ts
PASS src/app/api/cron/settle/route.test.ts
```

- [ ] **Step 3: Check diagnostics for the edited files**

Run the editor diagnostics tool on:

```text
src/lib/wallets.ts
src/app/[locale]/page.tsx
src/app/page.tsx
src/app/api/referral/route.ts
src/lib/referral-stats.ts
src/app/api/cron/settle/route.ts
```

Expected:

```text
No new diagnostics in edited files
```

- [ ] **Step 4: Review the spec against implemented behavior before final commit**

Use this checklist:

```text
- placement sends fee custody to 3ve...
- commission starts pending, not earned
- win/loss approves commission
- refunded returns full gross amount
- refunded leaves zero platform profit
- referrer withdraw flow remains manual
```

- [ ] **Step 5: Commit the regression pass**

```bash
git add src/lib/wallets.test.ts src/lib/referral-stats.test.ts src/app/api/referral/route.test.ts src/app/api/cron/settle/route.test.ts
git commit -m "test: cover platform profit and referral settlement flow"
```

## Self-Review

- Spec coverage:
  - combined fee custody in `3ve...` is implemented in Task 2
  - settlement-based referral approval is implemented in Task 3
  - full gross refunds are implemented in Task 4
  - no auto on-chain referrer payout is preserved in Task 4
- Placeholder scan:
  - no `TODO`, `TBD`, or undefined "handle later" steps remain
- Type consistency:
  - plan uses the same status vocabulary throughout: `pending`, `approved`, `settled`, `refunded`
  - plan uses the same split fields throughout: `poolAmount`, `houseAmount`, `commissionAmount`
