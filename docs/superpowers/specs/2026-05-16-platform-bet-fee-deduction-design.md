# Platform Bet Fee Deduction Design

## Summary

This spec fixes the mismatch where the UI briefly shows post-fee pool values after a bet, but the persisted backend market state still records the full bet amount as if no platform fee had been deducted.

The selected product rules are:

- charge platform fee at bet placement time
- use post-fee principal as the only payout base for real-money bets
- keep single-sided refunds as full principal refunds
- keep referral commission logic out of scope for this fix

## Problem

The current system mixes gross and net bet amounts across different layers.

Observed behavior:

- frontend optimistic updates use the post-fee pool amount for real-money bets
- backend bet persistence records `amount` as submitted gross stake
- backend market persistence adds the full submitted `amount` into `realTotalPool` and `pools`
- backend winner payout uses `amount * lockedOdds`

This creates three inconsistencies:

1. after refresh, the pool appears to have received the full bet amount
2. house fee is partially tracked in reserve but not reflected in persisted pool balances
3. payout semantics do not match "bet is charged a fee at placement time"

## Confirmed Product Decisions

- Real-money bets are charged the platform fee immediately at bet placement.
- The pool only receives the net bet amount after fee deduction.
- Winner payout for real-money bets is based on net principal, not gross principal.
- Single-sided refunds continue to return the full original bet amount.
- Trial-funds behavior is unchanged in this fix.

## Approaches Considered

### Recommended: backend net-of-fee as source of truth

Compute the split once on the server, then persist and settle using the net pool amount consistently.

Why this is recommended:

- removes frontend/backend disagreement
- aligns pool balances, liability checks, and payouts under one rule
- preserves current reserve accounting with minimal conceptual change
- reduces future settlement and solvency bugs

### Alternative: UI-only correction

Only adjust display logic so refreshed values still appear net-of-fee.

Rejected because:

- persisted data stays wrong
- risk checks still depend on mixed semantics
- settlement logic still pays from gross stake

### Alternative: dual-track gross and net accounting everywhere

Persist both gross and net values for every calculation path and keep current semantics where possible.

Rejected for now because:

- too much scope for a targeted bug fix
- increases model complexity across market, bet, and settlement paths

## Affected Areas

Primary backend:

- `src/app/api/bets/route.ts`
- `src/app/api/cron/settle/route.ts`

Supporting logic:

- `src/lib/bet-mode.ts`
- `src/lib/wallets.ts`

Likely tests:

- `src/app/api/bets/route.test.ts`
- `src/app/api/cron/settle/route.test.ts`
- `src/lib/bet-mode.test.ts`

## Design

### 1. Single source of truth for split amounts

For real-money bets, the server should derive the split using `splitBetAmount(betAmount, commissionRate)`.

The important outputs are:

- `platformFee`
- `pool`
- `house`
- `commission`

For this fix, the server uses:

- gross stake = user submitted `amount`
- effective pool stake = split `pool`

The persisted bet record may continue storing the user-facing gross `amount`, but all pool and payout calculations for real-money bets must use the effective pool stake.

### 2. Bet persistence semantics

When a real-money bet is accepted:

- store the original gross `amount`
- store the locked odds
- store `netPayout` based on effective pool stake, not gross stake
- optionally persist an explicit net field if implementation benefits from it

Recommended persisted interpretation:

- `amount`: original bet stake submitted by user
- `netPayout`: effectivePoolAmount multiplied by locked odds

Optional but recommended field:

- `effectiveAmount`: post-fee principal that actually entered the pool

This optional field improves clarity for later settlement and auditability, but the first implementation may also recompute it from gross amount if done consistently.

### 3. Market accounting

For real-money bets, market persistence must add only the effective pool amount to:

- `realTotalPool`
- `pools[outcome]`

Liability increases should also use the effective pool amount:

- `liabilities[outcome] += effectivePoolAmount * lockedOdds`

This removes the current bug where the backend validates against net-of-fee funding assumptions but persists gross pool balances afterward.

### 4. Risk checks

All real-money solvency and cap checks in the bet placement route should use the same effective pool amount.

Specifically:

- projected pool funding should add `effectivePoolAmount`
- projected liability should use `effectivePoolAmount * lockedOdds`
- reserve-backed cold-start checks should continue comparing against real pool funds plus reserve

The main rule is consistency: validation inputs and persisted outputs must use the same net basis.

### 5. Payout calculation

For real-money winning bets:

- payout uses post-fee principal multiplied by locked odds

Example:

- submitted bet = `100`
- platform fee = `8`
- effective pool amount = `92`
- locked odds = `2.0`
- winner payout = `184`

This matches the intended meaning of "fee is charged when the bet is placed".

Trial-funds behavior remains unchanged in this design pass.

### 6. Refund behavior

Single-sided refunds remain a separate product rule and do not inherit the fee deduction rule.

If a real-money bet becomes refundable because only one outcome had bets:

- refund the full original gross `amount`

This preserves the current promise that unmatched/invalid market states do not cost the user platform fees.

### 7. Reserve handling

Reserve accumulation continues from the platform fee portion.

This fix does not change:

- platform fee rate
- reserve destination
- current reserve share rules

It only ensures that once the fee is taken, the remaining pool balances no longer pretend the fee never left.

## Data Flow

1. User submits a bet with gross `amount`.
2. Bet route computes the platform split.
3. Bet route validates pool solvency using effective pool amount.
4. Bet route persists the bet with gross amount and net payout based on effective pool amount.
5. Bet route updates market pools and liabilities using effective pool amount.
6. Bet route records reserve accumulation from the fee portion.
7. Settlement route pays winning real-money bets using stored `netPayout`.
8. Refund route logic continues returning gross `amount` for refundable single-sided bets.

## Backward Compatibility

- Existing historical bets without an explicit `effectiveAmount` field must continue settling correctly.
- If older records only contain `amount`, settlement should respect stored `netPayout` when present.
- This change only affects newly created real-money bets unless a separate migration is introduced.
- Trial-funds bets should preserve their current payout behavior.

## Error Handling

- If split calculation fails or returns invalid values, reject the bet instead of persisting mixed state.
- If any stored numeric field is missing or malformed in settlement, prefer the already stored `netPayout` when available.
- Do not change refund semantics as part of validation fallback behavior.

## Scope

In scope:

- server-side fee deduction consistency for real-money bets
- net-of-fee pool persistence
- net-of-fee real-money payout persistence
- settlement consistency with stored post-fee payout
- focused regression tests

Out of scope:

- referral commission accounting changes
- changing fee percentages
- migrating old bets to add new net fields
- trial-funds payout redesign
- front-end copy or UX redesign beyond keeping existing optimistic behavior aligned

## Testing

Recommended focused coverage:

- real-money bet persists market pool increments using post-fee amount
- real-money bet persists `netPayout` using post-fee amount
- reserve still accumulates from platform fee
- single-sided refund still returns full original gross amount
- trial-funds payout behavior remains unchanged
- settlement pays stored real-money `netPayout` correctly

Manual verification:

1. Place a real-money bet and note the submitted amount.
2. Confirm immediate UI pool increase equals submitted amount minus fee.
3. Refresh and confirm the persisted pool stays at the same net increase.
4. Inspect stored bet record and confirm payout aligns with net principal.
5. Trigger or simulate a single-sided refund and confirm the user receives full original stake.

## Expected Outcome

After this change:

- users no longer see refreshed pool values that ignore the fee
- real-money payouts match the intended post-fee betting rule
- market solvency calculations and persisted balances use the same basis
- reserve accounting remains intact
- the platform no longer behaves as if fee was charged and not charged at the same time
