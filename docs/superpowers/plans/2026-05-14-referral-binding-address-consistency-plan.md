# Referral Binding Address Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make referral binding and betting-time referral lookup use the same wallet address resolution rule so `storedReferrer` is reliably found.

**Architecture:** Reuse the existing preferred wallet address rule in `src/lib/wallets.ts`, centralize referral localStorage key generation behind a shared helper, and update `ReferralHandler` to write the same key that the betting page already reads. Add focused tests around helper behavior and the component binding path.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, Testing Library, Solana wallet adapter helpers

---

## File Map

- Modify: `src/lib/wallets.ts`
  - Add a tiny shared helper for generating the referral localStorage key from an already-resolved address.
- Modify: `src/lib/wallets.test.ts`
  - Add helper-level tests for the referral binding storage key.
- Modify: `src/components/ReferralHandler.tsx`
  - Replace direct `publicKey.toBase58()` storage-key writes and checks with preferred-address resolution plus shared key generation.
- Create: `src/components/ReferralHandler.test.tsx`
  - Add a focused component test that reproduces the old mismatch scenario and verifies the new consistent write behavior.
- Modify: `src/app/[locale]/page.tsx`
  - Replace inline ``bound_referrer_${currentAddressForReferral}`` generation with the shared helper so both flows stay aligned.

### Task 1: Add Shared Referral Storage Key Helper

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\wallets.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\wallets.test.ts`

- [ ] **Step 1: Write the failing helper test**

Add this test block to `src/lib/wallets.test.ts`:

```ts
import {
  formatMissingAtaInitializationMessage,
  getDestinationAtaTargets,
  getBoundReferrerStorageKey,
  resolvePreferredWalletAddress,
} from './wallets';

it('builds the localStorage key for a resolved referral address', () => {
  expect(getBoundReferrerStorageKey('wallet-address')).toBe(
    'bound_referrer_wallet-address'
  );
});

it('trims surrounding whitespace from the referral storage key address', () => {
  expect(getBoundReferrerStorageKey('  wallet-address  ')).toBe(
    'bound_referrer_wallet-address'
  );
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npx jest --runInBand src/lib/wallets.test.ts
```

Expected:

```text
FAIL src/lib/wallets.test.ts
  ● getBoundReferrerStorageKey is not a function
```

- [ ] **Step 3: Implement the minimal helper**

Add this function to `src/lib/wallets.ts` below `resolvePreferredWalletAddress()`:

```ts
export function getBoundReferrerStorageKey(address: string): string {
  return `bound_referrer_${address.trim()}`;
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npx jest --runInBand src/lib/wallets.test.ts
```

Expected:

```text
PASS src/lib/wallets.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallets.ts src/lib/wallets.test.ts
git commit -m "test: add referral storage key helper"
```

### Task 2: Align ReferralHandler With Preferred Address Resolution

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\ReferralHandler.tsx`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\ReferralHandler.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `src/components/ReferralHandler.test.tsx` with this focused test:

```tsx
import { render, waitFor } from '@testing-library/react';
import { ReferralHandler } from './ReferralHandler';

const mockUseWallet = jest.fn();
const mockUseSearchParams = jest.fn();
const mockUseLanguage = jest.fn(() => ({ t: (key: string) => key }));

jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockUseWallet(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock('./LanguageProvider', () => ({
  useLanguage: () => mockUseLanguage(),
}));

describe('ReferralHandler', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('pendingReferrer', 'referrer-address');
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    });
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => 'wallet-adapter-address',
      },
      wallet: {
        adapter: {
          name: 'Phantom',
        },
      },
    });
    Object.defineProperty(window, 'phantom', {
      configurable: true,
      value: {
        solana: {
          publicKey: {
            toBase58: () => 'phantom-provider-address',
          },
        },
      },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as jest.Mock;
  });

  it('stores the bound referrer under the preferred wallet address key', async () => {
    render(<ReferralHandler />);

    await waitFor(() => {
      expect(localStorage.getItem('bound_referrer_phantom-provider-address')).toBe(
        'referrer-address'
      );
    });

    expect(localStorage.getItem('bound_referrer_wallet-adapter-address')).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/referral',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          address: 'referrer-address',
          newRefereeAddress: 'phantom-provider-address',
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run:

```bash
npx jest --runInBand src/components/ReferralHandler.test.tsx
```

Expected:

```text
FAIL src/components/ReferralHandler.test.tsx
Expected localStorage key bound_referrer_phantom-provider-address to exist, received null
```

- [ ] **Step 3: Implement the minimal component change**

Update `src/components/ReferralHandler.tsx` imports and address handling to this shape:

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useLanguage } from "./LanguageProvider";
import { ShieldCheck } from "lucide-react";
import {
    getBoundReferrerStorageKey,
    resolvePreferredWalletAddress,
} from "@/lib/wallets";

function getPreferredReferralAddress(walletAdapterAddress?: string | null): string | null {
    const phantomProviderAddress =
        typeof window !== "undefined"
            ? window.phantom?.solana?.publicKey?.toBase58?.() ?? null
            : null;

    return resolvePreferredWalletAddress(walletAdapterAddress, phantomProviderAddress);
}
```

Then update the binding effect and `autoBindReferral()` calls to this shape:

```tsx
    useEffect(() => {
        const preferredAddress = getPreferredReferralAddress(publicKey?.toBase58() ?? null);

        if (connected && preferredAddress && pendingReferrer) {
            if (pendingReferrer === preferredAddress) return;

            const alreadyBound = localStorage.getItem(
                getBoundReferrerStorageKey(preferredAddress)
            );

            if (!alreadyBound) {
                autoBindReferral(pendingReferrer, preferredAddress);
            }
        }
    }, [connected, publicKey, pendingReferrer]);
```

And change the successful write to:

```tsx
            localStorage.setItem(getBoundReferrerStorageKey(referee), referrer);
```

- [ ] **Step 4: Run the component test to verify it passes**

Run:

```bash
npx jest --runInBand src/components/ReferralHandler.test.tsx
```

Expected:

```text
PASS src/components/ReferralHandler.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ReferralHandler.tsx src/components/ReferralHandler.test.tsx
git commit -m "fix: align referral binding with preferred wallet address"
```

### Task 3: Make Betting Lookup Use the Shared Storage Key Helper

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\ReferralHandler.test.tsx`

- [ ] **Step 1: Add a regression assertion that mirrors the betting lookup contract**

Extend `src/components/ReferralHandler.test.tsx` with this assertion inside the existing test:

```tsx
    expect(localStorage.getItem('bound_referrer_phantom-provider-address')).toBe(
      'referrer-address'
    );
```

Then add this import in the test file:

```tsx
import { getBoundReferrerStorageKey } from '@/lib/wallets';
```

And replace the assertion with:

```tsx
    expect(
      localStorage.getItem(getBoundReferrerStorageKey('phantom-provider-address'))
    ).toBe('referrer-address');
```

This should still pass only after the page uses the same helper contract.

- [ ] **Step 2: Run the existing focused tests as a pre-check**

Run:

```bash
npx jest --runInBand src/lib/wallets.test.ts src/components/ReferralHandler.test.tsx
```

Expected:

```text
PASS src/lib/wallets.test.ts
PASS src/components/ReferralHandler.test.tsx
```

- [ ] **Step 3: Replace the inline betting lookup key with the shared helper**

Update the import list in `src/app/[locale]/page.tsx` to include:

```tsx
import {
  COMMISSION_WALLET,
  DEFAULT_COMMISSION_RATE,
  HOUSE_WALLET,
  PLATFORM_FEE_RATE,
  POOL_ADDRESS,
  USDT_DECIMALS,
  USDT_MINT,
  findAtaClient,
  formatMissingAtaInitializationMessage,
  getBoundReferrerStorageKey,
  getDestinationAtaTargets,
  splitBetAmount,
} from "@/lib/wallets";
```

Then replace this lookup:

```tsx
const storedReferrer = localStorage.getItem(`bound_referrer_${currentAddressForReferral}`);
```

with:

```tsx
const storedReferrer = localStorage.getItem(
  getBoundReferrerStorageKey(currentAddressForReferral)
);
```

- [ ] **Step 4: Run the focused tests and diagnostics**

Run:

```bash
npx jest --runInBand src/lib/wallets.test.ts src/components/ReferralHandler.test.tsx
```

Expected:

```text
PASS src/lib/wallets.test.ts
PASS src/components/ReferralHandler.test.tsx
```

Then run diagnostics for:

```text
src/lib/wallets.ts
src/lib/wallets.test.ts
src/components/ReferralHandler.tsx
src/components/ReferralHandler.test.tsx
src/app/[locale]/page.tsx
```

Expected:

```text
No new diagnostics errors
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallets.ts src/lib/wallets.test.ts src/components/ReferralHandler.tsx src/components/ReferralHandler.test.tsx src/app/[locale]/page.tsx
git commit -m "fix: unify referral binding and bet lookup keys"
```

## Self-Review

- Spec coverage check:
  - Single address rule: covered in Task 2 via preferred-address resolution reuse.
  - Keep betting path as source of truth: covered in Task 3 by aligning storage key generation without changing lookup behavior semantics.
  - Preserve storage format: covered in Task 1 helper implementation.
  - Focused testing: covered in Tasks 1 and 2, then re-run in Task 3.
- Placeholder scan:
  - No `TODO`, `TBD`, or vague testing steps remain.
- Type consistency:
  - Shared helper name is consistently `getBoundReferrerStorageKey`.
  - Address resolution remains `resolvePreferredWalletAddress`.
