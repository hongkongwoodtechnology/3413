# Bet UI Success Timing Design

Date: 2026-05-16

## Context

The backend `POST /api/bets` endpoint already rejects invalid bets such as:

- trial funds opening an empty pool
- trial funds exceeding the per-match cap

The remaining bug is in the frontend bet submission flow in:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`

Both pages currently apply optimistic local updates before the `/api/bets` response is known. When the backend rejects the bet, the UI can still briefly or permanently look successful because local pool state, local bet history, local balances, and success status are updated too early.

This spec defines a frontend-only correction for submission timing. It does not change backend risk rules.

## Problem Statement

Current behavior:

- the page updates local pool totals before `/api/bets` succeeds
- the page appends the bet into local history before `/api/bets` succeeds
- the page deducts local balance or trial balance before `/api/bets` succeeds
- the page sets success state before `/api/bets` succeeds
- if `/api/bets` rejects, the current code only logs the error and returns

Result:

- the UI can show a successful bet that the backend never accepted
- users can believe a rejected trial-funds first bet actually entered the pool
- frontend and backend state can diverge until a later refresh

## Goals

- Ensure the UI only presents a bet as successful after `/api/bets` confirms success.
- Prevent rejected bets from mutating local pools, local bet history, or local balances.
- Keep the fix narrowly scoped to the two page-level bet submission flows and their tests.
- Preserve the current backend validation contract and error codes.

## Non-Goals

- No change to backend risk logic in `src/app/api/bets/route.ts`.
- No change to payout, refund, attraction-window, or odds-adjustment rules.
- No new realtime synchronization or server-push mechanism.
- No redesign of transaction progress UI outside of success timing.

## Recommended Approach

Use backend save success as the gate for all user-visible success state.

### Why this approach

This is safer than keeping optimistic updates and adding rollback logic because:

- the existing page flow already has many related local mutations
- rollback would need to reverse pools, bet history, balances, and status in both page variants
- partial rollback bugs would be easy to introduce and hard to validate

Waiting for `/api/bets` success keeps the state model straightforward:

- submit
- wait for backend confirmation
- only then commit local success updates

## Detailed Behavior

### Real-money bet flow

For the real-money path:

1. Keep the current wallet and chain submission behavior.
2. Keep any existing transaction progress states that indicate signing or pending confirmation.
3. After the on-chain step succeeds, call `/api/bets` as an awaited step in the main flow.
4. Only if `/api/bets` returns success should the page:
   - update local match pool state
   - append the bet to local bet history
   - deduct local displayed balance
   - mark the flow as successful
   - trigger dependent follow-up calls
5. If `/api/bets` fails, route the error into the existing failure path and do not commit any success-side local mutations.

### Trial-funds bet flow

For the trial-funds path:

1. Keep the current no-wallet path where applicable.
2. Call `/api/bets` as an awaited step before any local success mutation.
3. Only after a successful response should the page:
   - update local match pool state
   - append the bet to local bet history
   - deduct local displayed trial balance
   - mark the flow as successful
4. If `/api/bets` rejects, show the existing failure behavior and leave local state unchanged.

### Error handling

The frontend should treat these cases as failures:

- `response.ok === false`
- parsed JSON missing `success: true`
- parsed JSON containing an error payload for risk rejection
- network or parsing failure while calling `/api/bets`

For these failures:

- throw into the current `catch` path instead of logging and returning silently
- do not set success state
- do not mutate local pools
- do not mutate local bet history
- do not deduct local balances

The frontend should preserve the backend error message or code when feasible so users and developers can distinguish a validation rejection from a transport error.

## Side-Effect Ordering

The following side effects must happen only after `/api/bets` success:

- local match pool updates
- local bet list updates
- local balance or trial-balance deductions
- success-state transitions
- bonus bet recording calls such as `record_bonus_bet`
- referral or affiliate follow-up notifications tied to a confirmed saved bet

This keeps downstream events aligned with accepted bets only.

## File Scope

Implementation is expected to touch only:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/page.test.tsx`
- `src/app/[locale]/page.test.tsx`

If a tiny shared helper is needed for response validation, it should still remain tightly scoped to this submission flow and should not expand into unrelated refactoring.

## Test Strategy

Add or update focused page-level tests for both the default and localized page variants.

Required coverage:

1. `/api/bets` rejection does not produce success UI.
2. `/api/bets` rejection does not append a local bet record.
3. `/api/bets` rejection does not deduct local real-money balance.
4. `/api/bets` rejection does not deduct local trial balance.
5. `/api/bets` success still updates the UI as expected.

Tests should prefer behavior assertions over implementation details. The goal is to prove that rejected bets are not shown as accepted.

## Risks And Mitigations

### Risk: slower perceived success

Because success waits for backend confirmation, the user may see success slightly later.

Mitigation:

- keep existing pending/loading states during submission
- keep the change limited to success timing rather than removing all progress feedback

### Risk: duplicated logic across page variants

The project has both default and localized page flows.

Mitigation:

- apply the same behavioral contract to both files
- add tests for both files so future divergence is easier to catch

## Acceptance Criteria

- A backend-rejected bet is never shown as a successful bet in the UI.
- A backend-rejected bet does not alter local pool totals.
- A backend-rejected bet does not alter local balances.
- A backend-rejected bet does not appear in local bet history.
- A backend-accepted bet still updates the UI correctly.
- The fix applies consistently to both `src/app/page.tsx` and `src/app/[locale]/page.tsx`.

## Out Of Scope Follow-Ups

These are intentionally not part of this change:

- converting the entire bet flow into a shared submission abstraction
- broader cleanup of page-level state management
- frontend copywriting improvements for each backend risk code
