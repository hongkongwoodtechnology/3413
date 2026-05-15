# Referral Admin Address Design

## Summary

This spec fixes the admin authorization mismatch in the referral management API.

Current admin actions in `/api/referral` still authorize against a legacy hard-coded wallet:

- `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K`

The confirmed current admin wallet is:

- `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2`

The chosen approach is:

- remove legacy single-address authorization checks from `/api/referral`
- reuse the shared admin address source already defined in `src/lib/security/auth.ts`
- authorize referral admin actions only when `adminAddress` is included in `getAdminAddresses()` after explicitly filtering out the retired wallet
- treat `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K` as retired and no longer valid for these actions

This is a targeted authorization consistency fix, not a full auth redesign.

## Problem

The admin referral API currently rejects the real admin wallet because its authorization logic is still hard-coded to a retired address.

Current behavior:

1. the admin user connects wallet `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2`
2. the admin page sends `adminAddress: publicKey.toBase58()` to `/api/referral`
3. `/api/referral` compares that value against the retired address `2Ntk...`
4. the comparison fails
5. the API responds with `Unauthorized`
6. referral airdrop and commission-management actions cannot be used

This creates an operational outage for bonus distribution and referral administration even though the project already has a shared admin-address helper that resolves the correct current admin address.

## Confirmed Product Decision

- The only active admin wallet is `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2`.
- The legacy wallet `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K` will not be used anymore.
- `/api/referral` must stop hard-coding the retired admin wallet.
- Referral admin actions should use the shared admin-address source already present in the codebase.
- Even if old environment configuration still mentions `2Ntk...`, referral admin authorization must exclude it.
- This change should remain minimal and should not introduce challenge-signature auth in the same patch.

## Approaches Considered

### Recommended: reuse `getAdminAddresses()` in `/api/referral`

Import `getAdminAddresses()` from `src/lib/security/auth.ts`, then filter out the retired wallet before using the result for admin authorization in referral API actions.

Why this is recommended:

- smallest safe change that fixes the reported outage
- aligns `/api/referral` with the project's shared admin-address source
- immediately supports the confirmed current admin wallet
- prevents accidental reuse of the retired wallet through stale configuration
- avoids duplicating address logic in another route
- gives a clear path to environment-based admin rotation later

### Alternative: replace the hard-coded value with `3veQR...` directly

Rejected for now because:

- it would preserve the same duplication problem
- future admin rotation would break again in the same way
- the project already has a better shared source of truth

### Alternative: switch `/api/referral` to full challenge-signature auth

Rejected for this patch because:

- it is a broader auth-system upgrade
- it requires coordinated frontend and backend changes
- the reported issue is an authorization source mismatch, not a missing signature flow

## Affected Area

Primary backend area:

- `src/app/api/referral/route.ts`

Shared auth helper:

- `src/lib/security/auth.ts`

Focused test area:

- `src/app/api/referral/route.test.ts`

Potentially related but out of scope:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/components/admin/AdminDashboard.tsx`

## Design

### 1. Authorization source

`src/lib/security/auth.ts` already exposes `getAdminAddresses()`.

Current helper behavior:

- reads `ADMIN_WALLET_ADDRESS` from environment when present
- falls back to `NEXT_PUBLIC_HOUSE_WALLET` when present
- uses `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2` as final default
- returns a de-duplicated list

`/api/referral` should use this helper as its admin address source for admin-only actions, but must explicitly remove the retired wallet `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K` from the allowed list before authorization.

### 2. Admin-only actions to update

The following actions in `/api/referral` currently use the retired hard-coded address and must be updated:

- `airdrop_bonus`
- `update_commission_rate`
- `get_leaderboard`

New rule:

- read `adminAddress` from the request body
- call `getAdminAddresses()`
- build an allowed list that excludes `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K`
- authorize only when `adminAddress` is included in that filtered list
- otherwise return `Unauthorized`

### 3. Legacy address handling

The retired wallet `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K` should no longer be treated as valid for referral admin authorization.

This patch should not preserve compatibility for that address.

Expected result:

- current admin `3veQR...` succeeds
- retired admin `2Ntk...` fails even if stale environment configuration still references it

### 4. Scope boundary

This patch only fixes authorization for referral-management actions.

It does not:

- redesign admin login
- introduce signed admin requests
- rotate all other historical hard-coded admin constants in unrelated modules
- migrate every part of the project off old operational constants

Those can be handled in separate scoped changes.

## Data Flow

### Before

1. Admin page sends `adminAddress`.
2. `/api/referral` compares it against hard-coded `2Ntk...`.
3. Current admin wallet `3veQR...` is rejected.
4. API returns `Unauthorized`.

### After

1. Admin page sends `adminAddress`.
2. `/api/referral` loads allowed admin addresses via `getAdminAddresses()`.
3. The current admin wallet `3veQR...` is found in the allowlist.
4. Admin action proceeds.

## Error Handling

- If `adminAddress` is missing, keep the action unauthorized.
- If `adminAddress` is not in `getAdminAddresses()`, return `Unauthorized`.
- If `adminAddress` is the retired `2Ntk...` wallet, return `Unauthorized` even when it appears in stale configuration.
- If the shared helper returns only the default address, authorization still works for the current confirmed admin wallet.
- Do not silently allow the retired `2Ntk...` address through fallback logic in this route.

## Testing

Focused automated coverage should verify:

- `airdrop_bonus` succeeds for `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2`
- `airdrop_bonus` rejects a non-admin address
- `airdrop_bonus` rejects retired admin `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K` even when it appears in admin config
- `update_commission_rate` succeeds for an allowed admin address
- `get_leaderboard` succeeds for an allowed admin address

Manual verification:

1. connect wallet `3veQR...` in admin users page
2. submit `發送體驗金`
3. confirm the API no longer returns `Unauthorized`
4. confirm the target address balance in referral data increases

## Scope

In scope:

- replace retired referral admin hard-coding with shared admin-address lookup
- allow the current admin wallet `3veQR...`
- keep the legacy wallet `2Ntk...` retired in this flow
- add focused API tests for allow and deny paths

Out of scope:

- full challenge-signature admin auth
- admin session or JWT auth
- refactoring unrelated admin constants outside referral API
- changes to payout, settle, or betting authorization
