# Market Phase And Underdog Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement single-sided `initialOdds` pricing plus a solvency-first underdog attraction window so early balancing bets stay attractive without changing the `8%` fee or breaking refund / settlement consistency.

**Architecture:** Add a small shared rules layer for market phase detection and underdog attraction-window parameters, then make the odds engine expose one phase-aware quote path for both display odds and locked odds. Use the same market-state bookkeeping in `page.tsx` and `src/app/api/bets/route.ts`, persist attraction-window usage in market data, and leave settlement driven by stored locked odds / refund state.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, file-based JSON persistence

---

## File Map

- Create: `src/lib/market-rules.ts`
  - Holds market-phase detection, attraction-window constants, and shared helpers.
- Create: `src/lib/market-rules.test.ts`
  - Verifies single-sided detection, attraction-window accounting, and split-order behavior.
- Create: `src/lib/odds-engine.test.ts`
  - Verifies the new phase-aware odds engine behavior.
- Modify: `src/lib/marketDb.ts`
  - Extends persisted market state with attraction-window usage.
- Modify: `src/lib/odds-engine.ts`
  - Adds phase-aware display / locked quote helpers while preserving solvency-first caps.
- Modify: `src/app/page.tsx`
  - Uses the phase-aware quote path for single-sided matches and underdog attraction-window pricing.
- Modify: `src/app/api/bets/route.ts`
  - Validates and persists accepted odds under the same phase-aware rules and updates attraction-window usage.
- Modify: `src/app/api/bets/route.test.ts`
  - Covers first-side pricing, second-side switch, attraction-window consumption, and split-order resistance.

## Implementation Notes

- This plan covers two related specs in one coherent subsystem because both change the same pricing boundary: when the market is single-sided and when the market becomes multi-sided but still highly imbalanced.
- Do not change the `8%` fee model.
- Do not inject protocol principal into the odds model.
- Keep settlement using stored `odds` / `netPayout`; do not add a second payout calculation path.
- Stage only the files listed in each task because the repo already contains unrelated changes.

### Task 1: Add Shared Market Rules Helpers

**Files:**
- Create: `src/lib/market-rules.ts`
- Create: `src/lib/market-rules.test.ts`

- [ ] **Step 1: Write the failing helper test**

Create `src/lib/market-rules.test.ts`:

```ts
import {
  ATTRACTION_WINDOW_MAX_ODDS,
  ATTRACTION_WINDOW_SIZE,
  countActiveOutcomes,
  getAttractionWindowRemaining,
  getSingleSidedOutcome,
  isSingleSidedMarket,
  splitBetByAttractionWindow,
} from './market-rules';

describe('market rules helpers', () => {
  it('detects when the market is single-sided', () => {
    expect(countActiveOutcomes({ home: 5, draw: 0, away: 0 })).toBe(1);
    expect(isSingleSidedMarket({ home: 5, draw: 0, away: 0 })).toBe(true);
    expect(getSingleSidedOutcome({ home: 5, draw: 0, away: 0 })).toBe('home');
  });

  it('reports no single-sided outcome once two sides have funds', () => {
    expect(countActiveOutcomes({ home: 5, draw: 1, away: 0 })).toBe(2);
    expect(isSingleSidedMarket({ home: 5, draw: 1, away: 0 })).toBe(false);
    expect(getSingleSidedOutcome({ home: 5, draw: 1, away: 0 })).toBeNull();
  });

  it('tracks remaining attraction quota per outcome', () => {
    expect(ATTRACTION_WINDOW_SIZE).toBe(10);
    expect(ATTRACTION_WINDOW_MAX_ODDS).toBe(15);
    expect(
      getAttractionWindowRemaining({ home: 0, draw: 0, away: 8 }, 'away')
    ).toBe(2);
  });

  it('splits a bet between attraction-window and post-window portions', () => {
    expect(
      splitBetByAttractionWindow(6, { home: 0, draw: 0, away: 8 }, 'away')
    ).toEqual({ attractiveAmount: 2, regularAmount: 4 });
  });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npm test -- --runTestsByPath src/lib/market-rules.test.ts
```

Expected:

```text
FAIL src/lib/market-rules.test.ts
Cannot find module './market-rules'
```

- [ ] **Step 3: Write the minimal shared helper implementation**

Create `src/lib/market-rules.ts`:

```ts
export type OutcomeKey = 'home' | 'draw' | 'away';

export const ATTRACTION_WINDOW_SIZE = 10;
export const ATTRACTION_WINDOW_MAX_ODDS = 15.0;

export type OutcomePools = Record<OutcomeKey, number>;
export type AttractionWindowUsage = Record<OutcomeKey, number>;

export function countActiveOutcomes(pools: OutcomePools): number {
  return (['home', 'draw', 'away'] as OutcomeKey[]).filter((key) => (pools[key] || 0) > 0).length;
}

export function isSingleSidedMarket(pools: OutcomePools): boolean {
  return countActiveOutcomes(pools) === 1;
}

export function getSingleSidedOutcome(pools: OutcomePools): OutcomeKey | null {
  const active = (['home', 'draw', 'away'] as OutcomeKey[]).filter((key) => (pools[key] || 0) > 0);
  return active.length === 1 ? active[0] : null;
}

export function getAttractionWindowRemaining(
  usage: AttractionWindowUsage,
  outcome: OutcomeKey
): number {
  return Math.max(0, ATTRACTION_WINDOW_SIZE - (usage[outcome] || 0));
}

export function splitBetByAttractionWindow(
  amount: number,
  usage: AttractionWindowUsage,
  outcome: OutcomeKey
): { attractiveAmount: number; regularAmount: number } {
  const attractiveAmount = Math.min(Math.max(0, amount), getAttractionWindowRemaining(usage, outcome));
  return {
    attractiveAmount,
    regularAmount: Math.max(0, amount - attractiveAmount),
  };
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npm test -- --runTestsByPath src/lib/market-rules.test.ts
```

Expected:

```text
PASS src/lib/market-rules.test.ts
4 passed
```

- [ ] **Step 5: Commit the shared rules layer**

```bash
git add src/lib/market-rules.ts src/lib/market-rules.test.ts
git commit -m "feat: add shared market phase rules"
```

### Task 2: Extend Market State And Phase-Aware Odds Engine Quotes

**Files:**
- Modify: `src/lib/marketDb.ts`
- Modify: `src/lib/odds-engine.ts`
- Create: `src/lib/odds-engine.test.ts`
- Test: `src/lib/market-rules.test.ts`

- [ ] **Step 1: Write the failing odds-engine test**

Create `src/lib/odds-engine.test.ts`:

```ts
import { DynamicOddsEngine } from './odds-engine';

describe('phase-aware odds engine', () => {
  it('uses initial odds during single-sided phase even for live matches', () => {
    const engine = new DynamicOddsEngine();
    const quote = engine.calculatePhaseAwareLockedOdds({
      pools: { home: 25, draw: 0, away: 0 },
      liabilities: { home: 0, draw: 0, away: 0 },
      selectedOutcome: 'home',
      betAmount: 5,
      initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
      attractionWindowUsed: { home: 0, draw: 0, away: 0 },
      score: '0-2',
      liveMinute: 67,
      status: 'live',
      returnRate: 0.92,
    });

    expect(quote.odds).toBe(1.88);
    expect(quote.riskLevel).toBe('refund_single_side');
  });

  it('caps early cold-underdog pricing by attraction-window and solvency rules', () => {
    const engine = new DynamicOddsEngine();
    const quote = engine.calculatePhaseAwareLockedOdds({
      pools: { home: 100, draw: 50, away: 0 },
      liabilities: { home: 0, draw: 0, away: 0 },
      selectedOutcome: 'away',
      betAmount: 5,
      initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
      attractionWindowUsed: { home: 0, draw: 0, away: 0 },
      score: null,
      liveMinute: undefined,
      status: 'upcoming',
      returnRate: 0.92,
    });

    expect(quote.odds).toBeLessThanOrEqual(15);
    expect(quote.odds).toBeGreaterThan(1.01);
  });
});
```

- [ ] **Step 2: Run the odds-engine test to verify it fails**

Run:

```bash
npm test -- --runTestsByPath src/lib/odds-engine.test.ts
```

Expected:

```text
FAIL src/lib/odds-engine.test.ts
engine.calculatePhaseAwareLockedOdds is not a function
```

- [ ] **Step 3: Extend persisted market state and add phase-aware quote methods**

In `src/lib/marketDb.ts`, extend the market type:

```ts
export type MarketDataInfo = {
  realTotalPool: number;
  liabilities: { home: number; draw: number; away: number };
  pools?: { home: number; draw: number; away: number };
  attractionWindowUsed?: { home: number; draw: number; away: number };
  seedBankroll?: number;
  refundProcessed?: boolean;
  settled?: boolean;
  finalWinner?: string;
  finalScore?: string;
  adminSurplus?: number;
};
```

In `src/lib/odds-engine.ts`, add the imports:

```ts
import {
  ATTRACTION_WINDOW_MAX_ODDS,
  type AttractionWindowUsage,
  type OutcomeKey,
  getSingleSidedOutcome,
  isSingleSidedMarket,
  splitBetByAttractionWindow,
} from './market-rules';
```

Add the new quote input / output types near the top of the file:

```ts
export type PhaseAwareQuoteInput = {
  pools: Record<OutcomeKey, number>;
  liabilities: Record<OutcomeKey, number>;
  selectedOutcome: OutcomeKey;
  betAmount: number;
  initialOdds: Record<OutcomeKey, number>;
  attractionWindowUsed: AttractionWindowUsage;
  score?: string | null;
  liveMinute?: number;
  status?: string;
  returnRate?: number;
};

export type PhaseAwareQuoteResult = {
  odds: number;
  riskLevel: RiskLevel;
  attractiveAmount: number;
  regularAmount: number;
  singleSided: boolean;
};
```

Add the phase-aware locked quote method:

```ts
public calculatePhaseAwareLockedOdds(input: PhaseAwareQuoteInput): PhaseAwareQuoteResult | null {
  const rr = input.returnRate ?? this.baseReturnRate;

  if (isSingleSidedMarket(input.pools)) {
    return {
      odds: input.initialOdds[input.selectedOutcome] || 1.01,
      riskLevel: 'refund_single_side',
      attractiveAmount: 0,
      regularAmount: 0,
      singleSided: true,
    };
  }

  const split = splitBetByAttractionWindow(
    input.betAmount,
    input.attractionWindowUsed,
    input.selectedOutcome
  );

  const regularQuote = this.calculateDynamicOdds(
    input.pools,
    input.selectedOutcome,
    input.betAmount,
    input.liabilities,
    undefined,
    undefined,
    input.initialOdds,
    input.score,
    input.liveMinute,
    input.status,
    rr
  );

  if (!regularQuote) return null;

  const attractiveOdds = Math.min(
    ATTRACTION_WINDOW_MAX_ODDS,
    regularQuote.odds
  );

  const weightedOdds =
    input.betAmount <= 0
      ? attractiveOdds
      : ((split.attractiveAmount * attractiveOdds) + (split.regularAmount * regularQuote.odds)) / input.betAmount;

  return {
    odds: parseFloat(weightedOdds.toFixed(4)),
    riskLevel: regularQuote.riskLevel,
    attractiveAmount: split.attractiveAmount,
    regularAmount: split.regularAmount,
    singleSided: false,
  };
}
```

Also add a display helper so `page.tsx` can quote all three buttons consistently:

```ts
public calculatePhaseAwareDisplayOdds(args: {
  pools: Record<OutcomeKey, number>;
  initialOdds: Record<OutcomeKey, number>;
  attractionWindowUsed: AttractionWindowUsage;
  score?: string | null;
  liveMinute?: number;
  status?: string;
  returnRate?: number;
}): Record<OutcomeKey, number> {
  if (isSingleSidedMarket(args.pools)) {
    return args.initialOdds;
  }

  const rr = args.returnRate ?? this.baseReturnRate;
  return this.calculateAllDisplayOdds(
    args.pools,
    undefined,
    undefined,
    args.score,
    args.liveMinute,
    args.status,
    rr
  );
}
```

- [ ] **Step 4: Run the odds-engine tests and helper regressions**

Run:

```bash
npm test -- --runTestsByPath src/lib/market-rules.test.ts src/lib/odds-engine.test.ts src/lib/bet-mode.test.ts
```

Expected:

```text
PASS src/lib/market-rules.test.ts
PASS src/lib/odds-engine.test.ts
PASS src/lib/bet-mode.test.ts
```

- [ ] **Step 5: Commit the engine layer**

```bash
git add src/lib/marketDb.ts src/lib/odds-engine.ts src/lib/odds-engine.test.ts
git commit -m "feat: add phase aware odds engine quotes"
```

### Task 3: Use Phase-Aware Quotes In The Frontend

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/lib/odds-engine.test.ts`

- [ ] **Step 1: Add a failing UI-oriented odds-engine assertion**

Append to `src/lib/odds-engine.test.ts`:

```ts
it('returns initial odds for display during single-sided phase', () => {
  const engine = new DynamicOddsEngine();
  expect(
    engine.calculatePhaseAwareDisplayOdds({
      pools: { home: 12, draw: 0, away: 0 },
      initialOdds: { home: 1.91, draw: 3.2, away: 4.4 },
      attractionWindowUsed: { home: 0, draw: 0, away: 0 },
      score: '0-2',
      liveMinute: 75,
      status: 'live',
      returnRate: 0.92,
    })
  ).toEqual({ home: 1.91, draw: 3.2, away: 4.4 });
});
```

- [ ] **Step 2: Run the focused engine test**

Run:

```bash
npm test -- --runTestsByPath src/lib/odds-engine.test.ts
```

Expected:

```text
PASS src/lib/odds-engine.test.ts
3 passed
```

- [ ] **Step 3: Update `page.tsx` to use single-sided / attraction-aware quoting**

In `src/app/page.tsx`, add the shared import:

```ts
import { isSingleSidedMarket } from "@/lib/market-rules"
```

When deriving display odds for the current match, use persisted `attractionWindowUsed` with a safe fallback:

```ts
const attractionWindowUsed = currentMatch.marketData?.attractionWindowUsed || {
  home: 0,
  draw: 0,
  away: 0,
};
```

Replace the `currentOdds` branch:

```ts
return oddsEngine.calculatePhaseAwareDisplayOdds({
  pools: md.pools,
  initialOdds: md.initialOdds,
  attractionWindowUsed,
  score: currentMatch.score,
  liveMinute: currentMatch.liveMinute,
  status: currentMatch.status,
  returnRate: effectiveReturnRate,
});
```

Replace `projectedOdds` with the new engine path:

```ts
const quote = oddsEngine.calculatePhaseAwareLockedOdds({
  pools: md.pools,
  liabilities: md.liabilities,
  selectedOutcome,
  betAmount: betAmountNum,
  initialOdds: md.initialOdds,
  attractionWindowUsed,
  score: currentMatch.score,
  liveMinute: currentMatch.liveMinute,
  status: currentMatch.status,
  returnRate: effectiveReturnRate,
});

return { odds: quote.odds, riskLevel: quote.riskLevel };
```

When rendering each selected match card, use the same helper so typing into a single-sided market no longer distorts the odds buttons:

```ts
const result = oddsEngine.calculatePhaseAwareDisplayOdds({
  pools: projectedPools,
  initialOdds: md.initialOdds,
  attractionWindowUsed: md.attractionWindowUsed || { home: 0, draw: 0, away: 0 },
  score: match.score,
  liveMinute: match.liveMinute,
  status: match.status,
  returnRate: effectiveReturnRate,
});
```

Retain the fallback behavior:

```ts
if (!currentMatch.marketData) {
  return currentMatch.pools.home + currentMatch.pools.draw + currentMatch.pools.away === 0
    ? { home: 1.01, draw: 1.01, away: 1.01 }
    : oddsEngine.calculateAllDisplayOdds(currentMatch.pools, undefined, undefined, currentMatch.score, currentMatch.liveMinute, currentMatch.status, effectiveReturnRate);
}
```

- [ ] **Step 4: Run targeted tests and diagnostics**

Run:

```bash
npm test -- --runTestsByPath src/lib/market-rules.test.ts src/lib/odds-engine.test.ts src/lib/bet-mode.test.ts src/lib/wallets.test.ts
```

Then run diagnostics for:

```text
src/app/page.tsx
src/lib/odds-engine.ts
```

Expected:

```text
PASS src/lib/market-rules.test.ts
PASS src/lib/odds-engine.test.ts
PASS src/lib/bet-mode.test.ts
PASS src/lib/wallets.test.ts
```

- [ ] **Step 5: Commit the frontend integration**

```bash
git add src/app/page.tsx src/lib/odds-engine.test.ts
git commit -m "feat: use phase aware odds in betting ui"
```

### Task 4: Persist Single-Sided Switches And Attraction-Window Usage In The Bets API

**Files:**
- Modify: `src/app/api/bets/route.ts`
- Modify: `src/app/api/bets/route.test.ts`
- Modify: `src/lib/marketDb.ts`

- [ ] **Step 1: Expand the failing API test**

Replace `src/app/api/bets/route.test.ts` with:

```ts
/**
 * @jest-environment node
 */

import { POST } from './route';

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn((file: string) => {
      if (String(file).includes('bets_db.json')) return '{}';
      if (String(file).includes('market_db.json')) {
        return JSON.stringify({
          '101': {
            realTotalPool: 100,
            liabilities: { home: 0, draw: 0, away: 0 },
            pools: { home: 100, draw: 0, away: 0 },
            initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
            attractionWindowUsed: { home: 0, draw: 0, away: 0 },
          },
        });
      }
      return '{}';
    }),
    writeFileSync: jest.fn(),
  },
}));

jest.mock('@/lib/gdriveBackup', () => ({ triggerAutoBackup: jest.fn() }));
jest.mock('@/lib/reserve', () => ({
  addToReserve: jest.fn(),
  loadReserve: jest.fn(() => ({ balance: 1000 })),
}));

describe('bets POST', () => {
  it('locks initial odds while the market is still single-sided', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 5,
        odds: 1.88,
        useBonus: false,
        timestamp: 1234567890,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.odds).toBe(1.88);
  });

  it('stores attraction-window-based net payout for early cold underdog bets', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'away',
        amount: 5,
        odds: 15,
        useBonus: true,
        timestamp: 1234567891,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.odds).toBe(15);
    expect(json.data.netPayout).toBe(75);
  });
});
```

- [ ] **Step 2: Run the API test to verify it exposes missing market-state bookkeeping**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
FAIL src/app/api/bets/route.test.ts
```

The failure should point to missing support for initial-odds single-sided validation or attraction-window bookkeeping.

- [ ] **Step 3: Implement shared API validation and persistence rules**

In `src/app/api/bets/route.ts`, add the imports:

```ts
import {
  isSingleSidedMarket,
  splitBetByAttractionWindow,
} from '@/lib/market-rules';
```

Ensure market state includes defaults:

```ts
const currentMarket: MarketDataInfo = marketDb[key] || {
  realTotalPool: 0,
  liabilities: { home: 0, draw: 0, away: 0 },
  pools: { home: 0, draw: 0, away: 0 },
  attractionWindowUsed: { home: 0, draw: 0, away: 0 },
};
```

Normalize attraction-window usage:

```ts
currentMarket.attractionWindowUsed ||= { home: 0, draw: 0, away: 0 };
```

Detect the current market phase and honor single-sided initial odds:

```ts
const singleSided = isSingleSidedMarket(currentPools);

if (singleSided) {
  if (typeof lockedOdds !== 'number' || lockedOdds < 1.01) {
    return NextResponse.json({ error: '單邊首注賠率異常。' }, { status: 403 });
  }
} else {
  // keep the existing solvency and xMax checks
}
```

Persist attraction-window usage when the accepted order hits a cold side:

```ts
const split = splitBetByAttractionWindow(
  amount,
  currentMarket.attractionWindowUsed,
  outcomeKey
);

currentMarket.attractionWindowUsed[outcomeKey] =
  (currentMarket.attractionWindowUsed[outcomeKey] || 0) + split.attractiveAmount;
```

Keep storing:

```ts
odds: lockedOdds,
netPayout,
```

and preserve the exact switch by updating pools immediately after acceptance:

```ts
currentMarket.pools[outcomeKey] = (currentMarket.pools?.[outcomeKey] || 0) + amount;
```

- [ ] **Step 4: Run the API and helper regressions**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts src/lib/market-rules.test.ts src/lib/odds-engine.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
PASS src/lib/market-rules.test.ts
PASS src/lib/odds-engine.test.ts
```

- [ ] **Step 5: Commit the API persistence layer**

```bash
git add src/app/api/bets/route.ts src/app/api/bets/route.test.ts src/lib/marketDb.ts
git commit -m "feat: persist market phase and attraction window state"
```

### Task 5: Add Refund And Transition Regression Coverage

**Files:**
- Modify: `src/app/api/bets/route.test.ts`
- Modify: `src/lib/odds-engine.test.ts`
- Modify: `src/lib/market-rules.test.ts`

- [ ] **Step 1: Add the final regression tests**

Append to `src/lib/odds-engine.test.ts`:

```ts
it('weights a partially eligible cold-underdog order into one locked odds value', () => {
  const engine = new DynamicOddsEngine();
  const quote = engine.calculatePhaseAwareLockedOdds({
    pools: { home: 100, draw: 50, away: 0 },
    liabilities: { home: 0, draw: 0, away: 0 },
    selectedOutcome: 'away',
    betAmount: 12,
    initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
    attractionWindowUsed: { home: 0, draw: 0, away: 8 },
    status: 'upcoming',
    returnRate: 0.92,
  });

  expect(quote.attractiveAmount).toBe(2);
  expect(quote.regularAmount).toBe(10);
  expect(quote.odds).toBeLessThanOrEqual(15);
});
```

Append to `src/app/api/bets/route.test.ts`:

```ts
import fs from 'fs';

it('does not reset attraction-window pricing by splitting small orders', async () => {
  const requestA = new Request('http://localhost/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: 'trial-user',
      matchId: 101,
      matchName: 'A vs B',
      outcome: 'away',
      amount: 8,
      odds: 15,
      useBonus: false,
      timestamp: 1234567892,
    }),
  });

  await POST(requestA);

  const requestB = new Request('http://localhost/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: 'trial-user',
      matchId: 101,
      matchName: 'A vs B',
      outcome: 'away',
      amount: 4,
      odds: 12,
      useBonus: false,
      timestamp: 1234567893,
    }),
  });

  await POST(requestB);

  const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls;
  const marketWrite = writeCalls.find(([filePath]) =>
    String(filePath).includes('market_db.json')
  );
  const savedMarketDb = JSON.parse(String(marketWrite?.[1] || '{}'));

  expect(savedMarketDb['101'].attractionWindowUsed.away).toBe(10);
});
```

- [ ] **Step 2: Run the full targeted suite**

Run:

```bash
npm test -- --runTestsByPath src/lib/market-rules.test.ts src/lib/odds-engine.test.ts src/app/api/bets/route.test.ts src/lib/bet-mode.test.ts src/lib/wallets.test.ts
```

Expected:

```text
PASS src/lib/market-rules.test.ts
PASS src/lib/odds-engine.test.ts
PASS src/app/api/bets/route.test.ts
PASS src/lib/bet-mode.test.ts
PASS src/lib/wallets.test.ts
```

- [ ] **Step 3: Run diagnostics on all edited implementation files**

Run diagnostics for:

```text
src/lib/market-rules.ts
src/lib/marketDb.ts
src/lib/odds-engine.ts
src/app/page.tsx
src/app/api/bets/route.ts
```

Expected:

```text
No diagnostics
```

- [ ] **Step 4: Verify the spec coverage before handoff**

Use this checklist:

```text
- single-sided phase locks initialOdds
- live single-sided phase still locks initialOdds
- second-side entry switches immediately
- first 10 units of cold underdog liquidity can receive attractive pricing
- attraction window is cumulative per matchId + outcome
- final odds never exceed solvency-safe odds
- locked odds, displayed odds, saved odds, and net payout stay aligned
```

Expected:

```text
All seven checks confirmed by tests or code path review
```

- [ ] **Step 5: Commit the regression coverage**

```bash
git add src/lib/market-rules.test.ts src/lib/odds-engine.test.ts src/app/api/bets/route.test.ts
git commit -m "test: cover market phase and underdog pricing rules"
```

## Self-Review

- Spec coverage:
  - Single-sided `initialOdds` behavior is implemented in Tasks 2, 3, and 4.
  - Immediate switch after second-side entry is covered in Tasks 3 and 4.
  - Attraction-window quota, cap, and split-order resistance are covered in Tasks 1, 2, 4, and 5.
  - Solvency-first bound is preserved in Task 2 and enforced in Task 4.
  - Refund consistency is preserved and regression-checked in Task 5.
- Placeholder scan:
  - No `TODO`, `TBD`, or vague “handle later” instructions remain.
- Type consistency:
  - `OutcomeKey`, `AttractionWindowUsage`, `calculatePhaseAwareLockedOdds`, and `calculatePhaseAwareDisplayOdds` are defined before later tasks depend on them.
