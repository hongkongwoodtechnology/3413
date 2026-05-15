# Trial Funds First-Bet Button Disable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable `confirm prediction` on both home pages when trial funds would become the first bet in a zero-pool match, without showing an error message.

**Architecture:** Reuse the existing frontend pool data already available in each page to derive a boolean that blocks only the confirm button. Keep backend first-bet rejection unchanged as the final guardrail, and replace the old alert-based UI regression tests with direct button-state assertions.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, Testing Library

---

## File Map

- Modify: `src/app/page.tsx`
  - Owns the non-locale home-page betting form and current `confirm` button disabled logic in `betActionNode`.
- Modify: `src/app/[locale]/page.tsx`
  - Owns the localized home-page betting form and mirrors the same `confirm` button logic.
- Modify: `src/app/page.test.tsx`
  - Holds the non-locale home-page regression tests and already has match/trial-balance fixtures.
- Modify: `src/app/[locale]/page.test.tsx`
  - Holds the locale home-page regression tests and mirrors the same fixture structure.

## Task 1: Non-Locale Page Button Disable

**Files:**
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the non-locale alert regression with button-state tests**

Update `src/app/page.test.tsx` by replacing the existing `/api/bets rejects a trial-funds bet` test with three direct button-state tests.

```tsx
const ZERO_POOL_MATCH_FIXTURE = [
  {
    ...MATCH_FIXTURE[0],
    pools: { home: 0, draw: 0, away: 0 },
    marketData: {
      ...MATCH_FIXTURE[0].marketData,
      realTotalPool: 0,
      pools: { home: 0, draw: 0, away: 0 },
    },
  },
];

async function openTrialPredictionModal() {
  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  return screen.getByRole("button", { name: "btn.confirm" });
}

it("disables confirm when trial funds would open an empty pool", async () => {
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  window.history.replaceState({}, "", "/");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });

  const confirmButton = await openTrialPredictionModal();
  expect(confirmButton).toBeDisabled();
});

it("keeps confirm enabled when trial funds are used on a non-zero pool match", async () => {
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

  const confirmButton = await openTrialPredictionModal();
  expect(confirmButton).toBeEnabled();
});

it("keeps confirm enabled when real money opens an empty pool", async () => {
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  window.history.replaceState({}, "", "/");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("100.00 USDT")).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  expect(screen.getByRole("button", { name: "btn.confirm" })).toBeEnabled();
});
```

- [ ] **Step 2: Run the non-locale test file and verify the new zero-pool trial-funds case fails**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/page.test.tsx
```

Expected:

```text
FAIL src/app/page.test.tsx
  disables confirm when trial funds would open an empty pool
  Expected element to be disabled
```

- [ ] **Step 3: Add the derived first-bet blocking boolean in the non-locale page**

Insert this `useMemo` in `src/app/page.tsx` near the other derived betting-state values, before `betActionNode`:

```tsx
  const isTrialFundsFirstBetBlocked = useMemo(() => {
    if (!useBonus || !currentMatch) return false;

    const currentRealPool = currentMatch.marketData
      ? currentMatch.marketData.realTotalPool
      : currentMatch.pools.home + currentMatch.pools.draw + currentMatch.pools.away;

    return currentRealPool === 0;
  }, [useBonus, currentMatch]);
```

Then update the existing confirm button in `betActionNode` from:

```tsx
        disabled={isProcessing || (!connected ? true : !amount) || txStatus === "success"}
```

to:

```tsx
        disabled={
          isProcessing ||
          (!connected ? true : !amount) ||
          txStatus === "success" ||
          isTrialFundsFirstBetBlocked
        }
```

And update the `betActionNode` dependency list from:

```tsx
  }, [projectedOdds, projectedOdds?.riskLevel, amount, txStatus, useBonus, trialBalance, isProcessing, connected, t, oddsEngine, handlePrediction]);
```

to:

```tsx
  }, [
    projectedOdds,
    projectedOdds?.riskLevel,
    amount,
    txStatus,
    useBonus,
    trialBalance,
    isProcessing,
    connected,
    t,
    oddsEngine,
    handlePrediction,
    isTrialFundsFirstBetBlocked,
  ]);
```

- [ ] **Step 4: Run the non-locale test file again and verify it passes**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/page.test.tsx
```

Expected:

```text
PASS src/app/page.test.tsx
  5 passed
```

- [ ] **Step 5: Check diagnostics for the edited non-locale files**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.test.tsx
```

Expected:

```text
No new diagnostics introduced
```

- [ ] **Step 6: Commit the non-locale change**

Run:

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: disable trial first bet on home page"
```

Expected:

```text
[main ...] feat: disable trial first bet on home page
```

## Task 2: Locale Page Button Disable

**Files:**
- Modify: `src/app/[locale]/page.test.tsx`
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Replace the locale alert regression with button-state tests**

Update `src/app/[locale]/page.test.tsx` by replacing the current localized rejection test with the same three button-state assertions.

```tsx
const ZERO_POOL_MATCH_FIXTURE = [
  {
    ...MATCH_FIXTURE[0],
    pools: { home: 0, draw: 0, away: 0 },
    marketData: {
      ...MATCH_FIXTURE[0].marketData,
      realTotalPool: 0,
      pools: { home: 0, draw: 0, away: 0 },
    },
  },
];

async function openTrialPredictionModal() {
  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  return screen.getByRole("button", { name: "btn.confirm" });
}

it("disables localized confirm when trial funds would open an empty pool", async () => {
  mockedLanguage = "zh-TW";
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  window.history.replaceState({}, "", "/zh-TW");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });

  const confirmButton = await openTrialPredictionModal();
  expect(confirmButton).toBeDisabled();
});

it("keeps localized confirm enabled when trial funds are used on a non-zero pool match", async () => {
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

  const confirmButton = await openTrialPredictionModal();
  expect(confirmButton).toBeEnabled();
});

it("keeps localized confirm enabled when real money opens an empty pool", async () => {
  mockedLanguage = "zh-TW";
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  (fetchLiveMatches as jest.Mock).mockResolvedValue(ZERO_POOL_MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  window.history.replaceState({}, "", "/zh-TW");

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("100.00 USDT")).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });

  expect(screen.getByRole("button", { name: "btn.confirm" })).toBeEnabled();
});
```

- [ ] **Step 2: Run the locale test file and verify the new zero-pool trial-funds case fails**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/[locale]/page.test.tsx
```

Expected:

```text
FAIL src/app/[locale]/page.test.tsx
  disables localized confirm when trial funds would open an empty pool
  Expected element to be disabled
```

- [ ] **Step 3: Add the same derived first-bet blocking boolean in the locale page**

Insert this `useMemo` in `src/app/[locale]/page.tsx` near the other derived betting-state values, before `betActionNode`:

```tsx
  const isTrialFundsFirstBetBlocked = useMemo(() => {
    if (!useBonus || !currentMatch) return false;

    const currentRealPool = currentMatch.marketData
      ? currentMatch.marketData.realTotalPool
      : currentMatch.pools.home + currentMatch.pools.draw + currentMatch.pools.away;

    return currentRealPool === 0;
  }, [useBonus, currentMatch]);
```

Then update the existing confirm button in `betActionNode` from:

```tsx
        disabled={isProcessing || (!connected ? true : !amount) || txStatus === "success"}
```

to:

```tsx
        disabled={
          isProcessing ||
          (!connected ? true : !amount) ||
          txStatus === "success" ||
          isTrialFundsFirstBetBlocked
        }
```

And update the `betActionNode` dependency list from:

```tsx
  }, [projectedOdds, projectedOdds?.riskLevel, amount, txStatus, useBonus, trialBalance, isProcessing, connected, t, oddsEngine, handlePrediction]);
```

to:

```tsx
  }, [
    projectedOdds,
    projectedOdds?.riskLevel,
    amount,
    txStatus,
    useBonus,
    trialBalance,
    isProcessing,
    connected,
    t,
    oddsEngine,
    handlePrediction,
    isTrialFundsFirstBetBlocked,
  ]);
```

- [ ] **Step 4: Run the locale test file again and verify it passes**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/[locale]/page.test.tsx
```

Expected:

```text
PASS src/app/[locale]/page.test.tsx
  16 passed
```

- [ ] **Step 5: Check diagnostics for the edited locale files**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/[locale]/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/[locale]/page.test.tsx
```

Expected:

```text
No new diagnostics introduced
```

- [ ] **Step 6: Commit the locale change**

Run:

```bash
git add src/app/[locale]/page.tsx src/app/[locale]/page.test.tsx
git commit -m "feat: disable trial first bet on localized home page"
```

Expected:

```text
[main ...] feat: disable trial first bet on localized home page
```

## Task 3: Final Verification

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Run both focused page test files together**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/page.test.tsx src/app/[locale]/page.test.tsx
```

Expected:

```text
PASS src/app/page.test.tsx
PASS src/app/[locale]/page.test.tsx
```

- [ ] **Step 2: Verify the backend-rule contract is untouched by this UI-only change**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 3: Confirm only the intended files changed before handoff**

Run:

```bash
git status --short
```

Expected relevant entries:

```text
M src/app/page.tsx
M src/app/[locale]/page.tsx
M src/app/page.test.tsx
M src/app/[locale]/page.test.tsx
```

If unrelated repo noise exists, do not revert it; just confirm the four intended files are present and keep them isolated in commits.

- [ ] **Step 4: Prepare handoff summary**

Include these points in the final handoff:

```text
- trial funds cannot confirm on zero-pool matches
- real money can still open empty pools
- trial funds can still confirm once the match pool is non-zero
- no new tooltip, alert, or inline message was added
- backend first-bet restriction remains unchanged
```

## Self-Review

- Spec coverage: covered silent button disable, pool-source priority, both page variants, and the explicit real-money/non-zero-pool acceptance checks.
- Placeholder scan: no `TODO`, `TBD`, or vague “write tests” steps remain; every code-edit step includes the concrete snippet to add or replace.
- Type consistency: `isTrialFundsFirstBetBlocked`, `currentMatch.marketData.realTotalPool`, and the existing `betActionNode` dependency arrays use the same names across both page variants and tests.
