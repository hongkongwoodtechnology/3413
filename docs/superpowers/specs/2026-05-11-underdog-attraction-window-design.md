# Underdog Attraction Window Design

## Summary

This spec defines a new underdog pricing rule for extremely imbalanced markets while keeping the existing `8%` platform fee unchanged and preserving the "platform does not inject principal capital" constraint.

The rule introduces a limited attraction window for cold underdog sides:

- Early underdog liquidity should remain attractive.
- Solvency remains the first priority.
- Once the attractive window is consumed, odds should fall quickly toward the existing safe payout boundary.
- Users must not be able to repeatedly split small bets to farm the attractive price band.

## Problem

In an imbalanced market such as:

- `home = 100`
- `draw = 50`
- `away = 0`

the current pure solvency-constrained pool model creates two bad outcomes:

1. If the system allows fully uncapped early pricing, very small bets can receive extreme odds, making `1` unit disproportionately attractive.
2. If the system suppresses that with too much virtual depth, the underdog side loses appeal and users are not incentivized to bet it at all.

The product goal is not to make all underdog bet sizes look attractive. The goal is to keep the first small amount of underdog betting attractive, then rapidly return pricing to solvency-safe levels.

## Product Rules

### Confirmed rules

- The platform fee remains `8%`.
- The platform should not inject principal capital into the market.
- Solvency has higher priority than attractiveness.
- For extreme underdog sides, only the first `10` units of attracted liquidity need to stay meaningfully attractive.
- After the first `10` units, odds should decline rapidly.
- If the market cannot safely support more underdog liability, the system should reduce odds sharply or reject the bet.
- The attractive window must be tracked at the market-outcome level, not per individual order, to prevent split-order abuse.

### Interpretation

This design does not try to make large underdog bets pretty. It explicitly allows a short underdog attraction phase, then transitions to strict solvency-led pricing. This matches the business goal:

- encourage the first balancing bets,
- do not subsidize large imbalance-taking bets,
- do not alter the fee model.

## Recommended Approach

Use a three-layer pricing model for underdog attraction:

1. `Attraction window`
2. `Fast convergence to solvency`
3. `Hard solvency and max-bet protection`

### Why this approach

- Preserves the current no-principal-injection business model.
- Keeps the `8%` fee untouched.
- Improves cold underdog appeal without pretending the pool can support large high-odds bets.
- Prevents a user from extracting all favorable pricing with repeated tiny orders.

## Core Design

### 1. Attraction window

Each market outcome should expose a limited "attractive underdog quota" for cold or near-cold sides.

Initial recommended parameter:

- `attractionWindowSize = 10`

Meaning:

- Only the first `10` total units of accepted liquidity on that underdog side may receive the attractive-window treatment.
- This is cumulative for the market outcome, not reset per user or per bet.

Example:

- If `away` has already consumed `8` units of attraction window, the next bet only has `2` units eligible for attractive pricing.
- Any remaining part of the same order must be priced by the post-window logic.

### 2. Attraction-window cap

During the attraction window, the outcome may use an attractive but capped odds ceiling.

Initial recommended parameter:

- `attractionWindowMaxOdds = 15.0`

Meaning:

- During the attractive window, early underdog bets may receive favorable odds up to this ceiling.
- The actual quoted odds must still not violate the market's solvency constraint.

The final odds during the attraction window therefore become:

```text
final odds = min(attractive quoted odds, attraction window cap, solvency-safe odds)
```

This ensures the cap is not a subsidy. It is only a presentation and pricing ceiling within solvency.

### 3. Fast convergence after the first 10 units

Once the attractive window is exhausted, the model should stop trying to preserve underdog attractiveness and instead rapidly converge to the standard solvency-safe market odds.

Meaning:

- For exposure above the first `10` units, pricing should tighten quickly.
- Large bets should no longer enjoy underdog-promotional pricing.
- The model should approach the same safe pricing boundary that the current engine already enforces.

This is not a second promotional tier. It is an explicit transition back to the existing safe system.

### 4. Split-bet resistance

The attractive window must be accounted for cumulatively per:

- `matchId`
- `outcome`

not per request.

Otherwise, a user could place:

- `1 + 1 + 1 + 1 + ...`

and repeatedly consume the first-bet attractive pricing, which defeats the purpose of the protection.

Required behavior:

- The engine must know how much of the attractive quota has already been consumed for that outcome.
- Each new bet only receives attractive treatment for the remaining eligible amount, if any.
- The rest of the order must be priced by the post-window fast-convergence rule.

### 5. Solvency-first final bound

Regardless of attraction logic, the final accepted odds must never exceed the payout the real pool can support.

The system must preserve the current principle:

```text
final accepted odds <= solvency-safe odds
```

If the requested bet size would push the safe odds below the platform's acceptable minimum, the system should reject the bet instead of displaying a cosmetically attractive but unfundable price.

## Example Behavior

Given:

- `home = 100`
- `draw = 50`
- `away = 0`
- fee unchanged at `8%`
- attraction window size `10`
- attraction window max odds `15.0`

Expected behavior:

- `away bet 1`: attractive odds may be shown, but not above `15.0` and not above solvency-safe odds.
- `away bet 5`: still within the attraction window, attractive pricing can still apply.
- `away bet 10`: last full size still eligible for attraction-window treatment.
- `away bet 20`: only the first `10` total eligible units can receive attractive-window treatment; the rest must be priced by the fast-convergence rule.
- `away bet 50` or `100`: pricing should be much closer to strict solvency-safe odds, and the system may reject if the implied odds fall below acceptable minimum levels.

## Affected Areas

### Odds engine

Primary file:

- `src/lib/odds-engine.ts`

Responsibilities to extend:

- detect cold underdog outcomes,
- account for cumulative attraction-window usage,
- price partial orders where only part of the order remains eligible,
- combine attractive pricing with solvency-safe caps.

### Frontend display

Primary file:

- `src/app/page.tsx`

Responsibilities:

- show odds that already reflect the underdog attraction window if applicable,
- keep displayed odds, locked odds, and potential payout aligned,
- avoid showing a price that the backend would later refuse.

### Bet persistence

Primary file:

- `src/app/api/bets/route.ts`

Responsibilities:

- validate the final locked odds under the new rule,
- persist the accepted odds,
- persist any additional metadata required to support attraction-window accounting if needed.

### Settlement

Primary file:

- `src/app/api/cron/settle/route.ts`

Responsibilities:

- settlement should remain driven by stored locked odds / net payout,
- this feature should not introduce a second settlement adjustment.

## Data Requirements

The system likely needs per-match, per-outcome tracking for attraction-window consumption.

Minimum conceptual state:

```text
attractionWindowUsed[matchId][outcome]
```

This can live either:

- directly in market data,
- or in derived state reconstructed from accepted bets for that match and outcome.

Preferred direction:

- store it in market state so the UI and backend validation use the same source of truth and do not need to recompute it from all historical bets on every request.

## Error Handling

Required behaviors:

- If the attraction window is already exhausted, skip the attractive pricing logic and use post-window pricing immediately.
- If the safe payout boundary is below the attractive quoted price, lower the odds to the safe boundary.
- If the safe payout boundary is below the minimum acceptable odds, reject the bet.
- If a single bet spans both eligible and non-eligible portions of the attraction window, compute one final locked odds from the combined pricing result before saving the order.

## Testing Strategy

### Unit tests

Add targeted tests for the odds engine covering:

- cold underdog with zero or near-zero pool,
- first `1`, `5`, and `10` units receiving attractive treatment,
- partial-order split where only part of the bet remains inside the attraction window,
- attraction window exhausted,
- attractive quoted odds capped by solvency-safe odds,
- split-order abuse resistance through cumulative window tracking.

### API tests

Add server tests for:

- order validation when attraction window remains,
- order validation when only part of the order remains eligible,
- rejection when solvency-safe odds become too low,
- persistence of the final locked odds and any market-level attraction-window bookkeeping.

### UI checks

Verify:

- displayed odds equal backend-accepted locked odds,
- potential payout uses the same final odds,
- odds fall quickly after the first `10` units of underdog-side accepted liquidity,
- the UI does not keep showing the attractive-window price after the quota has already been consumed.

## Non-goals

- Changing the `8%` fee.
- Injecting protocol principal to support pricing.
- Making all underdog bet sizes attractive.
- Replacing settlement logic with a new payout scheme.

## Initial Parameters

Start with:

- `attractionWindowSize = 10`
- `attractionWindowMaxOdds = 15.0`

These are deliberately conservative first-pass values. They should be treated as business parameters that can be tuned later after observing real betting behavior.
