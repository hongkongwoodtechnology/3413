# Bet API Finished Match Rejection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block `POST /api/bets` from accepting bets for matches that are already closed by authoritative backend state.

**Architecture:** Keep the fix local to the bet API route by adding a pre-persistence market-closure guard based on existing `market_db` terminal fields. Extend route tests first so the new guard is verified without changing unrelated frontend or match-feed behavior.

**Tech Stack:** Next.js route handlers, TypeScript, Jest, file-backed JSON mocks

---

## File Map

- Modify: `src/app/api/bets/route.ts`
- Modify: `src/app/api/bets/route.test.ts`
- Reference: `src/lib/marketDb.ts`
- Reference: `docs/superpowers/specs/2026-05-17-bet-api-finished-match-rejection-design.md`

### Task 1: Add failing API tests for closed markets

**Files:**
- Modify: `src/app/api/bets/route.test.ts`
- Test: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Add a helper request factory for POST payloads**

```ts
function createBetRequest(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: 'test-user',
      matchId: 101,
      matchName: 'A vs B',
      outcome: 'home',
      amount: 10,
      odds: 2.15,
      useBonus: false,
      timestamp: 1234567890,
      liveMinute: 12,
      ...overrides,
    }),
  });
}
```

- [ ] **Step 2: Add a failing test for `finalWinner` closure**

```ts
it('rejects bets when the market already has a final winner', async () => {
  mockDatabases({
    marketDb: {
      '101': {
        realTotalPool: 250,
        liabilities: { home: 0, draw: 0, away: 0 },
        pools: { home: 100, draw: 80, away: 70 },
        finalWinner: 'away',
      },
    },
  });

  const res = await POST(createBetRequest());
  const json = await res.json();

  expect(res.status).toBe(403);
  expect(json.error).toBe('賽事已結束，無法投注。');
  expect(fs.writeFileSync).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Add a failing test for `settled` closure**

```ts
it('rejects bets when the market is already settled', async () => {
  mockDatabases({
    marketDb: {
      '101': {
        realTotalPool: 250,
        liabilities: { home: 0, draw: 0, away: 0 },
        pools: { home: 100, draw: 80, away: 70 },
        settled: true,
      },
    },
  });

  const res = await POST(createBetRequest());
  expect(res.status).toBe(403);
});
```

- [ ] **Step 4: Add a failing test for closed refund state**

```ts
it('rejects bets when the market refund has already been processed', async () => {
  mockDatabases({
    marketDb: {
      '101': {
        realTotalPool: 250,
        liabilities: { home: 10, draw: 0, away: 0 },
        pools: { home: 100, draw: 0, away: 0 },
        refundProcessed: true,
      },
    },
  });

  const res = await POST(createBetRequest());
  expect(res.status).toBe(403);
});
```

- [ ] **Step 5: Run tests to verify at least one new test fails**

Run: `npm test -- --runTestsByPath src/app/api/bets/route.test.ts --runInBand`
Expected: FAIL because closed-market requests still return `200`

### Task 2: Implement the closed-market guard

**Files:**
- Modify: `src/app/api/bets/route.ts`
- Test: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Add a small helper that classifies terminal market state**

```ts
function isMarketClosedForBetting(market?: MarketDataInfo): boolean {
  if (!market) return false;
  if (typeof market.finalWinner === 'string' && market.finalWinner.length > 0) return true;
  if (market.settled) return true;

  if (market.refundProcessed) {
    const liabilities = market.liabilities || { home: 0, draw: 0, away: 0 };
    const outcomesWithBets = [liabilities.home > 0, liabilities.draw > 0, liabilities.away > 0].filter(Boolean).length;
    if (outcomesWithBets <= 1) return true;
  }

  return false;
}
```

- [ ] **Step 2: Call the helper before odds, pool, reserve, and persistence logic**

```ts
const marketDb = loadMarketDb();
const key = String(matchId);
const currentMarket = marketDb[key];

if (isMarketClosedForBetting(currentMarket)) {
  return NextResponse.json({ error: '賽事已結束，無法投注。' }, { status: 403 });
}
```

- [ ] **Step 3: Keep the existing default market initialization after the guard**

```ts
const currentMarket: MarketDataInfo = marketDb[key] || {
  realTotalPool: 0,
  liabilities: { home: 0, draw: 0, away: 0 },
  pools: { home: 0, draw: 0, away: 0 },
  attractionWindowUsed: { home: 0, draw: 0, away: 0 },
};
```

- [ ] **Step 4: Run route tests**

Run: `npm test -- --runTestsByPath src/app/api/bets/route.test.ts --runInBand`
Expected: PASS

### Task 3: Validate diagnostics and regressions

**Files:**
- Modify: `src/app/api/bets/route.ts`
- Modify: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: Check TypeScript diagnostics for edited files**

Run tool: `GetDiagnostics` for:
- `src/app/api/bets/route.ts`
- `src/app/api/bets/route.test.ts`

Expected: no new diagnostics caused by the closed-market guard

- [ ] **Step 2: Re-run the targeted test suite**

Run: `npm test -- --runTestsByPath src/app/api/bets/route.test.ts --runInBand`
Expected: PASS

- [ ] **Step 3: Summarize the behavioral change**

```text
`POST /api/bets` now rejects clearly closed markets before writing `bets_db` or mutating pools.
```
