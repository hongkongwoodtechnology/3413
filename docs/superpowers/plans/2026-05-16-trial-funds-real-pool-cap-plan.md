# Trial Funds Real-Pool Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trial-funds cumulative 15% cap use the current real-money pool (`realTotalPool`) as its dynamic base while preserving the separate first-bet restriction.

**Architecture:** Keep the API structure and error contract intact, but change the cap base from the legacy summed display pools to `currentMarket.realTotalPool`. Update the route tests to prove cumulative usage still applies, the cap grows when real-money liquidity grows, and the first-bet rule still fires first on zero real-money pool.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Jest

---

## File Map

- Modify: `src/app/api/bets/route.ts`
  - Owns trial-funds first-bet validation, the 15% cap validation, and the backend rejection payload.
- Modify: `src/app/api/bets/route.test.ts`
  - Owns focused backend coverage for trial-funds cap, first-bet rejection, and real-money unaffected behavior.

## Task 1: Rewrite Backend Tests Around `realTotalPool`

**Files:**
- Modify: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Rewrite the current cap tests to use explicit real-money pool fixtures**

Replace the two current cumulative-cap tests so they define the match pool through `marketDb.realTotalPool` rather than relying on the default fixture values.

Use these test bodies in `src/app/api/bets/route.test.ts`:

```ts
  it('accepts a trial-funds bet when cumulative match usage stays within 15% of the current real-money pool', async () => {
    mockDatabases({
      betsDb: {
        'existing-trial-user': [
          {
            id: 'bet-existing-1',
            userAddress: 'existing-trial-user',
            matchId: 101,
            matchName: 'A vs B',
            outcome: 'draw',
            amount: 20,
            odds: 3.4,
            netPayout: 68,
            status: 'pending',
            useBonus: true,
            timestamp: 1234567000,
          },
        ],
      },
      marketDb: {
        '101': {
          realTotalPool: 200,
          liabilities: { home: 80, draw: 70, away: 50 },
          pools: { home: 70, draw: 65, away: 65 },
          initialOdds: { home: 2.1, draw: 3.2, away: 3.6 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-under-cap',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 10,
        odds: 2.15,
        useBonus: true,
        timestamp: 1234567895,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.useBonus).toBe(true);
  });

  it('rejects a trial-funds bet when cumulative match usage exceeds 15% of the current real-money pool', async () => {
    mockDatabases({
      betsDb: {
        'existing-trial-user': [
          {
            id: 'bet-existing-1',
            userAddress: 'existing-trial-user',
            matchId: 101,
            matchName: 'A vs B',
            outcome: 'draw',
            amount: 30,
            odds: 3.4,
            netPayout: 102,
            status: 'pending',
            useBonus: true,
            timestamp: 1234567000,
          },
        ],
      },
      marketDb: {
        '101': {
          realTotalPool: 200,
          liabilities: { home: 80, draw: 70, away: 50 },
          pools: { home: 70, draw: 65, away: 65 },
          initialOdds: { home: 2.1, draw: 3.2, away: 3.6 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-over-cap',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 1,
        odds: 2.15,
        useBonus: true,
        timestamp: 1234567896,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe('risk_trial_funds_cap');
    expect(json.trialFundsCap).toBe(30);
    expect(json.trialFundsUsed).toBe(30);
    expect(json.trialFundsRemaining).toBe(0);
    expect(json.error).toContain('體驗金超出單場上限');
  });
```

- [ ] **Step 2: Add a regression test showing cap expansion after real-money pool growth**

Insert this new test after the rejection case:

```ts
  it('accepts a new trial-funds bet when real-money pool growth expands the cumulative cap', async () => {
    mockDatabases({
      betsDb: {
        'existing-trial-user': [
          {
            id: 'bet-existing-1',
            userAddress: 'existing-trial-user',
            matchId: 202,
            matchName: 'Cap Growth Match',
            outcome: 'away',
            amount: 30,
            odds: 2.8,
            netPayout: 84,
            status: 'pending',
            useBonus: true,
            timestamp: 1234567100,
          },
        ],
      },
      marketDb: {
        '202': {
          realTotalPool: 240,
          liabilities: { home: 90, draw: 60, away: 70 },
          pools: { home: 80, draw: 80, away: 80 },
          initialOdds: { home: 2.1, draw: 3.2, away: 3.6 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-growth',
        matchId: 202,
        matchName: 'Cap Growth Match',
        outcome: 'home',
        amount: 6,
        odds: 2.15,
        useBonus: true,
        timestamp: 1234567996,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.useBonus).toBe(true);
  });
```

- [ ] **Step 3: Run the route test file and verify the old implementation now fails**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
FAIL src/app/api/bets/route.test.ts
  accepts a trial-funds bet when cumulative match usage stays within 15% of the current real-money pool
  accepts a new trial-funds bet when real-money pool growth expands the cumulative cap
```

The failure should reflect that the API is still using the legacy summed pools instead of `realTotalPool`.

- [ ] **Step 4: Commit the failing-test phase**

Run:

```bash
git add src/app/api/bets/route.test.ts
git commit -m "test: cover real pool based trial funds cap"
```

Expected:

```text
[main ...] test: cover real pool based trial funds cap
```

## Task 2: Switch Cap Base To `realTotalPool`

**Files:**
- Modify: `src/app/api/bets/route.ts`

- [ ] **Step 1: Change the first-bet and cap base to `currentRealTotal`**

In `src/app/api/bets/route.ts`, replace this block:

```ts
        if (useBonus && currentTotalReal <= 0) {
            return NextResponse.json(
                {
                    error: '體驗金不可作為該場賭池首注，請等待真實資金先建立賭池。',
                    code: 'risk_trial_funds_first_bet_blocked',
                },
                { status: 403 }
            );
        }

        if (useBonus) {
            const trialFundsUsed = getTrialFundsUsageForMatch(db, matchId);
            const trialFundsCap = Number((currentTotalReal * TRIAL_FUNDS_CAP_RATIO).toFixed(6));
            const trialFundsRemaining = Math.max(
                0,
                Number((trialFundsCap - trialFundsUsed).toFixed(6))
            );
```

with:

```ts
        if (useBonus && currentRealTotal <= 0) {
            return NextResponse.json(
                {
                    error: '體驗金不可作為該場賭池首注，請等待真實資金先建立賭池。',
                    code: 'risk_trial_funds_first_bet_blocked',
                },
                { status: 403 }
            );
        }

        if (useBonus) {
            const trialFundsUsed = getTrialFundsUsageForMatch(db, matchId);
            const trialFundsCap = Number((currentRealTotal * TRIAL_FUNDS_CAP_RATIO).toFixed(6));
            const trialFundsRemaining = Math.max(
                0,
                Number((trialFundsCap - trialFundsUsed).toFixed(6))
            );
```

This keeps the cumulative rule intact while changing the cap base to the real-money pool source of truth.

- [ ] **Step 2: Run the route test file again and verify it passes**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 3: Check diagnostics for the edited backend files**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/bets/route.ts
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/bets/route.test.ts
```

Expected:

```text
No new diagnostics introduced
```

- [ ] **Step 4: Commit the implementation**

Run:

```bash
git add src/app/api/bets/route.ts src/app/api/bets/route.test.ts
git commit -m "feat: base trial funds cap on real pool"
```

Expected:

```text
[main ...] feat: base trial funds cap on real pool
```

## Task 3: Final Verification

**Files:**
- Modify: `src/app/api/bets/route.ts`
- Modify: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Re-run the focused route tests once more**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 2: Confirm working tree only shows unrelated data noise after commits**

Run:

```bash
git status --short
```

Expected relevant result:

```text
M data/backups/backup.log
M data/bets_db.json
M data/market_db.json
```

Do not revert those files. Just confirm the route files are clean and already committed.

- [ ] **Step 3: Prepare handoff summary**

Include these points in the final handoff:

```text
- trial-funds cap remains cumulative at match level
- cap base now uses current real-money pool only
- cap expands automatically as real-money pool grows
- first-bet trial-funds block remains unchanged
- real-money bets remain unaffected
```

## Self-Review

- Spec coverage: covered cumulative rule, real-money-pool source of truth, growth-driven cap expansion, preserved first-bet block, and real-money unaffected behavior.
- Placeholder scan: no `TODO`, `TBD`, or vague test instructions remain; every step contains concrete code or commands.
- Type consistency: `currentRealTotal`, `trialFundsCap`, `trialFundsUsed`, and `risk_trial_funds_cap` are used consistently with the current route implementation and test contract.
