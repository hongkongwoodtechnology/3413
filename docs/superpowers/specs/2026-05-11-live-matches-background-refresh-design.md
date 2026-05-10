# Live Matches Background Refresh Design

## Summary

This spec changes the live matches loading behavior so that the full-screen loading state is shown only when the page has no match data yet.

Once live matches have already been rendered, all later refreshes must stay in the background and must not replace the visible match list with:

- `Loading live matches from ESPN...`

This behavior applies to all language versions, not only Traditional Chinese.

## Problem

The current homepage live matches flow uses a single `isLoading` state for rendering the match-area loading screen.

That is acceptable for the very first fetch when the page is empty, but it becomes a UX problem if later refreshes also drive the same loading state:

- the user already has visible matches on screen
- the page fetches again because of polling, visibility recovery, or language-driven reload
- the UI can return to the loading screen and hide already-usable content

The requested product behavior is simpler:

- if no matches are loaded yet, show the loading state
- if matches are already visible, keep them on screen and refresh in place

## Confirmed Product Decision

- The change applies to every language version.
- The `status.loading` translation key remains valid and unchanged.
- The loading screen must appear only during the first empty-state fetch.
- Background refreshes must never replace already-rendered matches with the loading screen.
- Empty results and loading are separate states and must not be conflated.

## Approaches Considered

### Recommended: make loading mean initial empty-state loading only

Keep the existing loading UI, but tighten its meaning:

- `isLoading === true` only while the page is fetching its first usable match payload and the current list is empty
- all later refreshes fetch without toggling the full-screen loading UI

Why this is recommended:

- smallest code change
- matches the requested UX directly
- keeps all translations and existing markup intact
- minimizes regression risk in a large homepage component

### Alternative: split into `isInitialLoading` and `isRefreshing`

This is a valid longer-term structure if the product later wants a subtle spinner or refresh badge.

It is not recommended for this request because:

- the current requirement does not ask for new refresh UI
- it increases scope for little immediate benefit

### Alternative: special-case only Traditional Chinese

Rejected because the issue is caused by shared frontend loading logic, not by language content. Limiting the fix to one language would create inconsistent behavior across locales.

## Affected Area

Primary file:

- `src/app/page.tsx`

Primary responsibilities involved:

- initial live matches fetch
- language-triggered reload
- background polling
- visibility-triggered refresh
- conditional rendering for the match list loading state

## Design

### 1. Loading state semantics

The homepage loading state should represent only this condition:

- the current page has no rendered matches yet
- a live matches fetch is in progress

It should no longer represent background refresh activity once match data already exists.

### 2. Initial load behavior

During the first page load:

- if `matches.length === 0`, the page may show the loading screen
- once the first fetch completes, the page exits loading state

If the fetch returns data, the match list is rendered normally.

If the fetch returns no data, the loading state ends and the existing no-matches state is shown.

### 3. Subsequent refresh behavior

After at least one match list render has occurred, later fetches must not re-enter the full loading screen.

This includes refreshes triggered by:

- polling
- tab or window visibility returning to visible
- language changes

The visible matches remain on screen while the new payload is fetched and merged in the background.

### 4. Language behavior

The fix is global across languages.

Changing language may still:

- translate the existing visible matches optimistically
- request fresh localized data from the server

But it must not blank the match list and replace it with the loading screen if matches are already present.

### 5. Empty-state behavior

Loading and empty data are different states:

- `loading`: the page is waiting for the first empty-screen fetch to finish
- `empty`: the request finished, but no matches are available

This separation prevents the interface from looking stuck when the API returns no items.

## Data Flow

### First page entry

1. Homepage mounts.
2. If the current match list is empty, the fetch may enable the loading state.
3. The page requests `/api/matches`.
4. When the request resolves, loading ends.
5. The page shows either rendered matches or the no-matches state.

### Later refreshes

1. A poll, visibility event, or language change triggers another fetch.
2. The request runs without enabling the full loading screen if matches already exist.
3. The page merges updated match data into the current list.
4. The rendered content stays visible throughout the refresh.

## Error Handling

Existing fetch error handling remains in place.

Behavioral expectations:

- background fetch failures must not clear already-visible matches
- initial fetch failures must exit loading state so the page does not remain permanently blocked
- aborted requests must continue to be ignored without noisy UI regressions

## Testing

Recommended verification:

- confirm the first empty-page load still shows `status.loading`
- confirm the loading screen disappears after the first request completes
- confirm polling does not replace visible matches with the loading screen
- confirm switching language with visible matches keeps the match list on screen
- confirm an empty API result shows the no-matches state rather than an endless loading state

Low-cost regression coverage:

- add a focused component-level or helper-level test only if the surrounding homepage patterns make it practical
- otherwise use a minimal logic change plus targeted manual verification

## Scope

In scope:

- refine homepage live matches loading behavior
- apply the behavior consistently across all locales

Out of scope:

- changing translations
- adding a new background refresh spinner
- changing the `/api/matches` payload
- refactoring unrelated homepage betting logic
