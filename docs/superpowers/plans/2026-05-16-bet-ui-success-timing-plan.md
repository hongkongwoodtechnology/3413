# Bet UI Success Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the betting UI update pools, bet history, balances, and success state only after `/api/bets` confirms the bet was saved.

**Architecture:** Keep the existing page-level submission flow, but move `/api/bets` from a fire-and-forget side effect into the main awaited control path. On both `src/app/page.tsx` and `src/app/[locale]/page.tsx`, treat backend persistence as the gate for local success mutations, then keep referral side effects behind the same gate.

**Tech Stack:** Next.js App Router, TypeScript, React Testing Library, Jest

---

## File Map

- Modify: `src/app/page.test.tsx`
  - Expand the non-locale page test harness so it can drive a connected-wallet betting flow and assert failed `/api/bets` responses do not show success or deduct balances.
- Modify: `src/app/page.tsx`
  - Reorder the non-locale betting flow so local success state only commits after `/api/bets` succeeds.
- Modify: `src/app/[locale]/page.test.tsx`
  - Mirror the connected-wallet betting harness for the localized page and assert the same rejection/success behavior.
- Modify: `src/app/[locale]/page.tsx`
  - Apply the same awaited-save ordering to the localized page.
- Create: `docs/superpowers/plans/2026-05-16-bet-ui-success-timing-plan.md`
  - This implementation plan.

### Task 1: Add Failing Non-Locale Betting Tests

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.test.tsx`

- [ ] **Step 1: Expand the non-locale test harness for a connected betting flow**

Replace the top-level wallet and support mocks with stateful test variables so the page can render a real betting path:

```ts
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getTrialUSDTBalance, getUSDTBalance } from "@/lib/solana";

let mockedLanguage = "en";
let mockedConnected = false;
let mockedPublicKey: { toBase58: () => string } | null = null;
let mockedSendTransaction = jest.fn();
let mockedSkipChainProgress = false;

jest.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    connected: mockedConnected,
    connecting: false,
    disconnecting: false,
    publicKey: mockedPublicKey,
    wallet: { adapter: { name: "Mock Wallet" } },
    sendTransaction: mockedSendTransaction,
  }),
  useConnection: () => ({
    connection: {},
  }),
}));

jest.mock("@/hooks/useReferralLandingGate", () => ({
  useReferralLandingGate: () => ({
    referrerId: null,
    shouldShowReferralLanding: false,
    dismissReferralLanding: jest.fn(),
  }),
}));

jest.mock("@/lib/bet-progress", () => ({
  shouldSkipChainProgressForBet: () => mockedSkipChainProgress,
}));

const MATCH_FIXTURE = [
  {
    id: 101,
    league: "World Cup",
    category: "elite",
    home: "Alpha FC",
    away: "Beta FC",
    date: "2026-05-16 20:00",
    liveMinute: 12,
    status: "live",
    score: "0-0",
    pools: { home: 25, draw: 20, away: 15 },
    marketData: {
      realTotalPool: 60,
      liabilities: { home: 40, draw: 30, away: 20 },
      pools: { home: 25, draw: 20, away: 15 },
      attractionWindowUsed: { home: 0, draw: 0, away: 0 },
      initialOdds: { home: 1.5, draw: 2.5, away: 3.5 },
    },
  },
];

function makeJsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 403,
    json: async () => payload,
  } as Response;
}
```

Update `beforeEach` so the betting tests start from a connected wallet with visible balances:

```ts
beforeEach(() => {
  jest.clearAllMocks();
  mockedLanguage = "en";
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  mockedSendTransaction = jest.fn().mockResolvedValue("sig-111");
  mockedSkipChainProgress = true;
  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  window.history.replaceState({}, "", "/");
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/balance?address=")) {
      return makeJsonResponse({ success: true, balance: 100 });
    }
    if (url === "/api/bets") {
      return makeJsonResponse({ success: true, data: { id: "bet-1" } });
    }
    if (url === "/api/referral") {
      return makeJsonResponse({ success: true, newBalance: 11 });
    }
    return makeJsonResponse({ success: true, data: [] });
  }) as jest.Mock;
});
```

- [ ] **Step 2: Add a failing test for rejected trial-funds save**

Append this test under the existing referral-landing tests:

```ts
it("does not show success or deduct trial balance when /api/bets rejects a trial-funds bet", async () => {
  (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/balance?address=")) {
      return makeJsonResponse({ success: true, balance: 100 });
    }
    if (url === "/api/bets") {
      return makeJsonResponse(
        { success: false, error: "體驗金不可作為該場賭池首注" },
        false
      );
    }
    if (url === "/api/referral") {
      return makeJsonResponse({ success: true, newBalance: 11 });
    }
    return makeJsonResponse({ success: true, data: [] });
  });

  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "btn.confirm" }));

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("體驗金不可作為該場賭池首注")
    );
  });

  expect(screen.queryByText("modal.prediction_placed")).toBeNull();
  expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  expect(screen.queryByText(/Alpha FC vs Beta FC/)).toBeNull();
});
```

- [ ] **Step 3: Add a failing success-path test for accepted trial-funds save**

Append this test after the rejection case:

```ts
it("shows success and updates visible trial balance only after /api/bets accepts the trial-funds bet", async () => {
  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "btn.confirm" }));

  await waitFor(() => {
    expect(screen.getByText("modal.prediction_placed")).toBeInTheDocument();
  });

  expect(global.fetch).toHaveBeenCalledWith(
    "/api/bets",
    expect.objectContaining({ method: "POST" })
  );
});
```

- [ ] **Step 4: Add a failing real-money rejection test so local USDT does not deduct**

Append this test after the trial-funds success test:

```ts
it("does not deduct local real-money balance when chain send succeeds but /api/bets rejects", async () => {
  mockedSkipChainProgress = false;
  mockedSendTransaction = jest.fn().mockResolvedValue("sig-real-1");

  (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://")) {
      return makeJsonResponse({ result: { value: { blockhash: "blockhash-1" } } });
    }
    if (url === "/api/balance?address=wallet-111") {
      return makeJsonResponse({ success: true, balance: 100 });
    }
    if (url === "/api/bets") {
      return makeJsonResponse({ success: false, error: "backend rejected" }, false);
    }
    if (url.startsWith("/api/referral?address=")) {
      return makeJsonResponse({ success: true, data: { commissionRate: 0.3 } });
    }
    if (url === "/api/referral") {
      return makeJsonResponse({ success: true });
    }
    return makeJsonResponse({ success: true, data: [] });
  });

  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText(/100 USDT/)).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "btn.confirm" }));

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("backend rejected")
    );
  });

  expect(screen.getByText(/100 USDT/)).toBeInTheDocument();
  expect(screen.queryByText("modal.prediction_placed")).toBeNull();
});
```

- [ ] **Step 5: Run the non-locale page test file and verify the new cases fail for the right reason**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/page.test.tsx
```

Expected:

```text
FAIL src/app/page.test.tsx
  Home referral landing
    ✕ does not show success or deduct trial balance when /api/bets rejects a trial-funds bet
```

- [ ] **Step 6: Commit the failing non-locale tests**

```bash
git add src/app/page.test.tsx
git commit -m "test: cover non-locale bet save timing"
```

### Task 2: Gate Non-Locale Success State On `/api/bets`

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.test.tsx`

- [ ] **Step 1: Replace the fire-and-forget `/api/bets` save with an awaited save helper**

Inside `executePrediction`, replace the current `fetch('/api/bets').then(...).catch(...)` block with awaited persistence:

```ts
          const saveRes = await fetch("/api/bets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
                  typeof saveJson.error === "string" && saveJson.error.length > 0
                      ? saveJson.error
                      : saveRes.statusText || "Failed to save bet to backend."
              );
          }
```

Delete this old block entirely:

```ts
          fetch('/api/bets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  ...newBet,
                  odds: lockedOdds,
                  userAddress: currentAddress,
                  signature: txSignature,
                  liveMinute: matchInfo.liveMinute
              })
          })
          .then(async res => {
              const json = await res.json().catch(() => ({}));
              if (!res.ok || !json.success) {
                  console.error('Bet save rejected by server:', json.error || res.statusText);
                  return;
              }
              setBetsRefreshKey(k => k + 1);
          })
          .catch(err => console.error('Failed to save bet to backend:', err));
```

- [ ] **Step 2: Move all local success mutations behind the awaited save**

Move these blocks so they run only after the new awaited save succeeds:

```ts
      setMatchesIfChanged(prevMatches => prevMatches.map(m => {
          if (m.id === selectedMatchId) {
              const updatedMatch = { ...m };

              if (updatedMatch.marketData && projectedOdds) {
                  const md = updatedMatch.marketData;
                  const effectivePool = !useBonus ? poolAmountForDisplay : betAmountNum;
                  updatedMatch.marketData = {
                      ...md,
                      realTotalPool: md.realTotalPool + effectivePool,
                      liabilities: {
                          ...md.liabilities,
                          [outcome as string]:
                              md.liabilities[outcome as keyof typeof md.liabilities] +
                              effectivePool * lockedOdds,
                      },
                      pools: {
                          ...md.pools,
                          [outcome]: md.pools[outcome as keyof typeof md.pools] + effectivePool,
                      },
                  };
              }

              const effectivePoolLegacy = !useBonus ? poolAmountForDisplay : betAmountNum;
              updatedMatch.pools = {
                  ...m.pools,
                  [outcome]: m.pools[outcome as keyof typeof m.pools] + effectivePoolLegacy,
              };

              return updatedMatch;
          }
          return m;
      }));

      setMyBets(prev => [newBet, ...prev]);
      setBetsRefreshKey(k => k + 1);

      if (useBonus) {
          setTrialBalance(prev => prev - betAmountNum);
      } else {
          setBalance(prev => prev - betAmountNum);
      }

      setTxStatus("success");
```

The order must be:

```text
build newBet
resolve currentAddress
await /api/bets success
update local match pools
update local bet list
trigger post-save side effects
deduct local displayed balance
set success state
```

- [ ] **Step 3: Keep referral side effects after save success only**

For trial-funds bonus persistence, switch to the already parsed `saveJson` data instead of the deleted `.then(...)` branch:

```ts
          if (useBonus && saveJson.data?.id) {
              fetch("/api/referral", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                      action: "record_bonus_bet",
                      userAddress: currentAddress,
                      betId: saveJson.data.id,
                      amount: betAmountNum,
                  }),
              })
                  .then(res => res.json())
                  .then(data => {
                      if (data.success && typeof data.newBalance === "number") {
                          setTrialBalance(data.newBalance);
                      }
                  })
                  .catch(err => console.error("Failed to persist bonus bet ledger:", err));
          }
```

Keep the real-money referral notification after the save succeeds as well:

```ts
          if (!useBonus) {
              const storedReferrer = localStorage.getItem(
                  getBoundReferrerStorageKey(currentAddress)
              );
              fetch("/api/referral", {
                  method: "POST",
                  body: JSON.stringify({
                      action: "place_bet",
                      userAddress: currentAddress,
                      referrerAddress: storedReferrer,
                      betAmount: betAmountNum,
                      poolAmount: poolAmountForDisplay,
                      houseAmount: houseAmountForDisplay,
                      commissionAmount: commissionAmountForDisplay,
                      supportAmount: supportAmountForDisplay,
                      signature: txSignature,
                  }),
              })
                  .then(res => res.json())
                  .then(data => {
                      if (data.success) {
                          getTrialUSDTBalance(currentAddress).then(newBal => {
                              if (newBal > trialBalance) {
                                  setTrialBalance(newBal);
                              }
                          });
                      }
                  })
                  .catch(err => console.error("Failed to process referral bet:", err));
          }
```

- [ ] **Step 4: Run the non-locale tests and verify they pass**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/page.test.tsx
```

Expected:

```text
PASS src/app/page.test.tsx
```

- [ ] **Step 5: Run diagnostics for the edited non-locale files**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.test.tsx
```

Expected:

```text
No new diagnostics.
```

- [ ] **Step 6: Commit the non-locale implementation**

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: gate non-locale bet success on save"
```

### Task 3: Add Failing Localized Betting Tests

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.test.tsx`

- [ ] **Step 1: Mirror the connected betting harness into the localized test file**

Make the same harness changes used in `src/app/page.test.tsx` inside `src/app/[locale]/page.test.tsx`:

```ts
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getTrialUSDTBalance, getUSDTBalance } from "@/lib/solana";

let mockedLanguage = "zh-TW";
let mockedConnected = false;
let mockedPublicKey: { toBase58: () => string } | null = null;
let mockedSendTransaction = jest.fn();
let mockedSkipChainProgress = false;

jest.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    connected: mockedConnected,
    connecting: false,
    disconnecting: false,
    publicKey: mockedPublicKey,
    wallet: { adapter: { name: "Mock Wallet" } },
    sendTransaction: mockedSendTransaction,
  }),
  useConnection: () => ({
    connection: {},
  }),
}));

jest.mock("@/hooks/useReferralLandingGate", () => ({
  useReferralLandingGate: () => ({
    referrerId: null,
    shouldShowReferralLanding: false,
    dismissReferralLanding: jest.fn(),
  }),
}));

jest.mock("@/lib/bet-progress", () => ({
  shouldSkipChainProgressForBet: () => mockedSkipChainProgress,
}));
```

Reuse the same `MATCH_FIXTURE` and `makeJsonResponse()` helper, but keep `mockedLanguage = "zh-TW"` in `beforeEach`.

- [ ] **Step 2: Add a failing localized rejection test**

Append this test:

```ts
it("does not show localized success UI when /api/bets rejects the bet", async () => {
  mockedLanguage = "zh-TW";
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  mockedSkipChainProgress = true;

  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/balance?address=")) {
      return makeJsonResponse({ success: true, balance: 100 });
    }
    if (url === "/api/bets") {
      return makeJsonResponse({ success: false, error: "體驗金不可作為該場賭池首注" }, false);
    }
    return makeJsonResponse({ success: true, data: [] });
  });

  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "btn.confirm" }));

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("體驗金不可作為該場賭池首注")
    );
  });

  expect(screen.queryByText("modal.prediction_placed")).toBeNull();
  expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
});
```

- [ ] **Step 3: Add a failing localized success-path test**

Append this test:

```ts
it("shows localized success UI only after /api/bets accepts the bet", async () => {
  mockedLanguage = "zh-TW";
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  mockedSkipChainProgress = true;

  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/balance?address=")) {
      return makeJsonResponse({ success: true, balance: 100 });
    }
    if (url === "/api/bets") {
      return makeJsonResponse({ success: true, data: { id: "bet-zh-1" } });
    }
    if (url === "/api/referral") {
      return makeJsonResponse({ success: true, newBalance: 11 });
    }
    return makeJsonResponse({ success: true, data: [] });
  });

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "label.trial_funds" }));
  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "btn.confirm" }));

  await waitFor(() => {
    expect(screen.getByText("modal.prediction_placed")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the localized page test file and verify the new cases fail before implementation**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/[locale]/page.test.tsx
```

Expected:

```text
FAIL src/app/[locale]/page.test.tsx
  [locale] Home referral landing
    ✕ does not show localized success UI when /api/bets rejects the bet
```

- [ ] **Step 5: Commit the failing localized tests**

```bash
git add src/app/[locale]/page.test.tsx
git commit -m "test: cover localized bet save timing"
```

### Task 4: Gate Localized Success State On `/api/bets`

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.test.tsx`

- [ ] **Step 1: Apply the same awaited-save pattern in the localized page**

In `src/app/[locale]/page.tsx`, make the same structural change made in the non-locale page:

```ts
          const saveRes = await fetch("/api/bets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
                  typeof saveJson.error === "string" && saveJson.error.length > 0
                      ? saveJson.error
                      : saveRes.statusText || "Failed to save bet to backend."
              );
          }
```

Delete the existing `.then(...).catch(...)` save branch and move all local success mutations after the awaited save, matching the non-locale order exactly.

- [ ] **Step 2: Keep the localized referral and bonus side effects behind the same gate**

Use this post-save ordering in the localized page too:

```ts
          setMatchesIfChanged(prevMatches => prevMatches.map(m => {
              if (m.id === selectedMatchId) {
                  const updatedMatch = { ...m };

                  if (updatedMatch.marketData && projectedOdds) {
                      const md = updatedMatch.marketData;
                      const effectivePool = !useBonus ? poolAmountForDisplay : betAmountNum;
                      updatedMatch.marketData = {
                          ...md,
                          realTotalPool: md.realTotalPool + effectivePool,
                          liabilities: {
                              ...md.liabilities,
                              [outcome as string]:
                                  md.liabilities[outcome as keyof typeof md.liabilities] +
                                  effectivePool * lockedOdds,
                          },
                          pools: {
                              ...md.pools,
                              [outcome]: md.pools[outcome as keyof typeof md.pools] + effectivePool,
                          },
                      };
                  }

                  const effectivePoolLegacy = !useBonus ? poolAmountForDisplay : betAmountNum;
                  updatedMatch.pools = {
                      ...m.pools,
                      [outcome]: m.pools[outcome as keyof typeof m.pools] + effectivePoolLegacy,
                  };

                  return updatedMatch;
              }
              return m;
          }));
          setMyBets(prev => [newBet, ...prev]);
          setBetsRefreshKey(k => k + 1);

          if (useBonus && saveJson.data?.id) {
              fetch("/api/referral", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                      action: "record_bonus_bet",
                      userAddress: currentAddress,
                      betId: saveJson.data.id,
                      amount: betAmountNum,
                  }),
              })
                  .then(res => res.json())
                  .then(data => {
                      if (data.success && typeof data.newBalance === "number") {
                          setTrialBalance(data.newBalance);
                      }
                  })
                  .catch(err => console.error("Failed to persist bonus bet ledger:", err));
          }

          if (!useBonus) {
              const storedReferrer = localStorage.getItem(
                  getBoundReferrerStorageKey(currentAddress)
              );
              fetch("/api/referral", {
                  method: "POST",
                  body: JSON.stringify({
                      action: "place_bet",
                      userAddress: currentAddress,
                      referrerAddress: storedReferrer,
                      betAmount: betAmountNum,
                      poolAmount: poolAmountForDisplay,
                      houseAmount: houseAmountForDisplay,
                      commissionAmount: commissionAmountForDisplay,
                      supportAmount: supportAmountForDisplay,
                      signature: txSignature,
                  }),
              }).catch(err => console.error("Failed to process referral bet:", err));
          }

          if (useBonus) {
              setTrialBalance(prev => prev - betAmountNum);
          } else {
              setBalance(prev => prev - betAmountNum);
          }

          setTxStatus("success");
```

- [ ] **Step 3: Run the localized tests and verify they pass**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/[locale]/page.test.tsx
```

Expected:

```text
PASS src/app/[locale]/page.test.tsx
```

- [ ] **Step 4: Run diagnostics for the localized files**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/[locale]/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/[locale]/page.test.tsx
```

Expected:

```text
No new diagnostics.
```

- [ ] **Step 5: Commit the localized implementation**

```bash
git add src/app/[locale]/page.tsx src/app/[locale]/page.test.tsx
git commit -m "feat: gate localized bet success on save"
```

### Task 5: Regression Verification And Handoff

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.test.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.test.tsx`

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

- [ ] **Step 2: Confirm the rejection contract is visible in tests**

Keep these assertions present in the final test files:

```ts
expect(alertSpy).toHaveBeenCalledWith(
  expect.stringContaining("體驗金不可作為該場賭池首注")
);
expect(screen.queryByText("modal.prediction_placed")).toBeNull();
expect(screen.getByText("15.00 tUSDT")).toBeInTheDocument();
```

and:

```ts
expect(screen.getByText(/100 USDT/)).toBeInTheDocument();
expect(screen.queryByText("modal.prediction_placed")).toBeNull();
```

- [ ] **Step 3: Check staged files before any extra commit**

Run:

```bash
git diff --name-only --cached
```

Expected:

```text
No output if everything is already committed, or only these files if a commit is still pending:
src/app/page.tsx
src/app/page.test.tsx
src/app/[locale]/page.tsx
src/app/[locale]/page.test.tsx
```

- [ ] **Step 4: Prepare handoff notes**

Record these verification points in the implementation handoff:

```text
- Rejected /api/bets responses no longer surface as successful UI state.
- Trial-funds rejection leaves the visible tUSDT balance unchanged.
- Real-money rejection leaves the visible USDT balance unchanged.
- Accepted /api/bets responses still show modal.prediction_placed and update local state.
- Both src/app/page.tsx and src/app/[locale]/page.tsx now gate success on backend save confirmation.
```
