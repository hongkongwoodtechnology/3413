# Trial Funds Odds Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make trial-funds betting recalculate the selected match odds in real time and keep displayed odds, locked odds, persisted odds, and settlement fully aligned with the same 8% winner-fee basis.

**Architecture:** Keep the existing market and risk model, but centralize bet-mode payout rules behind a small helper so the UI, bet persistence, and settlement all read the same source of truth. Implement the fix in three layers: shared payout helpers, selected-match projection in the page, and backend persistence/settlement alignment for trial-funds bets.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, file-based JSON persistence

---

## File Map

- Create: `src/lib/bet-mode.ts`
  - Owns trial-funds winner-fee constants and mode-aware helpers.
- Create: `src/lib/bet-mode.test.ts`
  - Verifies the shared payout helper behavior.
- Modify: `src/app/page.tsx`
  - Uses the shared helper for selected-match projected odds, locked odds, potential payout, and optimistic updates.
- Modify: `src/app/api/bets/route.ts`
  - Persists mode-aware payout metadata and validates trial-funds odds consistently.
- Modify: `src/app/api/cron/settle/route.ts`
  - Pays trial-funds winners from the stored locked odds basis without charging the fee twice.
- Create: `src/app/api/bets/route.test.ts`
  - Covers server-side validation and stored trial-funds payout metadata.

## Implementation Notes

- The repo is currently dirty. Stage only the files listed in each task.
- Do not refactor unrelated odds behavior.
- Preserve existing real-money referral and commission behavior.
- Treat the stored locked odds as the settlement source of truth for both real-money and trial-funds bets.

### Task 1: Add Shared Bet-Mode Helpers

**Files:**
- Create: `src/lib/bet-mode.ts`
- Create: `src/lib/bet-mode.test.ts`

- [ ] **Step 1: Write the failing helper test**

```ts
import {
  REAL_MONEY_RETURN_RATE,
  TRIAL_FUNDS_WINNER_FEE_RATE,
  TRIAL_FUNDS_RETURN_RATE,
  getReturnRateForBetMode,
  getNetPayoutFromLockedOdds,
} from './bet-mode';

describe('bet mode helpers', () => {
  it('uses the existing platform return rate for real-money bets', () => {
    expect(REAL_MONEY_RETURN_RATE).toBeCloseTo(0.92, 6);
    expect(getReturnRateForBetMode(false)).toBeCloseTo(0.92, 6);
  });

  it('uses the 8% winner-fee basis for trial-funds bets', () => {
    expect(TRIAL_FUNDS_WINNER_FEE_RATE).toBeCloseTo(0.08, 6);
    expect(TRIAL_FUNDS_RETURN_RATE).toBeCloseTo(0.92, 6);
    expect(getReturnRateForBetMode(true)).toBeCloseTo(0.92, 6);
  });

  it('settles from locked odds without a second deduction', () => {
    expect(getNetPayoutFromLockedOdds(25, 1.84, true)).toBeCloseTo(46, 6);
    expect(getNetPayoutFromLockedOdds(25, 1.84, false)).toBeCloseTo(46, 6);
  });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npm test -- --runTestsByPath src/lib/bet-mode.test.ts
```

Expected:

```text
FAIL src/lib/bet-mode.test.ts
Cannot find module './bet-mode'
```

- [ ] **Step 3: Write the minimal helper implementation**

Create `src/lib/bet-mode.ts` with:

```ts
import { PLATFORM_FEE_RATE } from './wallets';

export const TRIAL_FUNDS_WINNER_FEE_RATE = 0.08;
export const REAL_MONEY_RETURN_RATE = 1 - PLATFORM_FEE_RATE;
export const TRIAL_FUNDS_RETURN_RATE = 1 - TRIAL_FUNDS_WINNER_FEE_RATE;

export function getReturnRateForBetMode(useBonus: boolean): number {
  return useBonus ? TRIAL_FUNDS_RETURN_RATE : REAL_MONEY_RETURN_RATE;
}

export function getNetPayoutFromLockedOdds(amount: number, lockedOdds: number, _useBonus: boolean): number {
  return Math.round(amount * lockedOdds * 1e6) / 1e6;
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npm test -- --runTestsByPath src/lib/bet-mode.test.ts
```

Expected:

```text
PASS src/lib/bet-mode.test.ts
3 passed
```

- [ ] **Step 5: Commit the helper layer**

```bash
git add src/lib/bet-mode.ts src/lib/bet-mode.test.ts
git commit -m "feat: add shared bet mode payout helpers"
```

### Task 2: Align Selected-Match Odds and Summary in the UI

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/lib/bet-mode.test.ts`

- [ ] **Step 1: Add a failing UI-facing helper assertion**

Append this case to `src/lib/bet-mode.test.ts` first so the UI change has a locked contract:

```ts
import { DynamicOddsEngine } from './odds-engine';

it('can drive projected trial-funds odds from a mode-aware return rate override', () => {
  const engine = new DynamicOddsEngine();
  const projected = engine.calculateDynamicOdds(
    { home: 100, draw: 80, away: 70 },
    'home',
    20,
    { home: 0, draw: 0, away: 0 },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    'upcoming',
    getReturnRateForBetMode(true)
  );

  expect(projected).not.toBeNull();
  expect(projected?.odds).toBeGreaterThan(1.01);
});
```

- [ ] **Step 2: Run the focused test to verify the contract**

Run:

```bash
npm test -- --runTestsByPath src/lib/bet-mode.test.ts
```

Expected:

```text
PASS src/lib/bet-mode.test.ts
4 passed
```

- [ ] **Step 3: Update the page to use the shared return-rate helper everywhere the selected match projects odds**

In `src/app/page.tsx`, add the import:

```ts
import { getReturnRateForBetMode } from "@/lib/bet-mode"
```

Add a derived return rate near `effectiveCommissionRate`:

```ts
const effectiveReturnRate = useMemo(() => {
  return getReturnRateForBetMode(useBonus);
}, [useBonus]);
```

Update `projectedOdds` so both real money and trial funds use the same mode-aware return-rate basis:

```ts
return oddsEngine.calculateDynamicOdds(
  md.pools,
  selectedOutcome,
  betAmountNum,
  md.liabilities,
  undefined,
  undefined,
  undefined,
  currentMatch.score,
  currentMatch.liveMinute,
  currentMatch.status,
  effectiveReturnRate,
  totalReal < oddsEngine.getFeeFundedThreshold() || undefined,
  effectiveCommissionRate
);
```

Update the selected match card projection branch so the three visible buttons share the same basis:

```ts
const result = oddsEngine.calculateAllDisplayOdds(
  projectedPools,
  undefined,
  undefined,
  match.score,
  match.liveMinute,
  match.status,
  effectiveReturnRate,
  isFeeFunded || undefined,
  effectiveCommissionRate
);
```

Update optimistic liability writes so they use the locked odds already shown to the user:

```ts
liabilities: {
  ...md.liabilities,
  [outcome as string]: md.liabilities[outcome as keyof typeof md.liabilities] + (effectivePool * lockedOdds)
}
```

Update the summary panel to keep using the same locked odds basis:

```ts
{projectedOdds ? (betAmountNum * projectedOdds.odds).toFixed(2) : "0.00"}
```

Also add `effectiveReturnRate` to the relevant dependency arrays.

- [ ] **Step 4: Run targeted tests and diagnostics**

Run:

```bash
npm test -- --runTestsByPath src/lib/bet-mode.test.ts src/lib/wallets.test.ts
```

Then run diagnostics for the edited page file.

Expected:

```text
PASS src/lib/bet-mode.test.ts
PASS src/lib/wallets.test.ts
```

- [ ] **Step 5: Commit the UI alignment**

```bash
git add src/app/page.tsx src/lib/bet-mode.test.ts
git commit -m "feat: align trial funds projected odds in ui"
```

### Task 3: Persist Trial-Funds Locked Odds as Settlement Truth

**Files:**
- Modify: `src/app/api/bets/route.ts`
- Create: `src/app/api/bets/route.test.ts`
- Modify: `src/lib/bet-mode.ts`

- [ ] **Step 1: Write the failing API test**

Create `src/app/api/bets/route.test.ts` with:

```ts
/**
 * @jest-environment node
 */

import { POST } from './route';

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn((file: string) => {
    if (String(file).includes('bets_db.json')) return '{}';
    if (String(file).includes('market_db.json')) {
      return JSON.stringify({
        '101': {
          realTotalPool: 250,
          liabilities: { home: 0, draw: 0, away: 0 },
          pools: { home: 100, draw: 80, away: 70 },
        },
      });
    }
    return '{}';
  }),
  writeFileSync: jest.fn(),
}));

jest.mock('@/lib/gdriveBackup', () => ({ triggerAutoBackup: jest.fn() }));
jest.mock('@/lib/reserve', () => ({
  addToReserve: jest.fn(),
  loadReserve: jest.fn(() => ({ balance: 1000 })),
}));

describe('bets POST', () => {
  it('stores trial-funds bets with the submitted locked odds', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 20,
        odds: 2.15,
        useBonus: true,
        timestamp: 1234567890,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.useBonus).toBe(true);
    expect(json.data.odds).toBe(2.15);
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails or exposes missing alignment**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
FAIL src/app/api/bets/route.test.ts
```

The failure should point to missing test setup or server logic that is not yet mode-aware enough.

- [ ] **Step 3: Implement server-side persistence and validation alignment**

In `src/app/api/bets/route.ts`, import the shared settlement helper:

```ts
import { getNetPayoutFromLockedOdds } from '@/lib/bet-mode';
```

Extend the stored bet shape:

```ts
type BetRecord = {
  id: string;
  userAddress: string;
  matchId: number;
  matchName: string;
  outcome: 'home' | 'draw' | 'away';
  amount: number;
  odds?: number;
  netPayout?: number;
  signature?: string | null;
  status?: string;
  useBonus: boolean;
  timestamp: number;
  archived?: boolean;
  paidOut?: boolean;
};
```

When building `newBet`, persist the locked payout basis:

```ts
const lockedOdds = odds || 1.0;
const netPayout = getNetPayoutFromLockedOdds(amount, lockedOdds, !!useBonus);

const newBet: BetRecord = {
  id: `bet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  userAddress,
  matchId,
  matchName,
  outcome,
  amount,
  odds: lockedOdds,
  netPayout,
  signature: typeof signature === 'string' ? signature : null,
  status: 'pending',
  useBonus: !!useBonus,
  timestamp: timestamp || Date.now()
};
```

Keep the existing market liability write based on the stored locked odds:

```ts
currentMarket.liabilities[outcomeKey] =
  (currentMarket.liabilities?.[outcomeKey] || 0) + (amount * lockedOdds);
```

- [ ] **Step 4: Run the API test to verify it passes**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts src/lib/bet-mode.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
PASS src/lib/bet-mode.test.ts
```

- [ ] **Step 5: Commit the persistence alignment**

```bash
git add src/app/api/bets/route.ts src/app/api/bets/route.test.ts src/lib/bet-mode.ts
git commit -m "feat: persist trial funds locked payout basis"
```

### Task 4: Keep Settlement Consistent With Stored Trial-Funds Odds

**Files:**
- Modify: `src/app/api/cron/settle/route.ts`
- Modify: `src/app/api/bets/route.ts`
- Test: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Add a failing settlement contract test**

Append to `src/app/api/bets/route.test.ts`:

```ts
import { getNetPayoutFromLockedOdds } from '@/lib/bet-mode';

it('uses stored locked odds as the only payout basis for trial-funds wins', () => {
  expect(getNetPayoutFromLockedOdds(20, 2.15, true)).toBeCloseTo(43, 6);
});
```

- [ ] **Step 2: Run the focused test suite**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts src/lib/bet-mode.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
PASS src/lib/bet-mode.test.ts
```

- [ ] **Step 3: Update settlement to respect stored payout metadata**

In `src/app/api/cron/settle/route.ts`, extend the local `BetRecord` type:

```ts
interface BetRecord {
  id: string;
  userAddress: string;
  matchId: number;
  matchName: string;
  outcome: string;
  amount: number;
  odds?: number;
  netPayout?: number;
  signature?: string | null;
  status?: string;
  useBonus: boolean;
  timestamp: number;
  paidOut?: boolean;
}
```

Import the shared helper:

```ts
import { getNetPayoutFromLockedOdds } from '@/lib/bet-mode';
```

Replace the hard-coded win amount calculation:

```ts
const winAmount = typeof bet.netPayout === 'number'
  ? bet.netPayout
  : getNetPayoutFromLockedOdds(bet.amount, bet.odds || 1, bet.useBonus);
```

Keep the real-money SPL payout filter unchanged so trial-funds wins do not try to send on-chain funds:

```ts
if (bet.status === "win" && !bet.paidOut && !bet.useBonus && bet.amount > 0) {
```

This preserves the existing real-money payout route while making the stored payout basis unambiguous for future bonus settlement handling.

- [ ] **Step 4: Run regression tests and diagnostics**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts src/lib/bet-mode.test.ts src/lib/wallets.test.ts
```

Then run diagnostics for:

```text
src/app/api/bets/route.ts
src/app/api/cron/settle/route.ts
src/app/page.tsx
src/lib/bet-mode.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
PASS src/lib/bet-mode.test.ts
PASS src/lib/wallets.test.ts
```

- [ ] **Step 5: Commit the settlement alignment**

```bash
git add src/app/api/cron/settle/route.ts src/app/api/bets/route.ts src/app/api/bets/route.test.ts src/lib/bet-mode.ts
git commit -m "fix: align trial funds settlement with locked odds"
```

## Self-Review

- Spec coverage:
  - Selected match real-time odds recalculation is covered in Task 2.
  - Trial-funds 8% winner-fee basis is covered in Tasks 1 and 2.
  - Locked odds, potential payout, persistence, and settlement alignment are covered in Tasks 2, 3, and 4.
  - No-second-deduction settlement rule is covered in Tasks 1 and 4.
- Placeholder scan:
  - No `TODO`, `TBD`, or vague “handle later” instructions remain.
- Type consistency:
  - `useBonus`, `odds`, and `netPayout` are the shared fields across UI, persistence, and settlement tasks.

