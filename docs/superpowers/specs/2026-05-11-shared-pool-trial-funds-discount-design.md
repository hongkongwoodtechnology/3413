# Shared Pool Trial Funds Discount Design

## Summary

This spec defines a unified-pool market model where:

- real-money bets and trial-funds bets participate in the same market pool,
- both contribute to market exposure and payout obligations,
- trial-funds bets use a discounted locked odds rule,
- the discount factor is fixed at `0.8`,
- an extreme last-resort market-wide refund rule is allowed if the market reaches an unrecoverable payout-risk state.

The goal is to keep one shared market while reducing trial-funds payout pressure through lower trial-funds odds, instead of splitting real-money and trial-funds into separate pools.

## Confirmed Rules

- Real money and trial funds use the same betting pool.
- Trial funds do not require wallet transaction confirmation.
- Trial-funds bets still enter the same market `pools` and `liabilities`.
- Trial-funds locked odds are derived from the normal market odds and then multiplied by `0.8`.
- Real-money bets keep the normal market odds.
- Single-sided first-bet rules still apply:
  - if the bet leaves the market single-sided, use `initialOdds`,
  - if the bet creates the second side, that bet immediately uses the mathematical model.
- In extreme unrecoverable conditions, the platform may trigger a market-wide refund for all participants.

## Product Intent

The platform wants:

- one real market,
- one shared pool,
- one shared risk book,
- but lower payout pressure for trial funds.

So the platform does **not** separate trial funds into a simulation-only pool. Instead, it keeps a shared pool and uses a lower trial-funds price to offset risk.

## Core Pricing Rule

### Real-money bets

Real-money locked odds are produced by the normal market model:

- `initialOdds` in single-sided first-bet situations,
- mathematical pricing once the market is multi-sided,
- existing solvency constraints, position limits, and attraction-window rules remain in force.

### Trial-funds bets

Trial-funds locked odds use the same market-derived base odds and then apply a fixed multiplier:

```text
trialFundsLockedOdds = marketLockedOdds * 0.8
```

Where:

- `marketLockedOdds` is the odds value that would have applied to a real-money bet under the same market conditions,
- `0.8` is the fixed trial-funds discount factor.

Example:

```text
marketLockedOdds = 2.50
trialFundsLockedOdds = 2.50 * 0.8 = 2.00
```

## Market Participation

Trial-funds bets must still:

- update the same `pools`,
- update the same `liabilities`,
- affect the same market-risk state,
- be included in the same solvency logic.

This is required because trial-funds wins are allowed to settle from the same shared pool logic.

If trial funds were excluded from pool and liability accounting, the displayed and accepted market risk would become misleading and could produce underfunded payout states.

## Display Rules

### Public market odds

The product may continue to use one visible odds display per user context:

- real-money users see the normal market odds,
- trial-funds users see the discounted trial-funds odds they would actually receive.

This keeps the displayed price aligned with what the user would lock.

### Important consistency rule

Whichever odds are shown to the user must match:

- displayed odds,
- locked odds,
- persisted odds,
- `netPayout`,
- settlement result.

There must not be one number shown in the UI and a different number saved or settled later.

## Single-Sided Market Behavior

The previously confirmed single-sided rule still applies.

### If the bet leaves the market single-sided

Examples:

- only `home` has funds and the new bet is also on `home`,
- only `away` has funds and the new bet is also on `away`.

Then:

- real money uses `initialOdds`,
- trial funds also start from `initialOdds`,
- and trial-funds locked odds then apply the `0.8` multiplier if the product chooses to keep the discount even in single-sided mode.

Recommended direction:

- keep the discount consistently applied to trial funds even in single-sided accepted bets,
- so trial funds are always priced by:

```text
trialFundsLockedOdds = baseLockedOdds * 0.8
```

where `baseLockedOdds` may be `initialOdds` or market-model odds depending on phase.

### If the bet creates the second side

Examples:

- only `home` has funds and the new bet is on `draw`,
- only `home` has funds and the new bet is on `away`.

Then:

- that bet immediately uses the mathematical model,
- and trial funds then apply the `0.8` multiplier to the mathematical-model result.

## Settlement Rules

### Real-money bets

- settle normally using stored locked odds / net payout,
- wallet-confirmed funding flow remains unchanged.

### Trial-funds bets

- do not require wallet confirmation at bet placement,
- still settle using stored locked odds / net payout,
- payout is credited through the platform ledger mechanism for trial funds,
- but the market exposure comes from the same shared-pool logic.

## Extreme-Risk Safety Rule

The platform accepts a final fallback:

- if the market enters an extreme unrecoverable condition,
- the platform may refund all bets in that market.

This is a last-resort safety brake, not a normal settlement path.

It should only be triggered when the market cannot be safely resolved under the shared-pool exposure model.

## Affected Areas

### Frontend

Primary file:

- `src/app/page.tsx`

Responsibilities:

- if user is betting with real money, display normal market odds,
- if user is betting with trial funds, display discounted odds,
- keep display aligned with the actual locked odds that would be saved.

### Bet-mode helpers

Primary file:

- `src/lib/bet-mode.ts`

Responsibilities:

- centralize the trial-funds discount factor,
- expose a helper to convert market odds into trial-funds locked odds.

### Odds engine

Primary file:

- `src/lib/odds-engine.ts`

Responsibilities:

- continue producing the base market odds,
- let callers derive trial-funds locked odds from that base value,
- preserve existing single-sided and multi-sided phase behavior.

### Bet API

Primary file:

- `src/app/api/bets/route.ts`

Responsibilities:

- skip wallet-confirmation requirements for trial funds,
- still write the bet into the shared market pool and liabilities,
- persist discounted trial-funds locked odds,
- persist net payout based on discounted odds.

### Settlement

Primary file:

- `src/app/api/cron/settle/route.ts`

Responsibilities:

- settle both real-money and trial-funds bets from stored locked odds / net payout,
- preserve market-wide refund capability for extreme cases.

## Data Requirements

Need a shared source of truth for:

- whether the bet is real money or trial funds,
- the stored locked odds,
- the stored net payout,
- the shared pool and liability state,
- whether an emergency market-wide refund has been triggered.

## Testing Strategy

### Unit tests

Add tests for:

- trial-funds odds discount `0.8`,
- real-money odds unchanged,
- single-sided same-side trial bet,
- second-side-creating trial bet,
- stored net payout uses discounted odds.

### API tests

Add tests for:

- trial-funds bet placement without wallet confirmation,
- trial-funds bet still updating shared market pools and liabilities,
- discounted locked odds persistence,
- discounted net payout persistence,
- market-wide refund fallback if implemented.

### UI checks

Verify:

- real-money mode shows normal odds,
- trial-funds mode shows discounted odds,
- switching between modes updates the displayed odds,
- the displayed trial-funds odds match the saved locked odds.

## Non-goals

- Creating separate real-money and trial-funds pools.
- Making trial funds invisible to shared-pool risk.
- Keeping public odds fixed to real-money-only math while still settling trial funds from the same pool.

## Fixed Parameters

- `trialFundsOddsMultiplier = 0.8`
