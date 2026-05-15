# Admin Users Real Referral Data Design

## Summary

This spec removes the fake admin user dataset based on `data/users_db.json` and replaces it with a real aggregated view built from `data/referral_db.json`.

The admin users page currently shows seeded example rows such as `SOL_U1`, `REF_ALPHA`, and hard-coded joined dates. Those values are not real platform data and must not appear in the admin interface.

The chosen approach is:

- stop reading and auto-creating `data/users_db.json` in `/api/admin/users`
- aggregate admin user rows directly from `data/referral_db.json`
- only display values that can be derived from actual platform records
- keep wallet masking in the admin response
- return an empty result when no real platform records exist

This is a focused data-source correction for the admin users screen, not a broader referral data model redesign.

## Problem

The admin users page currently relies on a fake dataset created in `src/app/api/admin/users/route.ts`.

Current behavior:

1. `/api/admin/users` checks whether `data/users_db.json` exists
2. when the file is missing, it writes seeded rows such as `SOL_U1`, `REF_ALPHA`, and fixed wallet addresses
3. the page fetches those rows and renders them as if they were real admin query results
4. the admin UI therefore displays non-real platform data

This creates two problems:

- operations staff cannot trust the admin user list because it mixes or fabricates records
- the interface implies that fields such as referral code and join time are real even when no real source exists

## Confirmed Product Decision

- the admin users page must not show seeded example records
- `data/users_db.json` is no longer a valid source for this screen
- the admin users page should use `data/referral_db.json` as its real source of platform referral data
- the UI must only display fields that can be derived from actual stored records
- if a real field is not available in `referral_db.json`, the page should show `-` instead of fabricated content
- if no real records exist, the page should show an empty state instead of generated sample data

## Approaches Considered

### Recommended: aggregate admin rows from `referral_db.json`

Read `data/referral_db.json`, treat each top-level wallet address as one real platform row, and compute display fields from the stored referral data.

Why this is recommended:

- it removes the fake seeded dataset entirely
- it uses the project's existing referral data source
- it keeps the current page structure while correcting the underlying data truthfulness
- it avoids inventing referral codes, user IDs, and join times that do not exist
- it allows the admin screen to reflect actual platform activity immediately

### Alternative: keep the current API shape but return an empty list only

Rejected because:

- it would hide the fake rows but leave the incorrect data source in place
- future changes could accidentally re-enable the seeded dataset
- it does not solve the root cause that `/api/admin/users` is modeled around fabricated records

### Alternative: query only chain data live for every field

Rejected for this patch because:

- it is a larger architectural change
- the project already stores referral activity in `referral_db.json`
- some fields displayed in the admin page are derived from internal referral records, not pure chain state

## Affected Area

Primary backend area:

- `src/app/api/admin/users/route.ts`

Primary frontend area:

- `src/app/[locale]/admin/users/page.tsx`
- `src/app/admin/users/page.tsx`

Potentially removed legacy data source:

- `data/users_db.json`

Focused test area:

- a new or updated test for `src/app/api/admin/users/route.ts`
- optional page-level test coverage for the empty state and real-row rendering

## Design

### 1. Source of truth

`/api/admin/users` should read from `data/referral_db.json` only.

New rules:

- do not auto-create `data/users_db.json`
- do not return any seeded records such as `SOL_U1`
- if `data/referral_db.json` does not exist, return an empty successful response
- if `data/referral_db.json` exists, parse its contents and aggregate rows from the real wallet entries it contains

Each top-level key in `referral_db.json` represents a real wallet address known to the referral system and becomes one admin row candidate.

### 2. Row construction

Each admin row is derived from one wallet address and its `UserData`.

The row fields should be built as follows:

- `id`: a short identifier derived from the real wallet address, not a fabricated sequential label
- `address`: the masked wallet address produced by `maskWalletAddress()`
- `type`: `Referrer` when `stats.friends > 0` or `referees.length > 0`; otherwise `User`
- `refCode`: always `-` for now because there is no reliable real referral-code field in `referral_db.json`
- `totalAmount`: sum of `referees[].totalVolumeValue`, treating invalid or missing values as `0`
- `commission`: total settled commission derived from the address's commission records, excluding withdrawal reversal rows
- `downlines`: `stats.friends` when valid, otherwise fallback to `referees.length`
- `joinedAt`: `-` because there is no trustworthy account creation timestamp in the current stored data

This preserves the table shape while ensuring every visible value is either real or explicitly unavailable.

### 3. Identifier display

The current fake labels such as `SOL_U1` must disappear.

The replacement identifier should be deterministic and derived from the actual address so that:

- the first line in the `用戶 / 錢包` column is still easy to scan
- the identifier does not imply a synthetic user inventory
- the value remains stable across refreshes

A simple address-derived short label is sufficient for this patch, such as reusing the masked address or a compact prefix form based on the real wallet.

### 4. Search behavior

Search should operate only on real values:

- full wallet address
- masked wallet address representation when practical
- address-derived short identifier

Search should no longer depend on fake IDs or fake referral codes.

Because `refCode` is not real in this design, it should not be part of search matching.

### 5. Type filtering

The existing `type` query parameter remains supported:

- `all`: all aggregated rows
- `user`: rows classified as `User`
- `referrer`: rows classified as `Referrer`

Classification should be based on real referral state, not on a stored string copied from fake seed data.

### 6. Frontend rendering

The admin page layout remains unchanged, but the explanatory copy and fallback rendering should be updated.

Required changes:

- update the query result helper text to say the table shows real platform data only
- keep wallet masking language in the helper text
- keep the empty result row, but change the message to reflect the absence of real platform data rather than a generic no-match state only
- render `-` for fields whose real source is unavailable, including `推薦碼` and `加入時間`

The table should no longer visually suggest that unavailable fields are populated from operational systems when they are not.

## Data Flow

### Before

1. Admin page requests `/api/admin/users`.
2. The route reads or creates `users_db.json`.
3. Fake rows such as `SOL_U1` and `REF_ALPHA` are returned.
4. The admin table displays fabricated records.

### After

1. Admin page requests `/api/admin/users`.
2. The route reads `referral_db.json`.
3. The route aggregates one row per real wallet entry.
4. The route masks wallet addresses before returning data.
5. The admin table displays only real platform-derived records, or an empty state when none exist.

## Error Handling

- if `referral_db.json` is missing, return `success: true` with `data: []`
- if `referral_db.json` exists but is empty, return `success: true` with `data: []`
- if `referral_db.json` cannot be parsed, return a server error instead of silently falling back to fake data
- if numeric values such as `totalVolumeValue` or commission amounts are missing or invalid, treat them as `0`
- if `stats.friends` is missing or invalid, fallback to `referees.length`
- never create a replacement fake dataset during any failure path

## Testing

Focused automated coverage should verify:

- `/api/admin/users` no longer creates or depends on `users_db.json`
- the route aggregates rows from `referral_db.json`
- `type=all` returns both user and referrer rows when present
- `type=user` returns only rows without real downlines
- `type=referrer` returns only rows with real downlines
- search matches real wallet-derived values
- unavailable fields such as `refCode` and `joinedAt` return `-`
- missing referral database returns an empty successful response
- fake labels such as `SOL_U1` and fake codes such as `REF_ALPHA` no longer appear in API output

Useful page-level coverage:

- the admin page renders the updated helper text
- the admin page renders the empty-state message when the API returns no rows

## Scope

In scope:

- replace the admin users fake dataset source
- aggregate rows from `referral_db.json`
- keep the current table shape while replacing fabricated values with real or unavailable values
- update helper copy and empty-state wording
- add focused tests for the new API behavior

Out of scope:

- redesigning the referral database schema
- introducing a real referral-code field
- backfilling historical join timestamps
- migrating all referral data to a different persistence layer
- redesigning the admin users page layout
