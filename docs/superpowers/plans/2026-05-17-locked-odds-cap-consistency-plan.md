# Locked Odds Cap Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `15.0000` the real locked-odds cap for betting, with the same capped value shown in the active bet UI, submitted by the client, and stored by the backend.

**Architecture:** Add one shared locked-odds cap helper and use it at the page layer plus `/api/bets`. First lock down backend correctness with failing route tests and minimal implementation. Then update the non-locale page and its tests so the focused bet flow shows and submits the capped odds, and finally mirror the same behavior in the locale page.

**Tech Stack:** Next.js App Router, TypeScript, React, Jest, Testing Library

---

## File Map

- Create: `src/lib/locked-odds.ts`
  - Owns the shared `MAX_LOCKED_ODDS` constant plus the tiny clamp helper reused by frontend and backend.
- Modify: `src/app/api/bets/route.ts`
  - Applies the backend-side cap before validations, persistence, and payout calculation.
- Modify: `src/app/api/bets/route.test.ts`
  - Verifies `> 15` odds are clamped to `15` and `<= 15` odds are left unchanged.
- Modify: `src/app/page.tsx`
  - Applies the cap to the focused pre-bet flow: projected odds, selected odds, potential return, confirm label, and submitted `odds`.
- Modify: `src/app/page.test.tsx`
  - Verifies non-locale pre-bet UI surfaces and outgoing request payload all use the capped odds.
- Modify: `src/app/[locale]/page.tsx`
  - Mirrors the same page-layer behavior for locale routing.
- Modify: `src/app/[locale]/page.test.tsx`
  - Verifies locale and non-locale parity for the capped locked-odds flow.

## Task 1: Lock Down Backend Clamp Behavior With Tests

**Files:**
- Modify: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Write the failing backend test for clamping odds above 15**

Add this test after the existing locked-odds coverage in `src/app/api/bets/route.test.ts`:

```ts
  it('clamps submitted locked odds above 15 before saving the bet and computing payout', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'locked-odds-cap-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'away',
        amount: 2,
        odds: 17.02,
        useBonus: false,
        timestamp: 1234567893,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.odds).toBe(15);
    expect(json.data.netPayout).toBe(30);
  });
```

- [ ] **Step 2: Add the unchanged-path test for odds already at or below 15**

Add this second test immediately after the clamp case:

```ts
  it('keeps submitted locked odds unchanged when they are already at or below 15', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'locked-odds-under-cap-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 2,
        odds: 6.808,
        useBonus: false,
        timestamp: 1234567894,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.odds).toBe(6.808);
    expect(json.data.netPayout).toBeCloseTo(13.616, 6);
  });
```

- [ ] **Step 3: Run the route test file and verify the new clamp test fails**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
FAIL src/app/api/bets/route.test.ts
  bets POST
    clamps submitted locked odds above 15 before saving the bet and computing payout
```

The failure should show the route still returning `17.02` instead of `15`.

## Task 2: Implement Shared Cap Helper And Backend Enforcement

**Files:**
- Create: `src/lib/locked-odds.ts`
- Modify: `src/app/api/bets/route.ts`
- Modify: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Create the shared locked-odds cap helper**

Create `src/lib/locked-odds.ts` with:

```ts
export const MAX_LOCKED_ODDS = 15;

export function clampLockedOdds(odds: number | null | undefined): number {
  if (typeof odds !== 'number' || !Number.isFinite(odds)) {
    return 1;
  }

  if (odds <= 0) {
    return 1;
  }

  return Math.min(odds, MAX_LOCKED_ODDS);
}
```

- [ ] **Step 2: Use the helper in `/api/bets` before validation and payout math**

Update the top of `POST()` in `src/app/api/bets/route.ts`:

```ts
import { clampLockedOdds } from '@/lib/locked-odds';
```

Then replace:

```ts
        const lockedOdds = odds || 1.0;
        const netPayout = getNetPayoutFromLockedOdds(amount, lockedOdds, !!useBonus);
```

with:

```ts
        const lockedOdds = clampLockedOdds(
            typeof odds === 'number' ? odds : 1.0
        );
        const netPayout = getNetPayoutFromLockedOdds(amount, lockedOdds, !!useBonus);
```

Do not change the rest of the validation flow. The existing solvency checks, liability updates, and saved bet payload should naturally use the capped `lockedOdds`.

- [ ] **Step 3: Run the route test file and verify it passes**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 4: Commit the backend clamp slice**

Run:

```bash
git add src/lib/locked-odds.ts src/app/api/bets/route.ts src/app/api/bets/route.test.ts
git commit -m "feat: clamp locked odds in bets api"
```

Expected:

```text
[main ...] feat: clamp locked odds in bets api
```

## Task 3: Add Failing Non-Locale Page Tests For Capped Display And Submission

**Files:**
- Modify: `src/app/page.test.tsx`

- [ ] **Step 1: Make the odds-engine mock configurable for high-odds scenarios**

Near the other mutable test doubles in `src/app/page.test.tsx`, add:

```ts
let mockedDisplayOdds = { home: 2.5, draw: 2, away: 1.5 };
let mockedLockedOdds = 1.5;
```

Then update the odds-engine mock methods to use those values:

```ts
    calculatePhaseAwareDisplayOdds() {
      return mockedDisplayOdds;
    }

    calculatePhaseAwareLockedOdds() {
      return { odds: mockedLockedOdds, riskLevel: "normal" };
    }

    calculateDynamicOdds() {
      return { odds: mockedLockedOdds, riskLevel: "normal" };
    }
```

Reset them in `beforeEach()`:

```ts
    mockedDisplayOdds = { home: 2.5, draw: 2, away: 1.5 };
    mockedLockedOdds = 1.5;
```

- [ ] **Step 2: Write the failing non-locale UI + submission test**

Add this focused regression test to `src/app/page.test.tsx`:

```ts
  it("caps focused bet odds to 15 across the non-locale pre-bet flow and submitted payload", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSkipChainProgress = true;
    mockedDisplayOdds = { home: 17.02, draw: 2, away: 1.5 };
    mockedLockedOdds = 17.02;
    (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    window.history.replaceState({}, "", "/");

    const fetchSpy = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/balance?address=")) {
        return makeJsonResponse({ success: true, balance: 100 });
      }
      if (url.startsWith("/api/bets?address=")) {
        return makeJsonResponse({ success: true, data: [] });
      }
      if (url === "/api/bets" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.odds).toBe(15);
        return makeJsonResponse({
          success: true,
          data: { ...body, id: "bet-cap-test", odds: 15, netPayout: 60 },
        });
      }
      return makeJsonResponse({ success: true, data: [] });
    });
    global.fetch = fetchSpy as jest.Mock;

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Alpha FC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /2\.5/ })[0]);
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "4" },
    });

    await waitFor(() => {
      const buttonTexts = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttonTexts).toContain("outcome.home15");
    });

    expect(screen.getByRole("button", { name: /btn\.confirm · ×15\.0000/i })).toBeInTheDocument();
    expect(screen.getByText("×15.0000")).toBeInTheDocument();
    expect(screen.getByText("60.00 USDT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /btn\.confirm · ×15\.0000/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/bets",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
```

- [ ] **Step 3: Run the non-locale page test file and verify the new test fails**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/page.test.tsx
```

Expected:

```text
FAIL src/app/page.test.tsx
  caps focused bet odds to 15 across the non-locale pre-bet flow and submitted payload
```

The failure should show at least one raw `17.02` value still escaping into the UI or the outgoing request payload.

## Task 4: Implement Capped Locked Odds In The Non-Locale Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Reuse: `src/lib/locked-odds.ts`

- [ ] **Step 1: Import and derive one capped odds value in `page.tsx`**

Add:

```ts
import { MAX_LOCKED_ODDS, clampLockedOdds } from "@/lib/locked-odds";
```

Then derive capped values around the existing odds memo section:

```ts
  const cappedProjectedOdds = useMemo(() => {
    if (!projectedOdds) return null;
    return {
      ...projectedOdds,
      odds: clampLockedOdds(projectedOdds.odds),
    };
  }, [projectedOdds]);

  const selectedOdds = cappedProjectedOdds
    ? cappedProjectedOdds.odds
    : (selectedOutcome ? clampLockedOdds(currentOdds[selectedOutcome as keyof typeof currentOdds]) : 0);
```

Replace all active pre-bet flow references that currently use `projectedOdds` directly with `cappedProjectedOdds`:

- confirm button label
- locked odds row in the modal
- potential return preview
- `executePrediction(...)` call sites

For the confirm label, replace:

```ts
    const maxPreviewOdds = 15;
```

and:

```ts
      ? `${t('btn.confirm')} · ×${Math.min(projectedOdds.odds, maxPreviewOdds).toFixed(4)}`
```

with:

```ts
      ? `${t('btn.confirm')} · ×${cappedProjectedOdds.odds.toFixed(4)}`
```

- [ ] **Step 2: Cap the focused match-card odds shown during an active bet flow**

In the `matches.map(...)` rendering branch, cap the computed `matchOdds` values before they are rendered:

```ts
                        matchOdds = {
                          home: clampLockedOdds(matchOdds.home),
                          draw: clampLockedOdds(matchOdds.draw),
                          away: clampLockedOdds(matchOdds.away),
                        };
```

Place this immediately after each `matchOdds = ...` assignment block has finished, so the focused card never shows an above-15 pending odds while the modal shows `15.0000`.

- [ ] **Step 3: Submit the capped locked odds to `/api/bets`**

Ensure the bet submission path uses the capped value:

```ts
    if (cappedProjectedOdds?.riskLevel === 'refund_single_side') {
        await executePrediction(cappedProjectedOdds.odds);
        return;
    }

    await executePrediction(cappedProjectedOdds.odds);
```

and make sure the payload inside `executePrediction()` still sends:

```ts
                  odds: lockedOdds,
```

where `lockedOdds` is now the already capped value passed into the function.

- [ ] **Step 4: Run the non-locale page test file and verify it passes**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/page.test.tsx
```

Expected:

```text
PASS src/app/page.test.tsx
```

- [ ] **Step 5: Commit the non-locale page slice**

Run:

```bash
git add src/app/page.tsx src/app/page.test.tsx src/lib/locked-odds.ts
git commit -m "feat: cap locked odds in betting flow"
```

Expected:

```text
[main ...] feat: cap locked odds in betting flow
```

## Task 5: Add Failing Locale Parity Test

**Files:**
- Modify: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Mirror the configurable odds-engine mock in the locale test file**

Repeat the same mutable mock pattern from the non-locale test file in `src/app/[locale]/page.test.tsx`:

```ts
let mockedDisplayOdds = { home: 2.5, draw: 2, away: 1.5 };
let mockedLockedOdds = 1.5;
```

Use those variables inside:

```ts
calculatePhaseAwareDisplayOdds()
calculatePhaseAwareLockedOdds()
calculateDynamicOdds()
```

and reset them in `beforeEach()`.

- [ ] **Step 2: Add the failing locale regression test**

Add the locale equivalent of the non-locale regression:

```ts
  it("caps focused bet odds to 15 across the locale pre-bet flow and submitted payload", async () => {
    mockedConnected = true;
    mockedPublicKey = { toBase58: () => "wallet-111" };
    mockedSkipChainProgress = true;
    mockedDisplayOdds = { home: 17.02, draw: 2, away: 1.5 };
    mockedLockedOdds = 17.02;
    (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
    (getUSDTBalance as jest.Mock).mockResolvedValue(100);
    window.history.replaceState({}, "", "/en");

    const fetchSpy = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/balance?address=")) {
        return makeJsonResponse({ success: true, balance: 100 });
      }
      if (url.startsWith("/api/bets?address=")) {
        return makeJsonResponse({ success: true, data: [] });
      }
      if (url === "/api/bets" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.odds).toBe(15);
        return makeJsonResponse({
          success: true,
          data: { ...body, id: "bet-cap-test-locale", odds: 15, netPayout: 60 },
        });
      }
      return makeJsonResponse({ success: true, data: [] });
    });
    global.fetch = fetchSpy as jest.Mock;

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Alpha FC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /2\.5/ })[0]);
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "4" },
    });

    await waitFor(() => {
      const buttonTexts = screen.getAllByRole("button").map((button) => button.textContent);
      expect(buttonTexts).toContain("outcome.home15");
    });

    expect(screen.getByRole("button", { name: /btn\.confirm · ×15\.0000/i })).toBeInTheDocument();
    expect(screen.getByText("×15.0000")).toBeInTheDocument();
    expect(screen.getByText("60.00 USDT")).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the locale page test file and verify the new test fails**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/[locale]/page.test.tsx
```

Expected:

```text
FAIL src/app/[locale]/page.test.tsx
  caps focused bet odds to 15 across the locale pre-bet flow and submitted payload
```

## Task 6: Mirror The Cap Logic In The Locale Page

**Files:**
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/page.test.tsx`
- Reuse: `src/lib/locked-odds.ts`

- [ ] **Step 1: Mirror the non-locale capped odds changes into `src/app/[locale]/page.tsx`**

Apply the same pattern used in `src/app/page.tsx`:

```ts
import { MAX_LOCKED_ODDS, clampLockedOdds } from "@/lib/locked-odds";
```

Then mirror:

- `cappedProjectedOdds`
- capped `selectedOdds`
- capped confirm label
- capped modal locked odds
- capped potential return preview
- capped `executePrediction(...)` call sites
- capped focused `matchOdds`

The locale page should remain a functional mirror of the non-locale page.

- [ ] **Step 2: Run the locale page test file and verify it passes**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/[locale]/page.test.tsx
```

Expected:

```text
PASS src/app/[locale]/page.test.tsx
```

- [ ] **Step 3: Commit the locale parity slice**

Run:

```bash
git add src/app/[locale]/page.tsx src/app/[locale]/page.test.tsx src/lib/locked-odds.ts
git commit -m "feat: align locale locked odds cap"
```

Expected:

```text
[main ...] feat: align locale locked odds cap
```

## Task 7: Final Verification

**Files:**
- Modify: `src/lib/locked-odds.ts`
- Modify: `src/app/api/bets/route.ts`
- Modify: `src/app/api/bets/route.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Run all focused test files together**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts src/app/page.test.tsx src/app/[locale]/page.test.tsx
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
PASS src/app/page.test.tsx
PASS src/app/[locale]/page.test.tsx
```

- [ ] **Step 2: Check diagnostics for all edited production files**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/lib/locked-odds.ts
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/bets/route.ts
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/[locale]/page.tsx
```

Expected:

```text
No new diagnostics introduced
```

- [ ] **Step 3: Confirm the working tree does not include unexpected code edits**

Run:

```bash
git status --short
```

Expected relevant result:

```text
M data/bets_db.json
M data/market_db.json
M data/reserve.json
```

The exact data noise may differ, but the implementation files in this plan should already be committed and no stray code files should remain modified.

- [ ] **Step 4: Prepare handoff summary**

Include these points in the final handoff:

```text
- 15x is now the actual locked-odds cap, not only a button-label cap
- active pre-bet UI surfaces now show the same capped odds
- the client submits capped odds to /api/bets
- /api/bets clamps any incoming odds above 15 before saving and payout math
- locale and non-locale pages remain aligned
```

## Self-Review

- Spec coverage: the plan covers the frontend active pre-bet flow, capped submission payload, backend clamp enforcement, unchanged behavior below the cap, and locale parity.
- Placeholder scan: no `TODO`, `TBD`, or vague “add tests” steps remain; every task includes explicit code or commands.
- Type consistency: `MAX_LOCKED_ODDS`, `clampLockedOdds`, `cappedProjectedOdds`, and `/api/bets` `odds` are named consistently across the planned files.
