# Locked Odds Cap Consistency Design

Date: 2026-05-17

## Context

The current betting UI shows inconsistent odds for the same action:

- the match card can display a computed odds value above `15`
- the confirmation button label clamps the preview to `15`
- the betting modal detail still shows the unclamped locked odds
- the backend currently accepts whatever locked odds the client submits

This creates a user-facing mismatch where the user may see one odds value before opening the bet flow and another value while confirming the same bet.

## Problem Statement

The product decision is to keep `15x` as a hard platform cap for locked betting odds.

Today, that rule exists only partially in the confirmation button label. As a result:

- some UI surfaces show uncapped odds
- other UI surfaces show capped odds
- the backend does not enforce the same cap as a source of truth
- a client could still submit locked odds above `15`

The system needs one consistent definition of the betting odds that the user sees and the odds that the backend stores.

## Goals

- Make `15.0000` the maximum locked odds for an actual bet.
- Ensure all pre-bet UI surfaces show the same capped locked odds.
- Ensure the odds sent to `/api/bets` never exceed `15`.
- Add backend protection so submitted locked odds above `15` cannot be accepted as-is.
- Preserve existing behavior for any odds at or below `15`.

## Non-Goals

- No redesign of the dynamic odds formulas themselves.
- No change to attraction-window pricing rules except their final displayed and locked result being capped.
- No change to settlement formulas beyond using the stored locked odds already recorded on the bet.
- No change to unrelated trial-funds, referral, liquidity, or position-limit rules.

## Recommended Approach

Treat `15` as the single source of truth cap for locked odds and apply it consistently at both frontend and backend boundaries.

### Why this approach

This keeps the UX and the persisted bet contract aligned:

- the same capped odds is shown everywhere before the user confirms
- the same capped odds is sent when placing the bet
- the backend cannot be bypassed by a crafted request
- existing odds generation logic can remain unchanged, with capping applied at the edges

## Detailed Behavior

### Rule 1: locked odds are hard-capped at `15`

Any odds value used to place a bet must satisfy:

- `lockedOdds <= 15`

If the computed quote is above `15`, the effective locked odds becomes:

- `15.0000`

This applies to:

- regular real-money bets
- trial-funds bets
- first-bet / single-sided initial odds flows
- attraction-window weighted quotes

### Rule 2: all pre-bet UI uses the capped value

Before the user confirms a bet, every visible odds reference in the active bet flow must use the same capped odds value:

- top match card odds for the currently focused prediction state
- confirmation button label
- betting modal "locked odds"
- potential return preview

This prevents showing `17.02` in one place and `15.00` in another for the same pending action.

### Rule 3: the client submits capped locked odds

When the client calls `/api/bets`, the submitted `odds` field must already be capped to `15`.

This keeps:

- the saved bet record
- later bet history display
- settlement based on stored locked odds

consistent with what the user saw before confirming.

### Rule 4: the backend enforces the same cap

The backend must not trust the client-submitted odds blindly.

If a request submits `odds > 15`, the backend must not accept that raw value as the bet's locked odds.

Recommended backend behavior for this change:

- clamp the incoming odds to `15` before using it for validation, persistence, and payout calculation

This preserves consistency with the UI and avoids a separate user-facing rejection path for a value the frontend should already normalize.

## Data Flow

### Frontend

1. The odds engine computes a quote as it does today.
2. The page layer derives an effective locked odds value by capping the computed quote at `15`.
3. All visible pre-bet displays use that capped value.
4. `executePrediction()` submits that capped value to `/api/bets`.

### Backend

1. `/api/bets` receives the submitted `odds`.
2. The route clamps the received value to `15` before continuing.
3. All downstream route logic uses the capped value:
   - validation
   - liability checks
   - saved bet record
   - net payout calculation

## File Scope

Implementation is expected to touch:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/api/bets/route.ts`
- corresponding page tests
- `src/app/api/bets/route.test.ts`

No odds-engine formula refactor is required for this change.

## Error Handling

This change does not require a new user-facing error contract.

Frontend behavior:

- normalize any pre-bet odds above `15` down to `15`

Backend behavior:

- normalize any submitted odds above `15` down to `15`

The intent is consistency, not introducing a new rejection state for the user.

## Test Strategy

Required coverage:

1. when a computed quote exceeds `15`, the confirmation button shows `15.0000`
2. when a computed quote exceeds `15`, the modal locked odds shows `15.0000`
3. when a computed quote exceeds `15`, the potential return preview uses `15`
4. when a computed quote exceeds `15`, the submitted `odds` sent by the page is `15`
5. when `/api/bets` receives `odds > 15`, the saved bet record stores `15`
6. when `/api/bets` receives `odds > 15`, payout calculation uses `15`
7. when quoted odds are already `<= 15`, behavior remains unchanged
8. locale and non-locale pages stay aligned

## Risks And Mitigations

### Risk: display cap and saved odds drift again

If one surface still reads raw `projectedOdds.odds` while another uses the capped value, the mismatch will persist.

Mitigation:

- derive one shared capped value in the page layer
- use that same value everywhere in the active bet flow

### Risk: backend and frontend cap logic diverge

If only the frontend caps odds, a crafted request could still create bets above `15`.

Mitigation:

- add the same cap enforcement in `/api/bets`
- test the saved bet payload and payout calculation path

### Risk: match cards show raw market odds when the user is not in an active focused bet flow

The inconsistency reported is specifically about the pending bet flow.

Mitigation:

- scope this change to the focused betting experience first
- keep the spec explicit that active pre-bet surfaces must agree on the same capped locked odds

## Acceptance Criteria

- A pending bet never shows conflicting odds values across pre-bet UI surfaces.
- A bet is never persisted with locked odds above `15`.
- Settlement continues to rely on stored locked odds, which now never exceed `15`.
- Quotes at or below `15` behave exactly as before.
- Locale and non-locale betting pages behave the same way.

## Out Of Scope Follow-Ups

- deciding whether passive, non-focused market cards should always show capped odds even when no bet is being prepared
- changing the core odds-engine API to emit already-capped values everywhere
- exposing a separate "raw quote" versus "effective locked odds" concept in the UI
