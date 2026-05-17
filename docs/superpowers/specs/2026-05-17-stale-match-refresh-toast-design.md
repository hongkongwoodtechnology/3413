# Stale Match Refresh Toast Design

Date: 2026-05-17

## Context

The backend now rejects bets for clearly closed matches with a stable error:

- `賽事已結束，無法投注。`

This fixes correctness, but the frontend currently still handles submission failures with a generic `alert(...)` flow in:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`

That behavior is functional but weak from a product perspective. When the user is looking at a stale match card, a generic blocking alert does not visually fit the rest of the interface and does not provide an immediate recovery action.

The user request is to add a proper in-page toast-style notice that matches the existing GambleFi UI and gives the user a direct way to reload the match list.

## Problem Statement

Current behavior:

- a stale page can still show a match that has already ended
- the backend rejects the bet correctly
- the frontend catches the error and falls back to a generic alert
- the user must manually dismiss the alert and then decide how to recover

Result:

- the error experience feels inconsistent with the rest of the polished betting UI
- the user is told something failed, but is not given an obvious next action
- the stale-data scenario is handled as a generic error rather than a contextual product flow

## Goals

- Show a styled in-page toast when `/api/bets` rejects because the match is already closed.
- Make the toast visually consistent with the current homepage card system and dark-glass UI language.
- Provide a clear `立即刷新` action that reloads the latest match list.
- Apply the same behavior to both:
  - `src/app/page.tsx`
  - `src/app/[locale]/page.tsx`

## Non-Goals

- No full site-wide notification system.
- No migration of all existing `alert(...)` calls to toast.
- No redesign of the full betting modal or transaction status system.
- No automatic polling or background refresh changes.

## Approaches Considered

### Approach 1: targeted stale-match toast component

Add a focused toast/banner component that appears only for the specific backend error `賽事已結束，無法投注。`

Pros:

- smallest scoped change that still feels product-grade
- avoids rewriting all existing error handling
- directly solves the stale-match recovery path

Cons:

- introduces a dedicated UI path for one error class only

### Approach 2: generic page-level error banner for all bet failures

Replace the alert path with a reusable inline banner for every error.

Pros:

- more unified long-term direction

Cons:

- larger scope
- more copy and state design needed for unrelated failure cases
- higher regression risk for this task

### Approach 3: full global toast system

Add a generic notification store/provider and migrate current failures onto it.

Pros:

- strongest long-term architecture

Cons:

- clearly beyond the requested scope
- high implementation and testing cost for a small targeted UX change

### Recommended Approach

Use Approach 1.

This keeps the work tightly focused on the stale-match scenario while still producing a polished UI component that can later be generalized if needed.

## UX Design

### Placement

Use a floating toast anchored to the page edge rather than an in-modal warning.

Recommended placement:

- bottom-right on desktop
- centered near the bottom with safe margins on small screens

This keeps the notice visible without covering the main match cards or modal controls more than necessary.

### Visual style

The component should follow the existing homepage visual language:

- dark translucent surface
- subtle border
- rounded corners consistent with card radius
- soft shadow
- clear contrast for title and action

The toast should feel like part of the current GambleFi interface, not like a browser-native alert or a default utility-library notification.

### Content

Primary content:

- Title: `賽事已結束`
- Description: `請刷新頁面後再試`

Actions:

- Primary button: `立即刷新`
- Secondary affordance: close icon/button

### Behavior

The toast appears only when the bet flow receives the backend closed-match error:

- `賽事已結束，無法投注。`

When shown:

- it should replace the generic alert for this specific case
- it should not block the whole page
- it should remain visible until the user closes it or the refresh action succeeds

When `立即刷新` is clicked:

1. trigger the existing match reload path already used by the homepage
2. optionally show a lightweight loading state on the button
3. close the toast after the refresh succeeds

If refresh fails:

- keep the toast visible
- preserve the ability to retry

## Interaction Contract

### Error routing

The catch block in the bet flow should branch on the backend closed-match message.

For this specific case:

- show the toast state
- do not call `alert(...)`

For all other current errors:

- keep the existing error path unchanged

This limits behavioral change to the stale-match case only.

### Refresh integration

The `立即刷新` action should reuse the existing homepage data-fetch mechanism instead of introducing a second refresh implementation.

That means the action should call the same fetch/reload logic already responsible for getting the latest match list and updating page state.

## Component Scope

Expected file scope:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`

Optional extraction if needed:

- `src/components/ui/stale-match-toast.tsx`

If a shared component is extracted, it should remain small and presentation-focused:

- visible state
- close callback
- refresh callback
- loading state for refresh action

No global provider or notification bus should be introduced in this change.

## Test Strategy

Add or update focused page tests covering:

1. the stale-match backend error shows the toast instead of only alerting
2. the toast renders the refresh copy
3. clicking `立即刷新` triggers the existing match reload logic
4. successful refresh closes the toast
5. both default and localized homepage variants behave the same way

Tests should prefer user-visible behavior assertions:

- toast title text
- button visibility
- refresh action invocation
- close behavior

## Risks And Mitigations

### Risk: duplicated logic between default and localized homepage files

The project maintains two homepage variants with very similar bet flow logic.

Mitigation:

- keep the toast behavior contract identical in both files
- extract a tiny shared component if presentation duplication becomes noisy
- add tests for both page variants

### Risk: refresh action uses a different code path than initial page loading

If the toast creates a second refresh implementation, state divergence may appear later.

Mitigation:

- reuse the existing match-fetching path already present in each page
- avoid special-case reload code beyond wiring the action

### Risk: toast visually clashes with existing cards or modal layers

Mitigation:

- match current radius, spacing, background opacity, and border intensity
- keep the component small and avoid bright, generic system colors

## Acceptance Criteria

- When `/api/bets` returns `賽事已結束，無法投注。`, the page shows a styled in-page toast.
- The toast displays:
  - `賽事已結束`
  - `請刷新頁面後再試`
  - `立即刷新`
- Clicking `立即刷新` reloads the latest match list.
- After a successful refresh, the toast closes automatically.
- Other existing bet errors continue using the current handling path unless explicitly changed.
- The same UX is available in both `src/app/page.tsx` and `src/app/[locale]/page.tsx`.
