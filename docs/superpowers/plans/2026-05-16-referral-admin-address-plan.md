# Referral Admin Address Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/referral` accept the current admin wallet `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2` for referral-management actions while permanently rejecting the retired wallet `2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K`.

**Architecture:** Keep the fix local to the referral API route. Reuse the shared admin address source from `src/lib/security/auth.ts`, then apply a route-local filter that excludes the retired wallet before authorizing `airdrop_bonus`, `update_commission_rate`, and `get_leaderboard`. Add focused API tests first so the behavior is locked in before implementation.

**Tech Stack:** Next.js App Router, TypeScript, Jest with `ts-jest`, file-backed JSON persistence

---

## File Map

- Modify: `src/app/api/referral/route.ts`
  - Import the shared admin-address helper, add a small route-local authorization helper, and replace the three retired hard-coded comparisons.
- Modify: `src/app/api/referral/route.test.ts`
  - Add focused POST action tests for the current admin allow path, non-admin deny path, retired admin deny path, and leaderboard allow path.

### Task 1: Lock The Authorization Behavior With Tests

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Write the failing admin authorization tests**

Add these cases near the end of `src/app/api/referral/route.test.ts`:

```ts
    it('allows the current admin wallet to airdrop bonus', async () => {
        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'airdrop_bonus',
                adminAddress: '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2',
                targetAddress: '0xBonusTarget',
                amount: 25
            })
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.newBalance).toBe(25);
    });

    it('rejects a non-admin wallet for bonus airdrop', async () => {
        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'airdrop_bonus',
                adminAddress: 'NotAdmin1111111111111111111111111111111111',
                targetAddress: '0xBonusTarget2',
                amount: 10
            })
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.error).toBe('Unauthorized');
    });

    it('rejects the retired admin wallet even when stale config references it', async () => {
        process.env.ADMIN_WALLET_ADDRESS = '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K';

        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'airdrop_bonus',
                adminAddress: '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K',
                targetAddress: '0xLegacyTarget',
                amount: 5
            })
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.error).toBe('Unauthorized');

        delete process.env.ADMIN_WALLET_ADDRESS;
    });

    it('allows the current admin wallet to fetch leaderboard', async () => {
        await POST(new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: '0xLeaderReferrer',
                newRefereeAddress: '0xLeaderUser'
            })
        }));

        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_leaderboard',
                adminAddress: '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2'
            })
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data)).toBe(true);
    });
```

- [ ] **Step 2: Run the referral API test file and verify the new cases fail**

Run:

```bash
npx jest src/app/api/referral/route.test.ts --runInBand
```

Expected:

```text
FAIL src/app/api/referral/route.test.ts
  Referral API
    ✕ allows the current admin wallet to airdrop bonus
    ✕ allows the current admin wallet to fetch leaderboard
```

The failure should show `Unauthorized` because the route still compares against the retired `2Ntk...` wallet.

- [ ] **Step 3: Commit the failing test state**

Run:

```bash
git add src/app/api/referral/route.test.ts
git commit -m "test: cover referral admin address authorization"
```

Expected:

```text
[branch-name abc1234] test: cover referral admin address authorization
 1 file changed, ...
```

### Task 2: Replace The Retired Hard-Coded Admin Check

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Add a route-local admin authorization helper**

Update the imports and constants at the top of `src/app/api/referral/route.ts`:

```ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { triggerAutoBackup } from '@/lib/gdriveBackup';
import { getAdminAddresses } from '@/lib/security/auth';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const RETIRED_REFERRAL_ADMIN = '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K';
```

Then add this helper near the other small helpers:

```ts
function isAuthorizedReferralAdmin(adminAddress: unknown): boolean {
    if (typeof adminAddress !== 'string' || !adminAddress.trim()) {
        return false;
    }

    const allowedAdmins = getAdminAddresses().filter(
        (address) => address !== RETIRED_REFERRAL_ADMIN
    );

    return allowedAdmins.includes(adminAddress);
}
```

- [ ] **Step 2: Replace all three retired comparisons with the helper**

Update the admin-only action guards in `src/app/api/referral/route.ts`:

```ts
        if (body.action === 'airdrop_bonus') {
            const { adminAddress, targetAddress, amount } = body;

            if (!isAuthorizedReferralAdmin(adminAddress)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
```

```ts
        if (body.action === 'update_commission_rate') {
            const { adminAddress, targetAddress, rate } = body;

            if (!isAuthorizedReferralAdmin(adminAddress)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
```

```ts
        if (body.action === 'get_leaderboard') {
            const { adminAddress } = body;

            if (!isAuthorizedReferralAdmin(adminAddress)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
```

Do not change request payload shape, success payload shape, or non-admin business logic.

- [ ] **Step 3: Add test cleanup for temporary admin env overrides**

At the top of `src/app/api/referral/route.test.ts`, add a constant so the current admin address is reused consistently:

```ts
const CURRENT_ADMIN_ADDRESS = '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2';
```

Then add environment cleanup inside the suite:

```ts
    afterEach(() => {
        delete process.env.ADMIN_WALLET_ADDRESS;
        delete process.env.NEXT_PUBLIC_HOUSE_WALLET;
    });
```

Finally replace repeated string literals in the new admin tests with `CURRENT_ADMIN_ADDRESS`.

- [ ] **Step 4: Run the targeted referral API tests and verify they pass**

Run:

```bash
npx jest src/app/api/referral/route.test.ts --runInBand
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
  Referral API
    ✓ allows the current admin wallet to airdrop bonus
    ✓ rejects a non-admin wallet for bonus airdrop
    ✓ rejects the retired admin wallet even when stale config references it
    ✓ allows the current admin wallet to fetch leaderboard
```

- [ ] **Step 5: Run diagnostics to catch TypeScript or lint regressions**

Run diagnostics for:

```text
src/app/api/referral/route.ts
src/app/api/referral/route.test.ts
```

Expected:

```text
No new diagnostics in edited files.
```

- [ ] **Step 6: Commit the implementation**

Run:

```bash
git add src/app/api/referral/route.ts src/app/api/referral/route.test.ts
git commit -m "fix: update referral admin wallet authorization"
```

Expected:

```text
[branch-name def5678] fix: update referral admin wallet authorization
 2 files changed, ...
```
