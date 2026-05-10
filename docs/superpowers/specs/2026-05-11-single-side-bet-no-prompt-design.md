# Single-Side Bet No Prompt Design

## Summary

This spec removes the confirmation dialog shown when a user places a bet into a single-sided market.

The current dialog says:

- "目前只有此選項有投注，如比賽前仍無人投注其他選項，所有投注將全額退款（不扣手續費）。確定要繼續投注嗎？"

The new behavior is intentionally minimal:

- do not show the dialog
- do not replace it with any inline message
- keep the existing `refund_single_side` risk classification and settlement behavior unchanged
- continue straight into the normal bet execution flow

## Problem

The current UI interrupts single-side betting with a browser confirmation dialog. The user has explicitly requested that this prompt be removed entirely.

This is a presentation-level change, not a market-rules change.

## Confirmed Product Decision

- Single-side betting must remain allowed.
- The browser `confirm` dialog must be removed.
- No replacement toast, banner, modal, or inline warning should be added.
- If the odds engine returns `refund_single_side`, the system should still submit the bet normally.
- Existing refund behavior remains unchanged if no opposing side enters before settlement rules trigger.

## Approaches Considered

### Recommended: remove only the prompt branch

Keep the `refund_single_side` state from the odds engine, but stop asking for user confirmation.

Why this is recommended:

- smallest and safest change
- preserves current domain logic
- avoids coupling UI preference with market logic
- reduces regression risk for payout and refund flows

### Alternative: convert the prompt into inline copy

Rejected because the user requested no visible reminder.

### Alternative: remove the `refund_single_side` classification entirely

Rejected because that state still has value inside the odds and risk model, and removing it would unnecessarily widen scope.

## Affected Area

Primary file:

- `src/app/page.tsx`

Primary function:

- `handlePrediction()`

Current behavior:

- when `projectedOdds.riskLevel === 'refund_single_side'`, the UI opens `window.confirm(...)`
- if the user confirms, it calls `executePrediction(projectedOdds.odds)`
- if the user cancels, it stops

Target behavior:

- when `projectedOdds.riskLevel === 'refund_single_side'`, the UI immediately calls `executePrediction(projectedOdds.odds)`
- no dialog is shown
- no cancellation branch exists for this case

## Design

### UI behavior

Inside `handlePrediction()`:

1. keep the existing `position_limit` handling as-is
2. keep the existing `projectedOdds === null` handling as-is
3. keep the `refund_single_side` branch check
4. remove the `window.confirm(...)` call and its conditional early return
5. directly call `executePrediction(projectedOdds.odds)` for `refund_single_side`
6. keep the default success path unchanged for all other risk states

### Data and settlement behavior

No backend or settlement change is part of this spec.

Specifically unchanged:

- locked odds generation
- bet persistence
- refund processing rules
- payout logic
- single-side market classification in the odds engine

## Testing

Recommended verification:

- confirm that clicking bet in a `refund_single_side` scenario no longer opens a confirmation dialog
- confirm that the same click still proceeds into the normal bet submission flow
- confirm that other guarded states such as `position_limit` remain unchanged

Low-cost regression coverage:

- add a focused test around the extracted behavior if practical
- if the page structure makes that expensive, rely on a minimal code-path change plus targeted manual verification

## Scope

In scope:

- remove the single-side confirmation prompt

Out of scope:

- changing refund policy
- changing risk labels
- adding new UX copy
- refactoring the odds engine
- changing backend API behavior
