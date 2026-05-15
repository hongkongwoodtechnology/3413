# Trial Funds Match Cap Design

## Summary

This spec defines a hard backend cap for trial-funds bets.

The confirmed rule is:

- only `useBonus === true` bets are affected,
- the cap is enforced in `POST /api/bets`,
- the cap for a match is `下注前 total pool * 0.15`,
- the cap applies to the cumulative trial-funds stake already accepted for that match plus the incoming bet,
- bets above the remaining allowance are rejected before persistence.

The goal is to make the trial-funds limit real and non-bypassable, instead of depending on frontend input constraints.

## Problem

Current behavior does not actually enforce a trial-funds cap in the bet-placement API.

That creates two issues:

- trial-funds exposure can grow beyond the intended market-risk boundary,
- any frontend-only restriction would be bypassable by direct API calls.

The existing project plan already describes a trial-funds cap, but the running API path does not yet implement it.

## Confirmed Rule

### Scope

- Apply only to trial-funds bets where `useBonus === true`.
- Do not change real-money bet limits or payout logic.
- Do not create a separate pool for trial funds.

### Cap basis

The cap is computed from the match state before the new trial-funds bet is accepted:

```text
trialFundsCap = currentTotalReal * 0.15
```

Where:

- `currentTotalReal` is the pre-bet total pool for that match,
- `0.15` is the confirmed limit ratio.

### Accumulation rule

The enforcement basis is the total accepted trial-funds stake for the same match across all users:

```text
trialFundsUsed = sum(all accepted bets for this match where useBonus === true)
trialFundsRemaining = max(0, trialFundsCap - trialFundsUsed)
```

The incoming request is rejected when:

```text
trialFundsUsed + amount > trialFundsCap
```

This is a match-wide cap, not a per-user cap and not a single-bet-only cap.

## Recommended Approach

Use a backend hard rejection inside `src/app/api/bets/route.ts`.

### Why this approach

- It enforces the limit at the source of truth.
- It prevents bypass through manual API requests.
- It matches the current architecture where the API already owns solvency and risk checks.
- It keeps the change focused without expanding into a broader UI rewrite.

### Rejected alternatives

- Frontend-only input limit. Rejected because it is not reliable risk control.
- Per-user-only trial-funds cap. Rejected because the requirement is to protect total market exposure.
- Single-bet-only cap. Rejected because users could split orders and exceed the intended match-level ceiling.

## Affected Areas

### Bet API

Primary file:

- `src/app/api/bets/route.ts`

Responsibilities:

- compute the pre-bet match total pool,
- compute the cumulative accepted trial-funds stake for the same match,
- reject orders that exceed the remaining match allowance,
- return a clear error payload with remaining allowed amount.

### API tests

Primary file:

- `src/app/api/bets/route.test.ts`

Responsibilities:

- verify trial-funds bets within the cap succeed,
- verify trial-funds bets above the cap fail,
- verify real-money bets are unaffected by the new branch.

## Design

### 1. Enforcement point

Run the new cap check in the existing `POST /api/bets` validation flow before:

- the bet record is saved,
- market pools and liabilities are updated,
- reserve side effects are applied.

This keeps failed requests side-effect free.

### 2. Data source

Use:

- `currentTotalReal` from the current market state for the cap base,
- `bets_db` as the accepted-bets source for trial-funds usage.

The usage scan should count bets that:

- match the same `matchId`,
- have `useBonus === true`.

The usage scan should not count:

- non-trial-funds bets,
- other matches.

For v1, archived or settled status does not remove a bet from trial-funds usage because the cap is defined on accepted stake exposure for that match, not on current unresolved balance.

### 3. Error response

When the bet exceeds the limit, return `403` with a structured payload that includes:

- human-readable error text,
- machine-friendly code such as `risk_trial_funds_cap`,
- `trialFundsCap`,
- `trialFundsUsed`,
- `trialFundsRemaining`.

Recommended message:

```text
體驗金超出單場上限，目前最多還可使用 X.XXXX USDT。
```

### 4. Non-applicability cases

Do not run this rejection branch when:

- `useBonus !== true`,
- the bet is real money.

If `currentTotalReal <= 0`, then:

- `trialFundsCap = 0`,
- `trialFundsRemaining = 0`,
- any positive trial-funds bet is rejected by this rule.

This is intentional and avoids trial-funds cold-start exposure outside the cap model.

## Data Flow

### Successful trial-funds bet

1. Load request body and current market state.
2. Compute `currentTotalReal`.
3. Sum prior accepted trial-funds stake for the match from `bets_db`.
4. Compute `trialFundsCap` and `trialFundsRemaining`.
5. If within allowance, continue existing solvency and persistence logic.

### Rejected trial-funds bet

1. Load request body and current market state.
2. Compute `currentTotalReal`.
3. Sum prior accepted trial-funds stake for the match from `bets_db`.
4. Compute `trialFundsCap` and `trialFundsRemaining`.
5. If the new amount exceeds the remaining allowance, return `403` and stop.

## Error Handling

The new branch should preserve all existing validations and only add one more hard check.

Priority in practice:

- keep existing required-field and outcome validation first,
- run the trial-funds cap check before persistence,
- keep current solvency and concentration checks unchanged afterward.

If the cap is hit, the API should fail deterministically with the cap error rather than allowing a later, less specific rejection.

## Testing Strategy

### API coverage

Add focused tests for:

- trial-funds bet below the match cap returns `200`,
- trial-funds bet above the match cap returns `403`,
- returned payload includes `trialFundsCap`, `trialFundsUsed`, and `trialFundsRemaining`,
- real-money bet is not blocked by the trial-funds cap branch.

### Regression coverage

Keep existing tests for:

- locked odds persistence,
- trial-funds payout basis,
- single-sided initial odds behavior,
- attraction-window persistence.

The new tests should be additive and not broaden into unrelated UI coverage.

## Non-goals

- Changing the ratio from `15%` to another value.
- Adding a frontend quota display in this change.
- Introducing per-user trial-funds quotas.
- Reworking broader market supervisor logic.
