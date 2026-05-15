# Referral Binding Address Consistency Design

## Summary

This spec fixes a referral binding mismatch where the app stores the bound referrer under one wallet-derived address but later reads it back during betting with a different wallet-derived address.

The chosen approach is:

- keep referral storage in `localStorage`
- keep the existing key format `bound_referrer_<address>`
- unify both referral binding and betting-time lookup onto the same address resolution rule
- use the same preferred-address logic already used by the betting page

This is a consistency fix for referral lookup, not a redesign of the referral system.

## Problem

The referral flow currently writes and reads the bound-referrer key using different address sources.

Current behavior:

- `ReferralHandler` writes the key using `publicKey.toBase58()`
- the betting page reads the key using `getActualAddress()`
- `getActualAddress()` prefers the Phantom provider address when it differs from the wallet-adapter address

Because those two address values can differ in Phantom multi-account or wallet-adapter edge cases, the app can produce this failure mode:

1. referral binding succeeds
2. `localStorage` saves `bound_referrer_<walletAdapterAddress>`
3. betting later looks up `bound_referrer_<phantomProviderAddress>`
4. lookup returns `null`
5. `storedReferrer` is missing
6. the bet split runs as if no referrer exists

This explains why some bets were sent fully to the pool without a commission transfer even though referral data later showed the user as referred.

## Confirmed Product Decision

- Keep the referral storage mechanism in `localStorage`.
- Keep the same key naming scheme.
- Fix the inconsistency by making referral binding use the same address resolution logic as betting.
- Do not change referral backend data shape.
- Do not add new wallet identity abstractions in the first version.

## Approaches Considered

### Recommended: unify both paths on the preferred actual address

Use the same address resolution strategy for both:

- saving `bound_referrer_<address>`
- reading `bound_referrer_<address>`

Why this is recommended:

- smallest change with direct impact on the bug
- matches the existing betting logic
- avoids duplicated identity assumptions across components
- preserves current storage format

### Alternative: write two keys for both wallet-adapter and Phantom addresses

Rejected for now because:

- it increases storage ambiguity
- it masks the real consistency problem
- it complicates cleanup and future reasoning

### Alternative: move referral binding fully to backend wallet identity

Rejected for now because:

- it is much broader than the reported issue
- it would require redesigning how the client resolves the active wallet identity
- the bug can be fixed locally with a small consistent-address change

## Affected Area

Primary frontend areas:

- `src/components/ReferralHandler.tsx`
- `src/app/[locale]/page.tsx`

Supporting helper area:

- `src/lib/wallets.ts`

Potential focused tests:

- wallet address preference helper tests
- referral binding lookup consistency test

## Design

### 1. Single address rule

The app should treat the preferred active address as:

1. Phantom provider address, if available
2. wallet-adapter address otherwise

This is already encoded in `resolvePreferredWalletAddress()`.

The fix is to ensure `ReferralHandler` uses that same rule before writing the referral key.

### 2. Referral binding write path

Today, `ReferralHandler` writes:

- `bound_referrer_${publicKey.toBase58()}`

After the fix, it should resolve the preferred active address first and then write:

- `bound_referrer_${preferredAddress}`

This should use the same provider-aware resolution pattern already used on the betting page, so both write and read target the same key.

### 3. Betting read path

The current betting read path already uses `getActualAddress()`.

In the first version:

- keep the betting read path unchanged
- treat it as the source-of-truth behavior
- align referral binding to it

### 4. Scope boundary

This fix only guarantees consistency for future bindings and future bet lookups in the current browser state.

It does not automatically migrate all previously written mismatched localStorage keys unless we explicitly add migration logic later.

For the first version:

- do not add key migration
- do not add fallback reads
- keep the fix minimal and deterministic

If a compatibility pass is needed later, that should be a separate scoped change.

## Data Flow

### Before

1. Referral link is captured.
2. User connects wallet.
3. `ReferralHandler` binds using `publicKey.toBase58()`.
4. Betting later reads using `getActualAddress()`.
5. Keys may differ.

### After

1. Referral link is captured.
2. User connects wallet.
3. `ReferralHandler` resolves the preferred active address using the same rule as betting.
4. Referral binding writes `bound_referrer_<preferredAddress>`.
5. Betting reads the same `bound_referrer_<preferredAddress>`.
6. `storedReferrer` resolves correctly.

## Error Handling

- If no wallet address is available, do not write the binding key.
- If Phantom provider is unavailable, fall back to the wallet-adapter address.
- If referral binding API fails, preserve the current behavior and do not write a local binding key.

## Edge Cases

### Phantom provider differs from wallet-adapter address

This is the exact bug scenario.

Expected result after the fix:

- both binding and betting use the Phantom-preferred address
- lookup succeeds

### Phantom provider unavailable

Expected result:

- both flows fall back to the wallet-adapter address
- lookup still succeeds

### Existing stale localStorage key from old behavior

Out of scope for this change.

The first version intentionally fixes forward behavior rather than adding dual-read compatibility.

## Testing

Recommended focused coverage:

- verify the preferred-address helper returns the Phantom address when both exist
- verify referral binding writes the key using the same preferred-address logic
- verify a later lookup using the betting page address resolves the same localStorage key

Manual verification:

- open a referral link
- connect the wallet
- confirm localStorage stores `bound_referrer_<preferredAddress>`
- place a bet
- confirm the betting flow finds `storedReferrer`
- confirm the commission split no longer collapses into pool-only because of a missing referrer lookup

##

In scope:

- unify referral binding key address source
- preserve the existing storage key format
- add focused tests for address consistency

Out of scope:

- backend referral redesign
- old localStorage key migration
- commission reserve accounting changes
- historical on-chain compensation for already-missed commission transfers

<br />

## Scope
