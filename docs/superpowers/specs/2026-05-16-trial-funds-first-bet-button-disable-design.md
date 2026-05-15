# Trial Funds First-Bet Button Disable Design

Date: 2026-05-16

## Context

The backend already rejects trial-funds bets that try to become the first bet in an empty match pool.

That backend rule is correct, but the desired user experience is now different:

- do not show a transaction-failed message for this scenario
- do not let the user press `confirm prediction` when the frontend can already determine the bet would be blocked

The frontend already has access to enough match state to make this determination before submission.

This design adds a frontend-only prevention rule for the confirm button while leaving the backend validation in place as the source-of-truth fallback.

## Problem Statement

Current behavior:

- a user can select trial funds on a zero-pool match
- the confirm button remains clickable
- the request is sent and then rejected by the backend
- the user experiences the case as a failed transaction

Desired behavior:

- if trial funds would become the first bet in the match pool, the confirm button should already be disabled
- no extra frontend warning copy is required
- no frontend-only fake success or fake failure state should be added

## Goals

- Prevent the user from pressing `confirm prediction` when trial funds would be the first bet of the match.
- Keep the UI behavior silent: disable only, with no extra tooltip, banner, or inline warning.
- Apply the same rule to both `src/app/page.tsx` and `src/app/[locale]/page.tsx`.
- Preserve the backend first-bet restriction as the final safety check.

## Non-Goals

- No change to backend validation in `src/app/api/bets/route.ts`.
- No change to the awaited-save timing fix already added to the frontend.
- No new helper text, modal copy, or translated explanatory message for this case.
- No broader redesign of button states or prediction form UX.

## Recommended Approach

Add a derived frontend boolean for “trial funds first-bet blocked” and include it in the existing confirm-button `disabled` logic.

### Why this approach

This is the smallest change that matches the requested UX:

- the button simply cannot be pressed
- there is no extra message to maintain or translate
- it avoids triggering the backend rejection in normal usage
- it keeps the existing backend protection for stale-data or race-condition cases

## Detailed Behavior

### Blocking condition

The confirm button is disabled when all of the following are true:

1. `useBonus === true`
2. a `currentMatch` is selected
3. the current real pool for the selected match is `0`

Pool detection should use this priority:

1. `currentMatch.marketData.realTotalPool` when `marketData` exists
2. otherwise fallback to `currentMatch.pools.home + currentMatch.pools.draw + currentMatch.pools.away`

This matches the existing frontend data model and avoids adding new fetches.

### Confirm button behavior

When the blocking condition is true:

- the confirm button becomes disabled
- the button text remains unchanged
- no tooltip, inline note, toast, or alert is shown

When the blocking condition is false:

- the confirm button follows the existing behavior for amount, connection, processing, and success-state locking

### Interaction with other rules

This new button disable check is additive. It should coexist with the current disabled conditions:

- user not connected
- missing amount
- transaction currently processing
- success state currently shown

It does not replace:

- projected odds validation
- position-limit rejection
- single-side refund flow
- backend first-bet restriction
- backend trial-funds cap restriction

## File Scope

Implementation is expected to touch only:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/page.test.tsx`
- `src/app/[locale]/page.test.tsx`

No backend files are part of this change.

## Test Strategy

Add or update focused page-level tests for both page variants.

Required coverage:

1. zero-pool match + trial funds => confirm button is disabled
2. non-zero-pool match + trial funds => confirm button is enabled when other existing conditions allow it
3. zero-pool match + real money => confirm button is enabled when other existing conditions allow it

The tests should verify the button state directly rather than relying on alerts or request assertions.

## Risks And Mitigations

### Risk: frontend and backend can still disagree briefly

Because match state is client-side, there can still be rare stale-data cases.

Mitigation:

- keep the backend first-bet restriction unchanged
- treat the frontend rule as a UX prevention layer, not as the sole enforcement layer

### Risk: hidden reason for disabled button

The button is disabled without explanation by design.

Mitigation:

- this is intentional and follows the explicit product direction for this case
- no additional copy should be introduced as part of this change

## Acceptance Criteria

- On both page variants, trial funds cannot press `confirm prediction` when the selected match pool is still zero.
- On both page variants, real money can still press `confirm prediction` on a zero-pool match when other normal conditions are satisfied.
- On both page variants, trial funds can still press `confirm prediction` once the selected match pool is non-zero.
- The button remains silent: disabled only, with no added explanatory message.
- The backend first-bet restriction remains unchanged.

## Out Of Scope Follow-Ups

These are intentionally not part of this change:

- adding tooltip or inline explanation for the disabled state
- removing or weakening the backend first-bet validation
- consolidating the page and localized page into a shared prediction form component
