# Trial Funds First-Bet Restriction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent trial-funds bets from becoming the first bet in an empty match pool while keeping all later trial-funds participation unchanged.

**Architecture:** Keep the rule inside the existing bet-placement API so the restriction is enforced at the source of truth. Reuse the already computed `currentTotalReal` value to reject only `useBonus === true` requests on zero-pool matches, then leave the existing cap, pricing, solvency, and persistence flow untouched.

**Tech Stack:** Next.js App Router, TypeScript, Jest

---

## File Map

- Modify: `src/app/api/bets/route.test.ts`
  - Add focused API tests for the first-bet restriction and update the old zero-pool trial-funds test to the new dedicated error contract.
- Modify: `src/app/api/bets/route.ts`
  - Add a small first-bet rejection branch before deeper market validation.
- Create: `docs/superpowers/plans/2026-05-16-trial-funds-first-bet-plan.md`
  - This implementation plan.

### Task 1: Add Failing API Tests For First-Bet Restriction

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.test.ts`

- [ ] **Step 1: Replace the old zero-pool trial-funds cap test with a first-bet restriction test**

Find the existing test named:

```ts
it('rejects positive trial-funds bets when the match has no existing pool', async () => {
```

Replace the whole test with:

```ts
  it('rejects a trial-funds bet when it would become the first bet in an empty match pool', async () => {
    mockDatabases({
      marketDb: {
        '303': {
          realTotalPool: 0,
          liabilities: { home: 0, draw: 0, away: 0 },
          pools: { home: 0, draw: 0, away: 0 },
          initialOdds: { home: 2.1, draw: 3.2, away: 3.6 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-zero-pool',
        matchId: 303,
        matchName: 'Zero Pool Match',
        outcome: 'home',
        amount: 1,
        odds: 2.1,
        useBonus: true,
        timestamp: 1234567898,
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

- [ ] **Step 2: Add a failing test proving real money can still open an empty match pool**

Append this test immediately after the previous one:

```ts
  it('allows a real-money bet to open an empty match pool', async () => {
    mockDatabases({
      marketDb: {
        '303': {
          realTotalPool: 0,
          liabilities: { home: 0, draw: 0, away: 0 },
          pools: { home: 0, draw: 0, away: 0 },
          initialOdds: { home: 2.1, draw: 3.2, away: 3.6 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'real-user-zero-pool',
        matchId: 303,
        matchName: 'Zero Pool Match',
        outcome: 'home',
        amount: 1,
        odds: 2.1,
        useBonus: false,
        timestamp: 1234567899,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.useBonus).toBe(false);
  });
```

- [ ] **Step 3: Keep the existing non-zero-pool trial-funds success test as the positive later-participation proof**

Use the already existing passing case:

```ts
it('accepts a trial-funds bet when cumulative match usage stays within the 15% cap', async () => {
```

This test already demonstrates:

```text
non-zero-pool match + useBonus === true => accepted
```

Do not add a duplicate test for the same behavior.

- [ ] **Step 4: Run the focused test file and verify the first-bet test fails for the right reason**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
FAIL src/app/api/bets/route.test.ts
  bets POST
    ✕ rejects a trial-funds bet when it would become the first bet in an empty match pool
```

- [ ] **Step 5: Commit the failing test update**

```bash
git add src/app/api/bets/route.test.ts
git commit -m "test: cover trial funds first bet restriction"
```

### Task 2: Implement The First-Bet Restriction In Bet API

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.test.ts`

- [ ] **Step 1: Add the first-bet rejection branch before the existing 15% trial-funds cap**

Insert this block immediately after:

```ts
        const currentTotalReal = currentPools.home + currentPools.draw + currentPools.away;
        const isFeeFundedCold = currentTotalReal < 0.50;
```

Add:

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
```

- [ ] **Step 2: Keep the existing 15% cap branch directly after the new first-bet branch**

The code following the new branch should remain:

```ts
        if (useBonus) {
            const trialFundsUsed = getTrialFundsUsageForMatch(db, matchId);
            const trialFundsCap = Number((currentTotalReal * TRIAL_FUNDS_CAP_RATIO).toFixed(6));
            const trialFundsRemaining = Math.max(
                0,
                Number((trialFundsCap - trialFundsUsed).toFixed(6))
            );

            if (amount > trialFundsRemaining + FLOAT_PRECISION_EPSILON) {
                return NextResponse.json(
                    {
                        error: `體驗金超出單場上限，目前最多還可使用 ${trialFundsRemaining.toFixed(4)} USDT。`,
                        code: 'risk_trial_funds_cap',
                        trialFundsCap,
                        trialFundsUsed,
                        trialFundsRemaining,
                    },
                    { status: 403 }
                );
            }
        }
```

Do not remove or merge it into the new branch.

- [ ] **Step 3: Run the focused test file and verify it passes**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
  bets POST
```

- [ ] **Step 4: Run diagnostics for the edited files**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/bets/route.ts
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/bets/route.test.ts
```

Expected:

```text
No new diagnostics.
```

- [ ] **Step 5: Commit the implementation**

```bash
git add src/app/api/bets/route.ts src/app/api/bets/route.test.ts
git commit -m "feat: block trial funds from opening empty pools"
```

### Task 3: Regression Verification And Handoff

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.test.ts`

- [ ] **Step 1: Re-run the focused bet API test file**

Run:

```bash
npx jest --runInBand --ci --watch=false --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 2: Confirm both error contracts remain covered**

Keep these assertions in the file:

```ts
expect(json.code).toBe('risk_trial_funds_first_bet_blocked');
expect(json.error).toContain('體驗金不可作為該場賭池首注');
```

and:

```ts
expect(json.code).toBe('risk_trial_funds_cap');
expect(json.trialFundsCap).toBe(37.5);
expect(json.trialFundsUsed).toBe(30);
expect(json.trialFundsRemaining).toBe(7.5);
```

- [ ] **Step 3: Check staged files before any extra commit**

Run:

```bash
git diff --name-only --cached
```

Expected:

```text
No output if everything is already committed, or only these files if a commit is still pending:
src/app/api/bets/route.ts
src/app/api/bets/route.test.ts
```

- [ ] **Step 4: Prepare handoff notes**

Record these verification points in the implementation handoff:

```text
- Trial funds cannot open an empty match pool.
- Real money can still create the first pool entry.
- Trial funds can still join once the match pool is non-zero.
- The existing 15% trial-funds cap still applies after the pool exists.
- The change does not alter initialOdds, attraction-window, or settlement behavior.
```
