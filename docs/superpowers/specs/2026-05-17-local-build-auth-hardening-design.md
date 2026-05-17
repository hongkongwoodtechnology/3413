# Local Build And Admin Wallet Hardening Design

## Summary

This spec defines the lowest-risk local-first remediation plan for the current betting security investigation.

The confirmed goals are:

- restore a fully passing local `npm run build`
- verify the generated production output does not contain `AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq`
- remove legacy admin-wallet fallback logic so stale addresses cannot regain access
- normalize local wallet configuration after emergency key rotation
- prepare, but not directly execute, deployment-environment sync and old-wallet fund migration

This is intentionally a containment and verification patch, not a broader product refactor.

## Problem

The current repository is not in a trustworthy release state for security verification.

Three issues block confidence:

1. `npm run build` does not complete, so there is no verified production bundle to inspect
2. admin authorization still contains a legacy hard-coded fallback wallet in `src/lib/security/auth.ts`
3. `.env.local` has already been rotated locally, but the file still contains duplicated secret configuration and the deployment environment has not yet been synchronized

This creates a bad operational state:

- the team cannot prove whether the production build output still contains suspicious address references
- old admin address fallback may silently re-activate if environment variables are missing
- local emergency wallet rotation exists, but configuration hygiene is incomplete
- deployment and chain-fund migration cannot be executed safely without first stabilizing the local source of truth

## Confirmed Product Decision

- Use the local-first path before touching deployment.
- Fix only the code and configuration necessary to achieve a trustworthy local build and security verification baseline.
- Do not change betting amount calculation or on-chain transfer destinations as part of this patch.
- Do not directly perform deployment or on-chain fund transfers in this implementation step.
- Treat old admin wallet fallbacks as retired and invalid.
- Treat the newly rotated local admin and commission wallets as the only local source of truth going forward.

## Approaches Considered

### Recommended: local stabilization first, then deployment handoff

Sequence:

1. fix build-blocking type issues
2. remove retired admin fallback logic
3. clean local wallet env configuration
4. run `npm run build`
5. inspect `.next` production output for suspicious address remnants
6. hand off deployment sync and old-wallet treasury migration as an explicit checklist

Why this is recommended:

- produces the cleanest verification trail
- minimizes the chance of propagating unverified code into deployment
- separates code correctness from operational wallet movement
- gives a clear stop point if suspicious bundle output is still found

### Alternative: deploy the rotated config first

Rejected for now because:

- deployment would happen before the codebase is proven build-clean
- bundle-level verification would still be missing
- stale authorization or local config inconsistencies could be promoted upstream

### Alternative: immediately migrate old wallet funds first

Rejected for now because:

- it addresses treasury exposure but not source-code uncertainty
- if build output still contains legacy logic, new funds could be exposed again later
- operational urgency should not skip code verification

## Affected Areas

Primary source areas:

- `src/app/api/admin/payout/route.ts`
- `src/lib/security/auth.ts`
- `.env.local`

Known build-adjacent areas already touched during stabilization:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/components/ReferralLandingPage.tsx`
- `src/components/admin/overview/OverviewShortcuts.tsx`
- `src/app/[locale]/admin/finance/page.tsx`

Verification output:

- `.next`

Operational follow-up, out of implementation scope:

- deployment environment variables
- old hot-wallet balance transfer on Solana

## Design

### 1. Build restoration boundary

The build-restoration goal is narrowly scoped:

- fix type errors that block `npm run build`
- keep runtime behavior unchanged unless a build blocker is caused by stale typing or stale interface mismatch
- do not redesign payout logic, betting logic, or settlement policy in this patch

The first explicitly confirmed blocker is `BetRecord.archived` usage in `src/app/api/admin/payout/route.ts`.

Rule:

- extend the local `BetRecord` interface only with fields already used by the route logic, such as `archived` and any other existing persisted legacy flags that are read or written in that file
- prefer optional properties for legacy-state fields because historical JSON records may not contain them

This preserves compatibility with the existing data files while allowing TypeScript to describe the actual runtime shape already in use.

### 2. Admin authorization hardening

`src/lib/security/auth.ts` currently accepts admin addresses from environment, but still falls back to a retired hard-coded wallet when environment variables are missing.

New rule:

- `getAdminAddresses()` may read `ADMIN_WALLET_ADDRESS`
- it may also read `NEXT_PUBLIC_HOUSE_WALLET` for compatibility with current project structure
- if neither value is present, it must return an empty allowlist instead of restoring a retired wallet
- admin authorization must fail closed when no configured admin address exists

Expected effect:

- stale configuration no longer re-enables a historical wallet
- missing environment variables become a visible configuration error instead of a silent security downgrade

### 3. Local env normalization

Local emergency rotation has already produced new admin and commission wallets.

The local environment file must be normalized so it contains exactly one active value for each of these keys:

- `NEXT_PUBLIC_HOUSE_WALLET`
- `ADMIN_WALLET_ADDRESS`
- `NEXT_PUBLIC_COMMISSION_WALLET`
- `ADMIN_SECRET_KEY`
- `COMMISSION_SECRET_KEY`

Normalization rules:

- remove duplicated `ADMIN_SECRET_KEY` entries
- keep only the newest rotated key pair values
- preserve unrelated local configuration
- do not print private keys into logs or user-facing output

This step is local-only and does not imply deployment sync.

### 4. Production bundle verification

After local build succeeds, inspect the generated `.next` production output.

Verification targets:

- no `AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq` string remains in production chunks
- no unexpected direct betting transfer destination appears outside the configured pool and house wallet sources
- no stale hard-coded admin wallet remains in built client bundles

If suspicious strings remain:

- record the exact file paths
- classify whether the source is test data, embedded runtime code, serialized page props, or logs
- stop before any deployment handoff

### 5. Deployment and treasury handoff

This spec does not directly execute deployment sync or fund migration, but it defines the required handoff artifact after local verification passes.

The handoff must include:

- exact environment keys that changed locally
- the new public wallet addresses to deploy
- confirmation that old fallback authorization has been removed
- a checklist for moving funds out of the retired hot wallet
- a reminder that old private keys remain compromised and must not be reused

This keeps implementation and operations separated while ensuring the next step is unambiguous.

## Data Flow

### Before

1. local build fails on multiple type mismatches
2. production bundle cannot be trusted or inspected conclusively
3. admin auth can fall back to a retired wallet if env vars are absent
4. local wallet config contains duplicated secrets
5. deployment sync and fund migration have no clean verified source state

### After

1. local interfaces match the legacy data shape actually used by routes
2. `npm run build` completes successfully
3. `.next` production output is scanned for `AQDd...` and related wallet artifacts
4. admin auth fails closed when no active wallet is configured
5. local env contains exactly one active rotated wallet configuration
6. deployment sync and old-wallet fund transfer can proceed from a verified baseline

## Error Handling

- If legacy JSON records omit `archived` or other legacy flags, treat them as absent rather than invalid.
- If no admin wallet env is configured, admin authorization must fail with no fallback address.
- If local build reveals additional unrelated blockers, fix only those required to reach a verifiable production build.
- If bundle scanning still finds `AQDd...`, stop and report the exact source before any deployment step.
- If `.env.local` normalization detects duplicated sensitive keys, keep only the newest rotated values and avoid exposing secrets in output.

## Testing And Verification

Required verification sequence:

1. run `npm run build`
2. confirm it exits successfully
3. scan `.next` for `AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq`
4. scan `.next` for retired admin wallet remnants if any are known from source review
5. confirm `src/lib/security/auth.ts` no longer contains a hard-coded fallback address
6. confirm `.env.local` contains a single active value for each rotated wallet key

Focused code checks:

- `src/app/api/admin/payout/route.ts` type shape matches route behavior
- `src/lib/security/auth.ts` fails closed when env is missing
- no new diagnostics are introduced in files touched by the patch

Manual verification after implementation:

1. inspect built output for wallet strings
2. inspect local env keys without revealing full private-key values in chat
3. review the deployment handoff checklist before touching production

## Scope

In scope:

- fix `BetRecord` legacy field typing in payout route
- fix additional build blockers only as needed to complete local build
- remove retired admin fallback in shared auth helper
- normalize local rotated wallet config
- inspect production build output for `AQDd...`
- produce a deployment and treasury handoff checklist

Out of scope:

- changing betting business rules
- changing payout calculations
- changing transfer destinations for live betting flow
- direct deployment to production
- direct Solana on-chain treasury transfer execution
- full admin auth redesign beyond removing fallback behavior

## Open Questions Resolved

- Should deployment be changed before local verification? No.
- Should old fallback wallets remain available if env is missing? No.
- Should this patch include wallet-fund migration execution? No.
- Should build-fix scope include unrelated product behavior changes? No.
