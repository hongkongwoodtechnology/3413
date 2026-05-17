# Live Odds And Trial Funds Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selected match card update `home/draw/away` odds immediately while typing, while preserving first-bet behavior and existing trial-funds guardrails.

**Architecture:** Keep the existing page-level pricing flow, but centralize projected pool increment logic in a small shared helper so the locale and non-locale home pages use the same rules. Reuse the existing backend trial-funds guardrails, add one regression test for the pool-wide first-bet definition, and align the UI preview with the same real-money vs trial-funds semantics used at bet execution time.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, React Testing Library

---

## File Structure

### Files To Create

- `src/lib/bet-preview.ts`
  - Shared helper for computing projected pool increments and deciding whether a focused card should keep `initialOdds`.

### Files To Modify

- `src/app/[locale]/page.tsx`
  - Replace gross-input preview logic with shared projected-pool logic for live odds buttons and selected quote preview.
- `src/app/page.tsx`
  - Mirror the same changes as the locale page.
- `src/app/[locale]/page.test.tsx`
  - Add focused tests for live odds button updates, first-bet stability, and trial-funds preview behavior.
- `src/app/page.test.tsx`
  - Mirror the same tests for the non-locale page.
- `src/app/api/bets/route.test.ts`
  - Add a regression test that documents pool-wide first-bet behavior instead of per-user interpretation.

### Files Expected To Stay Unchanged

- `src/app/api/bets/route.ts`
  - The current backend already enforces:
    - trial-funds cannot open a pool,
    - the cumulative 15% cap,
    - cap base from current real pool only,
    - real-money bets are unaffected.

## Task 1: Add Shared Bet Preview Helper

**Files:**
- Create: `src/lib/bet-preview.ts`
- Test through: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Add the helper module**

```ts
import { splitBetAmount } from './wallets';

export type MatchPoolSnapshot = {
  realTotalPool: number;
  pools: { home: number; draw: number; away: number };
};

export function getProjectedPoolIncrement(params: {
  amount: number;
  useBonus: boolean;
  commissionRate: number;
  currentRealPool: number;
}): number {
  if (!Number.isFinite(params.amount) || params.amount <= 0) return 0;
  if (params.useBonus) return params.amount;

  const split = splitBetAmount(
    params.amount,
    params.commissionRate,
    params.currentRealPool
  );

  return Number.isFinite(split.pool) && split.pool > 0 ? split.pool : 0;
}

export function isInitialPoolState(pools: {
  home: number;
  draw: number;
  away: number;
}): boolean {
  const activeCount = [pools.home, pools.draw, pools.away].filter(
    (value) => value > 0
  ).length;

  return activeCount <= 1;
}
```

- [ ] **Step 2: Keep the helper small and dependency-light**

```ts
// No React imports here.
// No API or storage reads here.
// Keep helper pure so both pages can call it during render.
```

- [ ] **Step 3: Commit the helper scaffold**

```bash
git add src/lib/bet-preview.ts
git commit -m "refactor: add shared bet preview helper"
```

## Task 2: Add Locale Page Tests For Live Odds Refresh

**Files:**
- Modify: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Replace the mocked odds engine with input-sensitive test values**

```ts
jest.mock("@/lib/odds-engine", () => ({
  DynamicOddsEngine: class {
    calculateOdds() {
      return 1.5;
    }

    calculatePhaseAwareDisplayOdds({ pools }: { pools: { home: number; draw: number; away: number } }) {
      return {
        home: Number((pools.home / 10).toFixed(2)),
        draw: Number((pools.draw / 10).toFixed(2)),
        away: Number((pools.away / 10).toFixed(2)),
      };
    }

    calculatePhaseAwareLockedOdds({ betAmount }: { betAmount: number }) {
      return { odds: 1.5 + betAmount / 100, riskLevel: "normal" };
    }

    calculateAllDisplayOdds(pools: { home: number; draw: number; away: number }) {
      return {
        home: Number((pools.home / 10).toFixed(2)),
        draw: Number((pools.draw / 10).toFixed(2)),
        away: Number((pools.away / 10).toFixed(2)),
      };
    }

    calculateDynamicOdds(_: unknown, __: unknown, betAmount: number) {
      return { odds: 1.5 + betAmount / 100, riskLevel: "normal" };
    }

    getMaxBetAmount() {
      return 999999;
    }

    getMaxPositionRatio() {
      return 0.3;
    }

    getFeeFundedThreshold() {
      return 0.5;
    }
  },
}));
```

- [ ] **Step 2: Make `splitBetAmount` clearly distinguish real money vs trial funds**

```ts
const mockedSplitBetAmount = jest.fn(() => ({
  pool: 3.68,
  house: 0.16,
  commission: 0.16,
  support: 0,
}));

jest.mock("@/lib/wallets", () => ({
  HOUSE_WALLET: "house-wallet",
  COMMISSION_WALLET: "commission-wallet",
  USDT_MINT: "mint",
  USDT_DECIMALS: 6,
  PLATFORM_FEE_RATE: 0.005,
  DEFAULT_COMMISSION_RATE: 0.3,
  POOL_ADDRESS: "pool-address",
  splitBetAmount: (...args: unknown[]) => mockedSplitBetAmount(...args),
  getCombinedPlatformFeeAmount: ({ house, commission }: { house: number; commission: number }) =>
    house + commission,
  formatMissingAtaInitializationMessage: () => "missing ata",
  getBoundReferrerStorageKey: (address: string) => `bound_referrer_${address}`,
  resolvePreferredWalletAddress: (walletAddress: string, phantomAddress: string | null) =>
    phantomAddress || walletAddress,
}));
```

- [ ] **Step 3: Add a failing test for real-money live button recalculation**

```ts
it("updates all localized outcome buttons immediately using net pool contribution for real money", async () => {
  mockedLanguage = "zh-TW";
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  window.history.replaceState({}, "", "/zh-TW");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /2\.87/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2\.00/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\.50/ })).toBeInTheDocument();
  });

  expect(mockedSplitBetAmount).toHaveBeenCalledWith(4, expect.any(Number), 60);
});
```

- [ ] **Step 4: Add a failing test for first-bet stability**

```ts
it("keeps localized initial odds stable while typing on a first-bet pool", async () => {
  mockedLanguage = "zh-TW";
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  window.history.replaceState({}, "", "/zh-TW");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  expect(screen.getByRole("button", { name: /1\.5/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /2\.5/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /3\.5/ })).toBeInTheDocument();
});
```

- [ ] **Step 5: Add a failing test for trial-funds live recalculation**

```ts
it("updates all localized outcome buttons immediately for trial-funds input on a non-zero pool", async () => {
  mockedLanguage = "zh-TW";
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  window.history.replaceState({}, "", "/zh-TW");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /2\.90/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2\.00/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\.50/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the locale test file and confirm failures**

```bash
npx jest --runInBand --watch=false --runTestsByPath src/app/[locale]/page.test.tsx
```

Expected:

```text
FAIL
updates all localized outcome buttons immediately using net pool contribution for real money
keeps localized initial odds stable while typing on a first-bet pool
updates all localized outcome buttons immediately for trial-funds input on a non-zero pool
```

- [ ] **Step 7: Commit the failing locale tests**

```bash
git add src/app/[locale]/page.test.tsx
git commit -m "test: cover localized live odds refresh"
```

## Task 3: Implement Locale Page Live Preview Logic

**Files:**
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/lib/bet-preview.ts`

- [ ] **Step 1: Import the helper into the locale page**

```ts
import {
  getProjectedPoolIncrement,
  isInitialPoolState,
} from "@/lib/bet-preview";
```

- [ ] **Step 2: Add a shared projected increment memo near `betAmountNum`**

```ts
const currentRealPool = currentMatch?.marketData
  ? currentMatch.marketData.realTotalPool
  : currentMatch
    ? currentMatch.pools.home + currentMatch.pools.draw + currentMatch.pools.away
    : 0;

const projectedPoolIncrement = useMemo(() => {
  if (!currentMatch || betAmountNum <= 0) return 0;

  return getProjectedPoolIncrement({
    amount: betAmountNum,
    useBonus,
    commissionRate: effectiveCommissionRate,
    currentRealPool,
  });
}, [currentMatch, betAmountNum, useBonus, effectiveCommissionRate, currentRealPool]);
```

- [ ] **Step 3: Use the same projected increment in `projectedOdds`**

```ts
const effectiveBetAmountForQuote = useBonus ? betAmountNum : projectedPoolIncrement;

const projectedOdds = useMemo((): { odds: number; riskLevel: RiskLevel } | null => {
  if (!currentMatch || !selectedOutcome || effectiveBetAmountForQuote <= 0) return null;

  if (!currentMatch.marketData) {
    const poolDict = {
      home: currentMatch.pools.home,
      draw: currentMatch.pools.draw,
      away: currentMatch.pools.away,
    };
    const totalReal = poolDict.home + poolDict.draw + poolDict.away;
    return oddsEngine.calculateDynamicOdds(
      poolDict,
      selectedOutcome,
      effectiveBetAmountForQuote,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      effectiveReturnRate,
      totalReal < 0.50 || undefined,
      effectiveCommissionRate
    );
  }

  const md = currentMatch.marketData;
  const attractionWindowUsed = md.attractionWindowUsed || {
    home: 0,
    draw: 0,
    away: 0,
  };

  const quote = oddsEngine.calculatePhaseAwareLockedOdds({
    pools: md.pools,
    liabilities: md.liabilities,
    selectedOutcome: selectedOutcome as "home" | "draw" | "away",
    betAmount: effectiveBetAmountForQuote,
    initialOdds: md.initialOdds,
    attractionWindowUsed,
    score: currentMatch.score,
    liveMinute: currentMatch.liveMinute,
    status: currentMatch.status,
    returnRate: effectiveReturnRate,
  });

  return quote ? { odds: quote.odds, riskLevel: quote.riskLevel } : null;
}, [
  currentMatch,
  selectedOutcome,
  effectiveBetAmountForQuote,
  oddsEngine,
  effectiveCommissionRate,
  effectiveReturnRate,
]);
```

- [ ] **Step 4: Replace gross pool mutation in the match-card display branch**

```ts
if (isFocused && selectedOutcome) {
  const projectedIncrement = getProjectedPoolIncrement({
    amount: betAmountNum,
    useBonus,
    commissionRate: effectiveCommissionRate,
    currentRealPool: md.realTotalPool,
  });

  if (md.realTotalPool === 0 || isInitialPoolState(md.pools)) {
    matchOdds = {
      home: md.initialOdds.home,
      draw: md.initialOdds.draw,
      away: md.initialOdds.away,
    };
  } else if (projectedIncrement > 0) {
    const projectedPools = {
      home: md.pools.home || 0,
      draw: md.pools.draw || 0,
      away: md.pools.away || 0,
    };
    projectedPools[selectedOutcome as keyof typeof projectedPools] += projectedIncrement;
    const result = oddsEngine.calculatePhaseAwareDisplayOdds({
      pools: projectedPools,
      initialOdds: md.initialOdds,
      attractionWindowUsed,
      score: match.score,
      liveMinute: match.liveMinute,
      status: match.status,
      returnRate: effectiveReturnRate,
    });
    matchOdds = { home: result.home, draw: result.draw, away: result.away };
  }
}
```

- [ ] **Step 5: Keep optimistic post-submit updates aligned**

```ts
const effectivePool = !useBonus ? poolAmountForDisplay : betAmountNum;
```

Keep this line unchanged in the optimistic update branch because it already matches the desired semantics.

- [ ] **Step 6: Run the locale test file and verify it passes**

```bash
npx jest --runInBand --watch=false --runTestsByPath src/app/[locale]/page.test.tsx
```

Expected:

```text
PASS src/app/[locale]/page.test.tsx
```

- [ ] **Step 7: Commit the locale implementation**

```bash
git add src/lib/bet-preview.ts src/app/[locale]/page.tsx src/app/[locale]/page.test.tsx
git commit -m "feat: refresh localized live odds while typing"
```

## Task 4: Mirror The Same Behavior On The Non-Locale Home Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

- [ ] **Step 1: Copy the same imports and projected increment memo into the root page**

```ts
import {
  getProjectedPoolIncrement,
  isInitialPoolState,
} from "@/lib/bet-preview";
```

```ts
const currentRealPool = currentMatch?.marketData
  ? currentMatch.marketData.realTotalPool
  : currentMatch
    ? currentMatch.pools.home + currentMatch.pools.draw + currentMatch.pools.away
    : 0;

const projectedPoolIncrement = useMemo(() => {
  if (!currentMatch || betAmountNum <= 0) return 0;

  return getProjectedPoolIncrement({
    amount: betAmountNum,
    useBonus,
    commissionRate: effectiveCommissionRate,
    currentRealPool,
  });
}, [currentMatch, betAmountNum, useBonus, effectiveCommissionRate, currentRealPool]);
```

- [ ] **Step 2: Apply the same `projectedOdds` and match-card display changes**

```ts
const effectiveBetAmountForQuote = useBonus ? betAmountNum : projectedPoolIncrement;
```

Use the same implementation pattern from Task 3 in:

- the `projectedOdds` memo
- the focused-card `matchOdds` branch

- [ ] **Step 3: Add matching non-locale tests**

```ts
it("updates all outcome buttons immediately using net pool contribution for real money", async () => {
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  window.history.replaceState({}, "", "/");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /2\.87/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2\.00/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\.50/ })).toBeInTheDocument();
  });
});
```

```ts
it("keeps initial odds stable while typing on a first-bet pool", async () => {
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  window.history.replaceState({}, "", "/");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  expect(screen.getByRole("button", { name: /1\.5/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /2\.5/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /3\.5/ })).toBeInTheDocument();
});
```

```ts
it("updates all outcome buttons immediately for trial funds on a non-zero pool", async () => {
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  window.history.replaceState({}, "", "/");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /2\.90/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2\.00/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\.50/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the root page test file**

```bash
npx jest --runInBand --watch=false --runTestsByPath src/app/page.test.tsx
```

Expected:

```text
PASS src/app/page.test.tsx
```

- [ ] **Step 5: Commit the root-page mirror**

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: refresh root live odds while typing"
```

## Task 5: Add Backend Regression Coverage For Pool-Wide First Bet

**Files:**
- Modify: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Add a regression test that proves first-bet blocking is pool-wide**

```ts
it('treats trial-funds first-bet blocking as pool-wide rather than user-specific', async () => {
  mockDatabases({
    betsDb: {
      'trial-user-has-history': [
        {
          id: 'old-bet-other-match',
          userAddress: 'trial-user-has-history',
          matchId: 999,
          matchName: 'Other Match',
          outcome: 'away',
          amount: 3,
          odds: 2.2,
          netPayout: 6.6,
          status: 'pending',
          useBonus: true,
          timestamp: 1234567000,
        },
      ],
      marketDb: {
        '303': {
          realTotalPool: 0,
          liabilities: { home: 0, draw: 0, away: 0 },
          pools: { home: 0, draw: 0, away: 0 },
          initialOdds: { home: 2.1, draw: 3.2, away: 3.6 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      },
    },
  });

  const req = new Request('http://localhost/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: 'trial-user-has-history',
      matchId: 303,
      matchName: 'Zero Pool Match',
      outcome: 'home',
      amount: 1,
      odds: 2.1,
      useBonus: true,
      timestamp: 1234567901,
      liveMinute: 12,
    }),
  });

  const res = await POST(req);
  const json = await res.json();

  expect(res.status).toBe(403);
  expect(json.code).toBe('risk_trial_funds_first_bet_blocked');
  expect(json.error).toContain('體驗金不可作為該場賭池首注');
});
```

- [ ] **Step 2: Run the API test file**

```bash
npx jest --runInBand --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 3: Commit the backend regression test**

```bash
git add src/app/api/bets/route.test.ts
git commit -m "test: document pool-wide trial first bet rule"
```

## Task 6: Final Verification And Diagnostics

**Files:**
- Modify if needed: `src/app/[locale]/page.tsx`
- Modify if needed: `src/app/page.tsx`
- Modify if needed: `src/app/[locale]/page.test.tsx`
- Modify if needed: `src/app/page.test.tsx`
- Modify if needed: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Run the focused test suite**

```bash
npx jest --runInBand --watch=false --runTestsByPath src/app/[locale]/page.test.tsx src/app/page.test.tsx src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/[locale]/page.test.tsx
PASS src/app/page.test.tsx
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 2: Check diagnostics in edited files**

Use diagnostics on:

- `src/lib/bet-preview.ts`
- `src/app/[locale]/page.tsx`
- `src/app/page.tsx`
- `src/app/[locale]/page.test.tsx`
- `src/app/page.test.tsx`
- `src/app/api/bets/route.test.ts`

Expected:

```text
No new diagnostics introduced by the change.
```

- [ ] **Step 3: Manual verification checklist**

```text
1. Open a match with existing pool activity.
2. Select an outcome and type 0.01 / 0.02 / 0.05.
3. Confirm all three odds buttons change immediately.
4. Switch to trial funds and repeat on a non-zero pool match.
5. Confirm trial funds still cannot open an empty pool.
6. Confirm a first-bet or single-sided pool keeps initial odds while typing.
7. Confirm real-money bets are unaffected by the trial-funds cap rule.
```

- [ ] **Step 4: Final squash-free commit**

```bash
git add src/lib/bet-preview.ts src/app/[locale]/page.tsx src/app/page.tsx src/app/[locale]/page.test.tsx src/app/page.test.tsx src/app/api/bets/route.test.ts
git commit -m "feat: align live odds preview with pool guardrails"
```

## Self-Review

### Spec Coverage

- Immediate three-button odds refresh: covered by Tasks 2, 3, and 4.
- Real-money preview must use net pool contribution: covered by Tasks 1, 2, 3, and 4.
- Trial-funds preview must use full entered amount: covered by Tasks 1, 2, 3, and 4.
- First-bet and single-sided pools must keep initial odds: covered by Tasks 2, 3, and 4.
- Trial-funds guardrails remain unchanged: covered by Task 5 and preserved in Tasks 3 and 4.
- Pool-wide first-bet definition: covered by Task 5.

### Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation markers remain.
- All steps include explicit files, commands, and code.

### Type Consistency

- Shared helper names are consistent:
  - `getProjectedPoolIncrement`
  - `isInitialPoolState`
- The same names are used in both page implementations and test descriptions.
