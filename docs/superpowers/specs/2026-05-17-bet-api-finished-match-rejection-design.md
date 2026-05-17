# Bet API Finished Match Rejection Design

Date: 2026-05-17

## Context

The current betting flow can accept a stale submission when a user leaves the page open and keeps seeing an outdated match card.

This is not primarily a frontend rendering bug. The core gap is that `POST /api/bets` does not perform a final authoritative check against the latest match state before saving the bet.

Today, the backend mainly blocks late live bets through:

- `liveMinute >= 80`

That rule is not enough when:

- the frontend still shows an old match entry
- the match has already ended
- the request still carries an older live minute or stale page data

As a result, a finished match can still be accepted if the request reaches the API before the frontend refreshes.

## Problem Statement

Current behavior:

- the backend trusts the request enough to proceed if required fields are present
- the backend rejects by late-minute rule, but not by finished-match rule
- the backend does not consistently use the latest authoritative match status when deciding whether a bet can still be placed

Result:

- users can submit bets against matches that are already over
- stale page state can become a correctness issue instead of only a UI issue
- accepted bets can later look obviously invalid because the match result is already known

## Goals

- Reject any new bet when the target match is already finished.
- Make the rejection happen in the backend even if the frontend page is stale.
- Reuse existing backend data sources and current route structure.
- Keep the fix narrowly scoped to bet acceptance validation and its tests.

## Non-Goals

- No automatic frontend refresh or polling change.
- No redesign of the match feed pipeline.
- No change to settlement logic beyond using existing settlement markers as rejection signals.
- No expansion into shared validation frameworks or broad route refactoring.

## Approaches Considered

### Approach 1: rely only on `market_db` settlement markers

Reject when the market record already has fields such as:

- `finalWinner`
- `settled`
- `refundProcessed`

Pros:

- minimal code change
- no dependency on match feed parsing

Cons:

- can miss the gap between a match finishing and settlement markers being written
- not sufficient when the match is over but settlement has not been finalized yet

### Approach 2: use latest match status plus settlement markers

At bet submission time, resolve the latest match state and reject if:

- the match status is finished
- or settlement markers already prove the market is closed

Pros:

- closes the stale-page hole directly
- does not depend on the frontend having refreshed
- still benefits from existing settlement information as a fallback

Cons:

- requires a small amount of extra server-side lookup logic

### Recommended Approach

Use Approach 2.

The backend should reject a bet if the latest authoritative match state says the match is over, and it should also reject when the market record already indicates closure through settlement fields.

## Detailed Design

### Validation contract

Before the route creates and stores a `BetRecord`, `POST /api/bets` should run a new finished-match validation step.

This validation should reject the request when any of the following is true:

1. The latest resolved match status is already finished.
2. The corresponding market record already has `finalWinner`.
3. The corresponding market record is already marked `settled`.
4. The corresponding market record is already in a refund-processed terminal state for that match.

The existing `liveMinute >= 80` rule remains in place as an additional safeguard, but it is no longer the only closure rule.

### Authoritative data sources

The validation should rely on backend-controlled data, not frontend-submitted display state.

Preferred signals:

- latest match object with terminal status such as `finished`
- existing `market_db` closure markers:
  - `finalWinner`
  - `settled`
  - `refundProcessed`

The match route already normalizes several terminal feed states into `status = 'finished'`, including cases like:

- `FT`
- `AET`
- `AP`
- `CANC`
- `POST`

The bet route should reuse the same backend understanding of terminal status rather than inventing a different meaning in the frontend.

### Rejection behavior

When the match is already closed, the API should return:

- HTTP `403`
- a stable, human-readable error such as `賽事已結束，無法投注。`

The rejection should happen before:

- pool mutation
- liability updates
- reserve changes
- bet persistence

### Scope of code changes

Expected implementation scope:

- `src/app/api/bets/route.ts`
- `src/app/api/bets/route.test.ts`

Optional helper extraction is acceptable only if it remains tightly scoped to this route and does not create unrelated abstractions.

## Error Handling

If the backend cannot confirm that the match is still open, it should prefer safety over acceptance when there is already a clear terminal market signal in `market_db`.

For this change, the primary target is deterministic rejection of clearly closed matches. It is not necessary to redesign all possible feed failure modes.

## Test Strategy

Add focused API tests covering:

1. Rejects a bet when the market record already contains `finalWinner`.
2. Rejects a bet when the market record is already marked `settled`.
3. Rejects a bet when the market record is already marked `refundProcessed` in a closed state.
4. Preserves current acceptance behavior for a normal open match.
5. Preserves the existing late-live rejection behavior for `liveMinute >= 80`.

Tests should validate:

- HTTP status code
- error payload
- no bet is persisted when rejected

## Risks And Mitigations

### Risk: false rejection from using refund markers too broadly

`refundProcessed` can indicate a special settlement outcome rather than a generic "finished" flag.

Mitigation:

- only treat it as a closure signal in combination with the route's existing market-close semantics
- avoid broadening its meaning beyond current backend behavior

### Risk: route divergence from match normalization logic

If the bet route defines terminal states differently from the match route, future inconsistencies can appear.

Mitigation:

- keep the bet route aligned with the existing normalized `finished` status and settlement markers
- avoid introducing a second incompatible terminal-state vocabulary

## Acceptance Criteria

- A stale frontend page cannot successfully place a new bet on a finished match.
- `POST /api/bets` returns `403` for a match that is already closed by authoritative backend state.
- No rejected finished-match bet is written into `bets_db`.
- Existing valid open-match bet behavior remains unchanged.
- Existing `liveMinute >= 80` rejection still works.
