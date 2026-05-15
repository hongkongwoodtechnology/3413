# Trial Funds First-Bet Restriction Design

## Summary

This spec defines a narrow backend rule for trial-funds betting:

- only `useBonus === true` bets are affected,
- only the match's first bet is restricted,
- the restriction is enforced in `POST /api/bets`,
- trial funds cannot create a brand-new match pool,
- once the match already has any pool balance, trial funds may continue to participate normally.

The goal is to ensure that every match pool is opened by real money, without changing the broader single-sided market behavior.

## Problem

The current system allows trial-funds bets to open a completely empty match pool.

That creates a business-rule mismatch:

- the platform wants real money to establish the pool first,
- but the current API accepts trial-funds bets even when the match has no existing pool,
- which means trial funds can become the first source of market formation.

The requested change is intentionally narrow. It is not a rewrite of single-sided market rules.

## Confirmed Rule

### Scope

- Apply only to trial-funds bets where `useBonus === true`.
- Apply only when the match has no existing pool.
- Do not block trial funds after the pool has already been opened.
- Do not change real-money first-bet behavior.
- Do not redefine the existing `initialOdds` / single-sided phase.

### First-bet definition

For this rule, "first bet" means:

```text
currentPools.home + currentPools.draw + currentPools.away === 0
```

This is a whole-match definition, not:

- the first bet on a specific outcome,
- the first bet in a single-sided continuation,
- the whole `initialOdds` phase.

### Acceptance rule

```text
if useBonus === true and currentTotalReal === 0:
  reject
else:
  continue normal validation
```

This means:

- empty match pool + trial funds => rejected,
- empty match pool + real money => accepted,
- non-empty match pool + trial funds => accepted.

## Recommended Approach

Use a backend hard rejection inside `src/app/api/bets/route.ts`.

### Why this approach

- It enforces the rule at the source of truth.
- It cannot be bypassed by direct API requests.
- It keeps the change small and local to the bet-acceptance flow.
- It avoids unnecessary changes to UI, odds display, or settlement.

### Rejected alternatives

- Blocking all single-sided trial-funds bets. Rejected because the confirmed rule is narrower.
- Blocking the first bet on each outcome. Rejected because the requirement is about the whole match pool, not individual options.
- Frontend-only disablement. Rejected because the API would still accept bypassed requests.

## Affected Areas

### Bet API

Primary file:

- `src/app/api/bets/route.ts`

Responsibilities:

- detect whether the match pool is still empty,
- reject trial-funds bets in that exact state,
- return a clear error payload and message,
- leave all later risk and solvency checks unchanged.

### API tests

Primary file:

- `src/app/api/bets/route.test.ts`

Responsibilities:

- verify trial funds are rejected on a zero-pool match,
- verify real money can still open a zero-pool match,
- verify trial funds are allowed once the match pool is non-zero.

## Design

### 1. Enforcement point

Run the new rule early in `POST /api/bets`, after:

- request-body validation,
- market loading,
- current pool totals calculation.

Run it before:

- odds-phase validation,
- solvency checks,
- persistence,
- reserve updates.

This keeps the rejection fast and side-effect free.

### 2. Detection rule

Use the already calculated total pool for the match:

```text
currentTotalReal = currentPools.home + currentPools.draw + currentPools.away
```

Then apply:

```text
if useBonus === true and currentTotalReal <= 0:
  reject
```

Using `currentTotalReal <= 0` is acceptable here because an empty pool should behave as zero even if future numeric normalization changes slightly.

### 3. Error response

When the request is blocked, return `403` with:

- human-readable error text,
- machine-friendly code.

Recommended payload:

```json
{
  "error": "體驗金不可作為該場賭池首注，請等待真實資金先建立賭池。",
  "code": "risk_trial_funds_first_bet_blocked"
}
```

No extra cap metrics are needed for this rule because the decision depends only on whether the pool is empty.

### 4. Non-goals inside this change

This rule must not:

- alter `initialOdds` calculation,
- alter trial-funds odds discount behavior,
- alter the existing 15% trial-funds cap,
- alter attraction-window behavior,
- alter single-sided refund behavior.

## Data Flow

### Rejected first trial-funds bet

1. Load request body.
2. Load market state.
3. Compute current total pool.
4. If the pool is empty and `useBonus === true`, return `403`.
5. Stop without writing bet records or market state.

### Accepted real-money first bet

1. Load request body.
2. Load market state.
3. Compute current total pool.
4. Because `useBonus !== true`, skip this rule.
5. Continue the existing first-bet flow unchanged.

### Accepted later trial-funds bet

1. Load request body.
2. Load market state.
3. Compute current total pool.
4. Because the pool is already non-zero, skip this rule.
5. Continue the existing trial-funds validation flow unchanged.

## Error Handling

Priority should remain:

- required-field validation first,
- outcome validation next,
- first-bet trial-funds restriction before deeper market validation.

If this rule triggers, it should fail with the dedicated first-bet restriction error rather than a later generic error.

## Testing Strategy

### API coverage

Add focused tests for:

- zero-pool match + `useBonus === true` => `403`,
- zero-pool match + `useBonus === false` => `200`,
- non-zero-pool match + `useBonus === true` => `200`.

### Regression coverage

Keep existing tests for:

- single-sided initial odds behavior,
- attraction-window persistence,
- trial-funds payout persistence,
- trial-funds cap behavior.

This change should be additive and not weaken previous coverage.

## Non-goals

- Preventing trial funds from participating in all single-sided bets.
- Preventing trial funds from being the first bet on a specific outcome.
- Changing UI copy or disabling buttons in this change.
- Reworking broader market-supervisor logic.
