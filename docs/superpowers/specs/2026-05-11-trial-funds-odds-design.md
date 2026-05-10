# Trial Funds Odds Design

## Summary

This spec defines how trial-funds betting should reuse the existing main-pool odds model while applying an 8% winner fee directly inside displayed odds and settlement.

The goal is consistency:

- The selected match should recalculate `home`, `draw`, and `away` odds in real time as the user types a trial-funds amount.
- Trial-funds displayed odds, locked odds, potential payout, persisted bet records, and final settlement must all match the same mathematical basis.
- Trial-funds bets should not charge a fee when the user loses.

## Problem

Current behavior mixes two different concepts:

- Real-money bets already participate in the market model and update projected odds.
- Trial-funds mode changes some fee behavior, but the selected match odds do not fully reflect the expected mathematical model when the user enters a trial-funds amount.

This creates a mismatch between what the user expects and what the interface currently communicates.

## Product Rules

### Confirmed rules

- Trial-funds betting uses the same main-pool odds model as real-money betting.
- Only the currently selected match updates in real time while the user types an amount.
- The `home`, `draw`, and `away` odds buttons for the selected match must all refresh based on the projected pools after including the entered trial-funds amount.
- Trial-funds winner fee is 8%.
- The 8% winner fee is included at bet time inside the displayed odds.
- If the trial-funds bet loses, there is no extra fee.
- Displayed odds, locked odds, potential payout, persisted odds, and future settlement must be consistent.

### Behavioral interpretation

For trial-funds mode, the market shape remains the same as the existing pool model, but the return rate used for displayed and locked odds must reflect the 8% winner fee. In practice, this means trial-funds odds behave like the same market model with a `92%` payout return basis for winners.

## Recommended approach

Use a single odds model with mode-specific return behavior.

### Why this approach

- Preserves the current pool and risk model.
- Avoids separate trial-funds market logic.
- Makes the UI honest because the visible odds already include the winner fee.
- Keeps future settlement aligned with what the user saw when confirming the bet.

### Rejected alternatives

- Show full odds first and deduct 8% only at settlement. Rejected because the payout would differ from the visible odds.
- Build a separate trial-funds odds model. Rejected because it adds unnecessary maintenance cost and creates two price systems for one match.

## Affected areas

### UI layer

Primary file:

- `src/app/page.tsx`

Relevant responsibilities:

- Track selected match, selected outcome, entered amount, and `useBonus`.
- Recompute per-match projected odds for the selected match card.
- Recompute locked odds and potential payout panel.
- Persist the locked odds used at confirmation time.

### Odds engine

Primary file:

- `src/lib/odds-engine.ts`

Relevant responsibilities:

- Calculate display odds for `home`, `draw`, and `away`.
- Calculate locked odds for the selected outcome.
- Apply risk protections such as position limit, single-side refund behavior, fee-funded cold start handling, and minimum odds floor.

### Settlement alignment

Current and future settlement paths must use the same locked odds basis that the user saw when placing the trial-funds bet.

Files likely involved later:

- `src/app/api/bets/route.ts`
- `src/app/api/cron/settle/route.ts`

## Design

### 1. Return-rate model

The system should support two payout bases:

- Real money: keep current behavior.
- Trial funds: use the same projected pools and risk checks, but use a winner payout basis that already includes the 8% winner fee.

The cleanest design is to make the odds calculations accept an explicit return-rate override when needed, instead of encoding trial-funds logic directly into the UI.

### 2. Selected match real-time display

When a user has selected a match and typed an amount:

- If the match is the selected one, all three displayed outcome odds should be recomputed from projected pools.
- The projected pools should include the typed amount on the selected outcome.
- In trial-funds mode, those recalculated odds should use the trial-funds payout basis.
- In real-money mode, current behavior remains unchanged.

Only the selected match card should receive this real-time projection to avoid unnecessary recalculation and visual noise across the full list.

### 3. Locked odds and payout panel

The lower betting summary panel should use the same mode-aware basis as the selected match card:

- `locked odds`
- `potential payout`
- risk states such as `position_limit`, `counterparty`, and `refund_single_side`

If trial-funds mode is active, the locked odds must already be net of the 8% winner fee. The potential payout shown to the user must equal `bet amount * locked odds`.

### 4. Post-bet optimistic updates

After a successful bet:

- The local optimistic pool update should continue using the effective amount added to the market.
- The stored bet should keep the exact locked odds used at submission.
- Subsequent displays of that bet should reuse the persisted locked odds rather than recalculate from a different rule.

This avoids drift between pre-bet display and post-bet history.

### 5. Settlement consistency

Trial-funds settlement must not apply an additional 8% deduction on top of an odds value that already included that deduction.

There must be exactly one source of truth:

- Either the locked odds are already net of the fee, and settlement pays strictly from locked odds.

This spec chooses that model.

## Data flow

### Before bet placement

1. User selects match and outcome.
2. User enters amount.
3. UI determines betting mode from `useBonus`.
4. UI computes projected pools for the selected match.
5. UI requests display odds and locked odds from the odds engine using the same mode-aware return basis.
6. UI renders updated `home`, `draw`, and `away` buttons plus the summary panel.

### At bet placement

1. UI locks the current odds.
2. UI persists the bet with the locked odds and `useBonus` flag.
3. UI applies optimistic pool changes locally.

### At settlement

1. Settlement reads the locked odds for the bet.
2. If the trial-funds bet wins, payout uses the stored locked odds directly.
3. No second fee deduction is applied.

## Error handling

The following existing protections remain in force for both real-money and trial-funds bets:

- Position limit rejection.
- Low-odds or no-solution rejection.
- Single-sided market refund state.
- Cold-start handling and minimum odds floor.

Additional rule:

- Trial-funds mode must never show a displayed odds basis that differs from the locked odds basis.

If the engine cannot produce a valid odds result for the projected trial-funds input, the UI should continue to block confirmation exactly as it does for invalid real-money projections.

## Testing strategy

### Unit-level checks

Add targeted tests around the odds engine and any extracted helper logic to confirm:

- Trial-funds mode uses the same pool projection as real money.
- Trial-funds mode applies the 8% winner fee through the return-rate basis.
- Locked odds and display odds are aligned for the same projected state.
- Risk states still trigger correctly in trial-funds mode.

### UI-level checks

Verify for the selected match only:

- Typing an amount in trial-funds mode updates all three visible odds buttons.
- The locked odds panel matches the selected outcome button basis.
- Potential payout matches `amount * locked odds`.

### Regression checks

Verify that real-money flow remains unchanged:

- Real-money odds still update as before.
- Referral and commission behavior for real money is unaffected.
- Trial-funds mode does not leak real-money commission settings into trial-funds payout calculations.

## Implementation notes

The likely implementation shape is:

- Introduce a small mode-aware return-rate helper in the UI or odds engine boundary.
- Reuse the existing projected-pools flow.
- Pass the correct return-rate override into both the per-card display calculation and the locked-odds calculation.
- Audit settlement to ensure locked trial-funds odds are not charged an extra fee later.

This should remain a focused change, not a full odds-engine rewrite.

## Non-goals

- Creating a separate trial-funds betting pool.
- Repricing every match card on the page while the user types.
- Changing real-money commission or referral behavior.
- Redesigning the broader betting UI.
