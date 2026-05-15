# Trial Funds Match Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a hard backend match-wide cap for trial-funds bets so cumulative `useBonus === true` stake cannot exceed `下注前 total pool * 15%`.

**Architecture:** Keep the change inside the existing bet-placement API so the risk rule is enforced at the source of truth. Reuse the already loaded `bets_db` and current match pools to calculate match-wide trial-funds usage before any persistence or side effects, then return a structured `403` error when the incoming bet exceeds the remaining allowance.

**Tech Stack:** Next.js App Router, TypeScript, Jest

---

## File Map

- Modify: `src/app/api/bets/route.test.ts`
  - Add focused API tests for the new match-wide trial-funds cap.
- Modify: `src/app/api/bets/route.ts`
  - Add a small helper to sum accepted trial-funds stake by match.
  - Enforce the `15%` cap before saving bets or mutating market state.
- Create: `docs/superpowers/plans/2026-05-16-trial-funds-cap-plan.md`
  - This implementation plan.

### Task 1: Add Failing API Tests For Trial-Funds Cap

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.test.ts`

- [ ] **Step 1: Add a reusable mock setup helper near the top of the test file**

Insert this helper below the existing `jest.mock('@/lib/reserve', ...)` block so each test can override `bets_db.json` and `market_db.json` without copy-pasting the whole `readFileSync` mock:

```ts
function mockDatabases({
  betsDb = {},
  marketDb,
}: {
  betsDb?: Record<string, unknown>;
  marketDb?: Record<string, unknown>;
}) {
  (fs.readFileSync as jest.Mock).mockImplementation((file: string) => {
    if (String(file).includes('bets_db.json')) {
      return JSON.stringify(betsDb);
    }
    if (String(file).includes('market_db.json')) {
      return JSON.stringify(
        marketDb ?? {
          '101': {
            realTotalPool: 250,
            liabilities: { home: 0, draw: 0, away: 0 },
            pools: { home: 100, draw: 80, away: 70 },
            initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
            attractionWindowUsed: { home: 0, draw: 0, away: 0 },
          },
          '202': {
            realTotalPool: 100,
            liabilities: { home: 0, draw: 0, away: 0 },
            pools: { home: 100, draw: 0, away: 0 },
            initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
            attractionWindowUsed: { home: 0, draw: 0, away: 0 },
          },
        }
      );
    }
    return '{}';
  });
}
```

- [ ] **Step 2: Replace the current `beforeEach` body to use the helper**

Keep the existing `jest.clearAllMocks()` call, then replace the inline `mockImplementation` with:

```ts
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabases({});
  });
```

- [ ] **Step 3: Add a failing test for the allowed edge just under the cap**

Append this test before the existing attraction-window tests:

```ts
  it('accepts a trial-funds bet when cumulative match usage stays within the 15% cap', async () => {
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
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-under-cap',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 7,
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
```

- [ ] **Step 4: Add a failing test for exceeding the cap**

Append this test immediately after the previous one:

```ts
  it('rejects a trial-funds bet when cumulative match usage exceeds the 15% cap', async () => {
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
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-over-cap',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 8,
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
    expect(json.trialFundsCap).toBe(37.5);
    expect(json.trialFundsUsed).toBe(30);
    expect(json.trialFundsRemaining).toBe(7.5);
    expect(json.error).toContain('體驗金超出單場上限');
  });
```

- [ ] **Step 5: Add a failing test proving real-money bets ignore the new branch**

Append this test immediately after the rejection case:

```ts
  it('does not apply the trial-funds cap to real-money bets', async () => {
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
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'real-money-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 8,
        odds: 2.15,
        useBonus: false,
        timestamp: 1234567897,
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

- [ ] **Step 6: Add a failing test for zero-pool matches**

Append this test immediately after the real-money case:

```ts
  it('rejects positive trial-funds bets when the match has no existing pool', async () => {
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
    expect(json.code).toBe('risk_trial_funds_cap');
    expect(json.trialFundsCap).toBe(0);
    expect(json.trialFundsUsed).toBe(0);
    expect(json.trialFundsRemaining).toBe(0);
  });
```

- [ ] **Step 7: Run the focused test file to verify the new tests fail first**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
FAIL src/app/api/bets/route.test.ts
  bets POST
    ✕ rejects a trial-funds bet when cumulative match usage exceeds the 15% cap
```

- [ ] **Step 8: Commit the failing tests**

```bash
git add src/app/api/bets/route.test.ts
git commit -m "test: cover trial funds match cap"
```

### Task 2: Implement Match-Wide Trial-Funds Cap In Bet API

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.test.ts`

- [ ] **Step 1: Add constants and a small helper near the top of `route.ts`**

Insert this block below `DB_FILE_PATH` so the cap ratio and usage calculation live close to the file-backed bet storage:

```ts
const TRIAL_FUNDS_CAP_RATIO = 0.15;
const FLOAT_PRECISION_EPSILON = 1e-9;

function getTrialFundsUsageForMatch(
  db: Record<string, BetRecord[]>,
  matchId: number | string
): number {
  const targetMatchId = String(matchId);

  return Object.values(db)
    .flat()
    .filter((bet) => String(bet.matchId) === targetMatchId && bet.useBonus === true)
    .reduce((sum, bet) => sum + (typeof bet.amount === 'number' ? bet.amount : 0), 0);
}
```

- [ ] **Step 2: Add the cap check after current pool totals are computed and before solvency checks**

Insert this block after:

```ts
        const currentTotalReal = currentPools.home + currentPools.draw + currentPools.away;
        const isFeeFundedCold = currentTotalReal < 0.50;
```

Add:

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

- [ ] **Step 3: Keep the rest of the API logic unchanged**

Do not move:

- `netPayout` calculation,
- existing odds validation,
- solvency checks,
- position limit checks,
- market persistence,
- reserve updates.

The only behavioral change in this task is the new trial-funds rejection branch.

- [ ] **Step 4: Run the focused test file to verify it now passes**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
  bets POST
```

- [ ] **Step 5: Run diagnostics for the edited files**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/bets/route.ts
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/api/bets/route.test.ts
```

Expected:

```text
No new diagnostics.
```

- [ ] **Step 6: Commit the implementation**

```bash
git add src/app/api/bets/route.ts src/app/api/bets/route.test.ts
git commit -m "feat: enforce trial funds match cap"
```

### Task 3: Regression Verification And Handoff

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\bets\route.test.ts`

- [ ] **Step 1: Run the full bet API test file again after the implementation commit**

Run:

```bash
npm test -- --runTestsByPath src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 2: Verify the rejection payload stays structured**

Keep this assertion inside the rejection test:

```ts
expect(json).toMatchObject({
  code: 'risk_trial_funds_cap',
  trialFundsCap: 37.5,
  trialFundsUsed: 30,
  trialFundsRemaining: 7.5,
});
```

- [ ] **Step 3: Check that no unrelated files were staged**

Run:

```bash
git diff --name-only --cached
```

Expected:

```text
src/app/api/bets/route.ts
src/app/api/bets/route.test.ts
```

- [ ] **Step 4: Commit the verified state**

```bash
git add src/app/api/bets/route.ts src/app/api/bets/route.test.ts
git commit -m "test: verify trial funds cap payload"
```

- [ ] **Step 5: Prepare handoff notes**

Record these verification points in the implementation handoff:

```text
- Trial-funds cap is enforced only for useBonus bets.
- Cap basis is pre-bet match total pool * 15%.
- Usage is summed across all accepted trial-funds bets for the same match.
- Real-money bets are unaffected.
- Zero-pool matches reject positive trial-funds bets through remaining allowance = 0.
```
