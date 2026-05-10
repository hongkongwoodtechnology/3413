# Single-Sided Initial Odds Design

## Summary

This spec defines a special pricing rule for the single-sided market phase in the `home / draw / away` market.

When only one outcome currently has accepted liquidity:

- new bets in that single-sided phase should use the match's `initialOdds`,
- the normal mathematical odds model should not apply yet,
- if the market never becomes multi-sided before close, the bets should be fully refunded,
- once a second outcome receives liquidity, all subsequent bets should immediately switch to the normal mathematical model.

This rule prioritizes product clarity and consistency over live-market precision during the single-sided phase.

## Problem

The current model applies mathematical pricing too early in a market that does not yet have a real counterparty structure.

In a three-way market:

- `home`
- `draw`
- `away`

if only one side has funds, the market is not yet meaningfully price-discovered. In that state:

- pool-based math can create misleading or extreme odds,
- live score conditions can produce visibly strange prices,
- yet operationally the product already treats unresolved single-sided markets as refundable.

So the pricing rule should match the settlement logic:

- no real counterparty yet,
- no real market-discovery yet,
- use a fixed quoted price until the second side appears.

## Confirmed Rules

- If only one outcome has accepted liquidity, the market is in `single-sided phase`.
- During the single-sided phase, new bets should use `initialOdds`.
- During the single-sided phase, the normal mathematical odds model should not be used.
- This applies even for live matches.
- The live match may therefore look mathematically imperfect during the single-sided phase, and that tradeoff is accepted.
- The moment a second outcome receives liquidity, the market switches immediately to the normal mathematical model.
- That switch is immediate starting from the triggering second-sided bet and all later bets.
- If the market remains single-sided until close, all single-sided bets are fully refunded.

## Recommended Approach

Use an explicit market-phase switch:

1. `Single-sided phase`
2. `Multi-sided phase`

### Why this approach

- Matches the current refund behavior.
- Prevents mathematically distorted prices before true counterparty formation.
- Is easy to explain to users and easy to reason about operationally.
- Requires less complexity than trying to make live single-sided pricing "look right" while the market is still refundable.

## Core Design

### 1. Detect single-sided phase

The market is in single-sided phase when exactly one of the following outcomes has accepted liquidity greater than zero:

- `home`
- `draw`
- `away`

This should be determined from accepted market state, not just from the currently typed client-side order.

Conceptually:

```text
activeOutcomes = count(outcomePool > 0)
singleSided = activeOutcomes === 1
```

### 2. Pricing rule in single-sided phase

When `singleSided === true`:

- all new bets should quote and lock against `initialOdds`,
- no pool-based repricing should occur,
- no score-driven live repricing should occur,
- no underdog-attraction or other advanced market-shaping logic should apply.

This deliberately makes the single-sided phase a fixed-price refundable staging phase.

### 3. Live matches still use initialOdds in single-sided phase

This is a conscious simplification.

Even if the match is live and the score is already unusual, the rule remains:

- if the market is still single-sided, quote `initialOdds`.

Reason:

- there is still no meaningful counterparty market,
- the product already accepts that unresolved single-sided bets refund,
- simplicity is more valuable here than trying to produce a pseudo-live fair price before the market has formed.

### 4. Immediate switch when second side appears

The switch point is:

- the first accepted bet that causes the market to move from one funded outcome to two funded outcomes.

Required behavior:

- prior single-sided bets keep their already locked `initialOdds`,
- the market state is updated,
- from that point forward, all new bets use the normal mathematical model.

There is no extra holding period, no total-pool threshold, and no gradual transition.

### 5. Refund behavior

If the market closes while still single-sided:

- all bets in that unresolved single-sided market are fully refunded,
- no fee is charged,
- no market-price settlement logic should override this refund rule.

This keeps pricing and settlement behavior aligned.

## Example Behavior

### Example A: pre-match single-sided market

Starting state:

- `home = 0`
- `draw = 0`
- `away = 0`

If the first accepted bet lands on `home`:

- the market becomes single-sided,
- that bet uses `initialOdds.home`,
- later new `home` bets during the same single-sided phase also use `initialOdds.home`,
- `draw` and `away` are still not part of a formed mathematical market.

If no one ever bets `draw` or `away` before close:

- all accepted `home` bets are refunded in full.

### Example B: live match with score already moved

State:

- score `0-2`
- only `home` currently has accepted liquidity

Even in this live scenario:

- new `home` bets still use `initialOdds.home`,
- because the market is still single-sided,
- and the accepted tradeoff is simplicity over live mathematical precision.

### Example C: second side enters

State before order:

- `home > 0`
- `draw = 0`
- `away = 0`

If a new accepted bet lands on `draw`:

- the market becomes multi-sided immediately,
- that accepted transition is the switch point,
- all subsequent new bets use the normal mathematical model.

Previously locked single-sided bets retain their original `initialOdds`.

## Affected Areas

### Frontend display

Primary file:

- `src/app/page.tsx`

Responsibilities:

- detect whether the selected match is still single-sided,
- display `initialOdds` during that phase,
- avoid showing projected pool-driven repricing before the second side appears,
- switch to mathematical repricing immediately after the market becomes multi-sided.

### Odds engine

Primary file:

- `src/lib/odds-engine.ts`

Responsibilities:

- support an explicit bypass path for single-sided pricing,
- ensure the normal model is only used once the market is multi-sided,
- keep refund and position-limit behavior compatible with this phase distinction.

### Bet validation and persistence

Primary file:

- `src/app/api/bets/route.ts`

Responsibilities:

- validate single-sided bets against `initialOdds` rather than dynamic repriced odds,
- lock and persist the correct odds for single-sided bets,
- detect the exact order that causes the market to become multi-sided,
- ensure future bets after the switch use the normal model.

### Settlement

Primary files:

- `src/app/api/bets/route.ts`
- `src/app/api/cron/settle/route.ts`

Responsibilities:

- preserve the existing single-sided refund rule,
- ensure single-sided bets are not treated as normally settled winner/loser bets when the market never formed.

## Data Requirements

The system must be able to determine, per match:

- how many outcomes currently have accepted liquidity,
- which outcomes currently have accepted liquidity,
- whether the market is still single-sided or already multi-sided.

This can likely be derived from:

- `marketData.pools`
- or equivalent persisted pool state

No extra user-level state is required for this feature.

## Error Handling

Required behavior:

- If a market is single-sided, do not run normal projected odds logic.
- If the market transitions to multi-sided during an accepted order, persist that order correctly and switch subsequent pricing immediately.
- If pool state is inconsistent or missing, fall back conservatively to the existing single-sided refund-safe behavior rather than quoting unsupported dynamic odds.

## Testing Strategy

### Unit tests

Add tests for:

- zero-sided to single-sided transition,
- single-sided pricing uses `initialOdds`,
- live single-sided pricing still uses `initialOdds`,
- single-sided markets do not use projected pool repricing,
- multi-sided markets resume the normal mathematical model immediately.

### API tests

Add tests for:

- first accepted bet locking `initialOdds`,
- later same-side bets in single-sided phase also locking `initialOdds`,
- the second-side triggering bet causing future bets to use the dynamic model,
- full refund when the market closes single-sided.

### UI checks

Verify:

- single-sided matches show `initialOdds`,
- typing an amount in a single-sided market does not distort odds through pool math,
- after the second side gains liquidity, the selected match immediately begins dynamic repricing.

## Non-goals

- Making live single-sided odds mathematically fair.
- Changing the `8%` fee.
- Changing the single-sided refund rule.
- Introducing a staged or threshold-based transition after the second side appears.
