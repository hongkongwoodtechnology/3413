# Trial Funds Real-Pool Cap Design

Date: 2026-05-16

## Context

The current trial-funds cap logic is intended to keep total accepted trial-funds exposure within 15% of the match pool.

However, the product rule needs to be made explicit:

- the cap should track the current real-money pool only
- the cap is dynamic and can grow as real-money liquidity grows
- the cap still applies to cumulative accepted trial-funds usage for the match
- trial funds still cannot open an empty match pool

This design updates the backend interpretation of the 15% rule so it matches the intended business behavior.

## Problem Statement

The existing implementation and business expectation have drifted:

- users expect the trial-funds capacity to expand when the real-money pool expands
- the current implementation path needs to be anchored explicitly to the real-money pool definition
- the rule must remain cumulative at the match level, not per-user and not per-single-bet only

The system needs a single, unambiguous definition of “15% of the pool”.

## Goals

- Define the trial-funds cap as `current real-money pool * 15%`.
- Keep the cap cumulative across all accepted trial-funds bets in the same match.
- Allow additional trial-funds bets when the real-money pool later grows enough to increase the cap.
- Preserve the existing “trial funds cannot be the first bet” rule.
- Keep the change isolated to backend validation and backend tests.

## Non-Goals

- No change to the frontend disabled-button rule for trial-funds first bets.
- No new frontend display of remaining trial-funds allowance.
- No change to odds, payout, attraction-window, refund, or position-limit logic.
- No change to the rule scope: it still applies to all accepted trial-funds bets in the same match, not only the current user.

## Recommended Approach

Anchor the cap calculation to `currentMarket.realTotalPool` and keep cumulative trial-funds usage as the tracked consumption.

### Why this approach

This directly matches the clarified product rule:

- the cap grows when real-money liquidity grows
- the cap stays tied to real-money support rather than mixed pool interpretations
- the first-bet restriction remains the separate zero-liquidity guardrail
- the change is narrow and testable in the existing API

## Detailed Behavior

### Rule 1: first-bet restriction remains unchanged

If the current real-money pool is zero, trial funds cannot place the first bet in the match.

This continues to return:

- `403`
- `code: risk_trial_funds_first_bet_blocked`

### Rule 2: cumulative trial-funds cap uses current real-money pool

For `useBonus === true`, define:

- `realPoolBase = currentMarket.realTotalPool`
- `trialFundsCap = realPoolBase * 0.15`
- `trialFundsUsed = sum of all accepted trial-funds bets already stored for the same match`
- `trialFundsRemaining = max(0, trialFundsCap - trialFundsUsed)`

Reject the new bet if:

- `amount > trialFundsRemaining`

This means the rule is cumulative and time-sensitive:

- if the real-money pool later increases, `trialFundsCap` increases too
- if the existing cumulative trial-funds usage is now below the larger cap, new trial-funds bets can be accepted again

### Pool definition

The term “pool” for this rule means:

- `real-money pool only`

It must not be interpreted as:

- total pool including trial funds
- legacy display pools if they could contain non-real-money amounts

The backend source of truth for this rule is `currentMarket.realTotalPool`.

## Validation Logic

The backend validation order remains:

1. required parameter validation
2. match lock / live-minute guardrails
3. first-bet trial-funds restriction
4. trial-funds 15% cap restriction
5. odds / solvency / position-limit validations

This ordering is important because:

- zero real-money pool should fail on the dedicated first-bet rule first
- non-zero real-money pool should then evaluate against the dynamic 15% cumulative cap

## File Scope

Implementation is expected to touch only:

- `src/app/api/bets/route.ts`
- `src/app/api/bets/route.test.ts`

No frontend files are part of this change.

## Error Contract

The existing cap rejection contract remains:

- `403`
- `code: risk_trial_funds_cap`
- `trialFundsCap`
- `trialFundsUsed`
- `trialFundsRemaining`

The user-facing message may continue to describe the remaining allowance, but the numeric fields must reflect the new real-pool-based definition.

## Test Strategy

Required backend coverage:

1. zero real-money pool + trial funds => rejected by first-bet rule
2. non-zero real-money pool + cumulative trial funds under `realTotalPool * 15%` => accepted
3. non-zero real-money pool + cumulative trial funds over `realTotalPool * 15%` => rejected
4. real-money pool grows enough to expand the cap => a new trial-funds bet that was previously impossible under the smaller cap is now accepted
5. real-money bets remain unaffected by the trial-funds cap rule

The tests should use `currentMarket.realTotalPool` as the cap base, not legacy pooled display values.

## Risks And Mitigations

### Risk: confusion between real-money pool and legacy pool snapshots

Some code paths still carry `pools.home/draw/away` for UI and compatibility purposes.

Mitigation:

- define `currentMarket.realTotalPool` as the explicit source of truth for this rule
- keep the spec and tests aligned to that exact field

### Risk: users misread the rule as per-bet instead of cumulative

The clarified product rule is cumulative at match level.

Mitigation:

- preserve cumulative calculations in the API
- keep test names explicit about cumulative match usage

## Acceptance Criteria

- Trial funds still cannot open an empty match pool.
- Trial-funds capacity is recalculated from the current real-money pool at the time of validation.
- The total accepted trial-funds usage for a match never exceeds 15% of the current real-money pool.
- When real-money liquidity grows, the maximum allowed cumulative trial-funds usage grows accordingly.
- Real-money bets are not blocked by this rule.

## Out Of Scope Follow-Ups

These are intentionally excluded from this change:

- showing remaining trial-funds allowance in the UI
- adding client-side cap previews for trial-funds bets
- redesigning how `realTotalPool` and legacy display pools are synchronized elsewhere in the app
