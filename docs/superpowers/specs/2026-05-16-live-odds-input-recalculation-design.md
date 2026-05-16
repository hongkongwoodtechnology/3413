# Live Odds Input Recalculation Design

## Summary

This spec fixes the match card odds buttons so they update immediately while the user types a bet amount for a match that already has live pool data.

The selected behavior is:

- when the user types in the bet amount input, the focused match card recalculates odds immediately
- all three outcome buttons update together: home, draw, away
- real-money preview uses the same net-to-pool amount as the actual betting flow
- trial-funds preview continues using the full entered amount
- first-bet and single-sided initial-odds states do not live-recalculate the displayed odds
- trial-funds guardrails remain unchanged while adding live button updates

## Problem

The current page shows a mismatch between user intent and displayed odds.

Observed issue:

- the user selects a match and begins entering a bet amount
- the outcome buttons continue showing stale odds or odds that do not fully reflect the actual execution model
- the preview logic in the card uses gross `betAmountNum` directly in projected pools instead of the effective pool amount used by the real betting split

This creates two problems:

1. the user does not see immediate mathematical feedback while typing
2. the displayed button odds can diverge from the real execution model for real-money bets

## Confirmed Product Decision

- Odds must update immediately while typing in the amount input.
- The recalculation applies to the currently focused match card.
- All three buttons must update together, not only the selected outcome.
- Real-money input preview uses post-fee pool contribution.
- Trial-funds input preview uses full entered amount.
- First-bet input does not immediately change displayed odds.
- Trial-funds match cap remains cumulative `15%` of the current real-money pool for that match.
- The cap base only uses the current real-money pool, not trial-funds stake.
- When the real-money pool grows, the allowed cumulative trial-funds amount grows with it.
- Trial-funds still cannot be the first accepted bet of a match.
- The term `first bet` means the first accepted bet of the entire match pool, not the first bet of a specific user.
- Real-money bets are not constrained by the trial-funds cap rule.
- The behavior should match the same odds model used for quote and order locking as closely as possible.

## Approaches Considered

### Recommended: focused-card immediate projected odds recalculation

When the selected match has a typed amount, derive a projected pool increment and recompute the displayed `home/draw/away` button odds for that one card on every input change.

Why this is recommended:

- matches the requested UX exactly
- keeps computation local to the active card
- avoids recalculating unrelated match cards
- keeps preview closer to the actual pricing model

### Alternative: update only the selected outcome quote

Only refresh the selected outcome price and leave the other two buttons unchanged.

Rejected because:

- does not satisfy the request that main, draw, and away odds all update
- hides the market impact of the typed bet on the other sides

### Alternative: debounced recalculation

Wait 150 to 300 ms after typing stops, then recompute the odds.

Rejected for now because:

- weaker user feedback than true immediate update
- unnecessary unless performance becomes a real issue

## Affected Areas

Primary page components:

- `src/app/[locale]/page.tsx`
- `src/app/page.tsx`

Pricing logic reused by the page:

- `src/lib/odds-engine.ts`
- `src/lib/wallets.ts`

Likely tests:

- `src/app/[locale]/page.test.tsx`
- `src/app/page.test.tsx`

## Existing Behavior

The match card already contains a projected-odds branch for a focused card:

- it checks whether the current card is selected and the entered amount is greater than zero
- it builds projected pools
- it recomputes displayed odds

However, the current preview path has an important mismatch:

- for real-money bets, it adds the gross input amount directly into projected pools
- the actual bet flow uses `splitBetAmount()` and sends only the net pool amount into the pool

This means the preview can look responsive in some cases, but still not reflect the true execution basis.

## Design

### 1. Immediate recalculation trigger

The recalculation should happen whenever any of the following changes:

- selected match
- selected outcome
- amount input
- bet mode that changes pool contribution semantics
- pricing inputs already used by current odds derivation

No explicit submit action is required for odds button refresh.

### 2. Focus scope

Only the active match card should use projected odds while typing.

Definition of active card:

- `selectedMatchId === match.id`
- entered amount is greater than zero

All other cards continue rendering normal live odds from current market data without projection.

### 3. Projected pool increment source

The preview must use the same effective contribution semantics as the actual betting path.

For real-money bets:

- compute the split with `splitBetAmount(enteredAmount, commissionRate, currentRealPool)`
- use `split.pool` as the projected pool increment

For trial-funds bets:

- use the full entered amount as the projected pool increment

This makes the displayed odds track the actual economic impact of the order instead of the raw typed amount.

### 3.5. Trial-funds companion rules

The new live button refresh behavior must preserve the existing trial-funds product guardrails.

Those guardrails are:

- the match-wide trial-funds cap remains `15%`
- the cap base is the current real-money pool for the match
- accepted real-money growth increases the trial-funds cap dynamically
- trial-funds cannot establish the first real pool state for a match
- the `first bet` definition is pool-wide for that match, not user-specific
- real-money bets are not evaluated by this trial-funds cap branch

This means the UI may update projected odds immediately for trial-funds typing, but the backend acceptance rules remain governed by the current cap and first-bet restrictions.

### 4. Three-button synchronization

Once the projected pool increment is derived, the card should recompute and display:

- home odds
- draw odds
- away odds

These values should be recalculated together from the same projected pool state so the user sees the entire market move consistently.

### 5. Single-sided and initial-odds behavior

The immediate-update behavior must preserve current product rules for single-sided markets.

If the match remains in an initial or single-sided phase:

- continue showing `initialOdds`
- do not create misleading pseudo-live projected odds
- this includes first-bet input on an otherwise empty or still single-sided market

Once the market is in a normal multi-sided phase:

- use projected pool calculations and the existing display odds model

### 6. Model consistency

The following preview surfaces should share the same projected input basis where applicable:

- match card button odds
- selected outcome quote preview
- potential return preview

This does not require all values to come from the same function call, but they must use the same effective pool contribution semantics so users do not see contradictory pricing.

### 7. Risk display

Immediate button updates do not remove current risk controls.

If the typed amount would breach an existing risk rule:

- keep current warning behavior for the selected quote and order action
- button display may still reflect the projected market movement, as long as the order action remains correctly blocked
- this includes trial-funds cap rejection and trial-funds first-bet rejection

If implementation complexity makes this inconsistent, prefer preserving current blocking behavior over adding new UI states in this pass.

## Data Flow

1. User selects a match and optionally an outcome.
2. User types an amount into the input.
3. The page derives `betAmountNum`.
4. The focused card computes the projected pool increment:
   - real money uses `splitBetAmount().pool`
   - trial funds use full amount
5. The page adds that projected increment to the selected outcome pool for the focused card.
6. The page recalculates `home/draw/away` display odds for that card.
7. The three outcome buttons update immediately.

Special case:

- if the current market is still in first-bet or single-sided initial-odds mode, skip live odds mutation and continue rendering `initialOdds`

## Error Handling

- If the typed amount is empty or invalid, show normal non-projected odds.
- If no match is selected, do not project anything.
- If no outcome is selected, the page may keep normal odds or preserve current focused-card behavior; do not invent a new interaction model in this pass.
- If market data is missing, keep the current fallback logic and do not crash the card.
- If split calculation yields an invalid number, fall back to normal displayed odds rather than rendering broken values.
- If the typed trial-funds amount would exceed the dynamic `15%` cap, preserve current enforcement behavior at order time.
- If the match has no real-money pool yet, trial-funds preview may still render the current allowed display state, but order-time first-bet rejection remains unchanged.
- Interpret first-bet checks against the entire match pool state, not the current user's personal history.

## Scope

In scope:

- immediate odds-button refresh while typing
- synchronized update of home/draw/away buttons on the focused card
- use of net pool contribution for real-money projection
- preservation of current trial-funds preview semantics
- preservation of current trial-funds cap and first-bet restrictions
- focused regression tests

Out of scope:

- redesigning the betting panel layout
- changing fee percentages
- changing backend locked-odds behavior
- cross-card preview updates
- new animation systems or UX polish beyond live value refresh

## Testing

Recommended focused coverage:

- selected match card updates all three displayed odds when amount input changes
- real-money mode uses net pool contribution rather than gross amount
- trial-funds mode uses full entered amount
- non-selected cards do not project based on the active input
- zero or empty input restores normal displayed odds
- first-bet and single-sided market still show initial odds instead of false projected live odds
- real-money bets remain unaffected by the trial-funds cap rule
- trial-funds cap basis remains tied to current real-money pool growth

Manual verification:

1. Open a match that already has pool activity.
2. Select the match and one outcome.
3. Type `0.01`, `0.02`, `0.05` into the amount input.
4. Confirm the three odds buttons update immediately on each change.
5. Compare real-money mode and trial-funds mode to confirm different pool contribution behavior.
6. Clear the input and confirm the buttons return to normal market odds.
7. Open an empty or still single-sided market and confirm first-bet typing does not change the initial displayed odds.
8. Grow the real-money pool and confirm the trial-funds allowance grows with it.
9. Confirm real-money bets are not blocked by the trial-funds cap behavior.

## Expected Outcome

After this change:

- the user sees odds react immediately while typing
- the three outcome buttons remain in sync
- real-money previews reflect post-fee pool impact
- displayed button odds better match the actual pricing model used for betting
- first-bet displays remain stable at initial odds until the market leaves the initial single-sided phase
- live trial-funds previews coexist with the existing 15% cap and first-bet restrictions without changing their product meaning
