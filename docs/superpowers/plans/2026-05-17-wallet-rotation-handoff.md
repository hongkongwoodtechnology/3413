# Wallet Rotation Deployment Handoff

## Deploy Sync

- Update `NEXT_PUBLIC_HOUSE_WALLET` in the deployment environment to the current rotated admin public key.
- Update `ADMIN_WALLET_ADDRESS` in the deployment environment to the same rotated admin public key.
- Update `NEXT_PUBLIC_COMMISSION_WALLET` in the deployment environment to the current rotated commission public key.
- Update `ADMIN_SECRET_KEY` in the deployment environment to the rotated admin secret key.
- Update `COMMISSION_SECRET_KEY` in the deployment environment to the rotated commission secret key.
- Redeploy only after local `npm run build` passes and `.next` scans show no `AQDd...` or retired admin wallet hits.

## Security Expectations

- `src/lib/security/auth.ts` must fail closed when admin env is missing.
- Runtime wallet config must not fall back to the retired `3ve...` admin wallet.
- Old private keys are treated as compromised and must never be reused.

## Treasury Transfer Checklist

1. Open the retired hot wallet in a trusted wallet client.
2. Top up only enough SOL for network fees if the wallet cannot complete outgoing transfers.
3. Transfer all remaining USDT and other custodial tokens to the newly approved treasury destination.
4. Verify each transfer on-chain before removing access to the retired wallet.
5. Remove the retired secret from every deployed environment and local machine that no longer needs it.

## Final Gate

- Do not update production until:
  - local build is green
  - `.next/server` and `.next/static` contain no `AQDd...`
  - `.next/server` and `.next/static` contain no retired `3ve...`
  - deployment env values are updated
  - treasury transfer ownership is explicitly assigned
