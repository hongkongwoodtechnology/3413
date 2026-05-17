# Local Build And Admin Wallet Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a trustworthy local release baseline by fixing build blockers, removing retired admin-wallet fallback behavior, normalizing local rotated wallet config, and verifying the production bundle contains no `AQDd...` remnants.

**Architecture:** Keep the patch narrowly scoped to type correctness, authorization hardening, and verification plumbing. Use targeted Jest coverage for route and auth behavior, use `npm run build` as the red/green signal for type-only regressions, and treat deployment sync plus treasury migration as a documented handoff instead of an inline code change.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest, PowerShell, Solana wallet/env configuration

---

## File Structure

- `src/app/api/admin/payout/route.ts`
  - Extends the local `BetRecord` shape so route code matches persisted legacy JSON fields already read and written by the API.
- `src/app/api/admin/payout/route.test.ts`
  - Covers payout-queue auth plus legacy mutation actions like `archive_old_bets` and `mark_legacy_wins`.
- `src/lib/security/auth.ts`
  - Shared admin-address allowlist helper and signature verification. This is where retired fallback behavior must be removed.
- `src/lib/security/auth.test.ts`
  - New focused test file for `getAdminAddresses()` fail-closed behavior.
- `src/app/[locale]/admin/finance/page.tsx`
  - Multi-locale admin finance page currently lags the current `DangerActionsPanel` prop contract.
- `src/components/admin/overview/OverviewShortcuts.tsx`
  - Shared admin overview shortcut component that needs to accept both current and legacy caller shapes during stabilization.
- `src/app/page.tsx`
  - Root betting page; contains admin wallet check and BigInt build compatibility in the current placement flow.
- `src/app/[locale]/page.tsx`
  - Localized betting page; same compatibility fixes as the root page.
- `src/components/ReferralLandingPage.tsx`
  - Referral landing overlay; needs nullable `referrerId` compatibility for the current page wiring.
- `.env.local`
  - Local-only secret config; normalize by keeping only one active rotated value per tracked key and never commit it.
- `docs/superpowers/plans/2026-05-17-wallet-rotation-handoff.md`
  - Sanitized deployment and treasury handoff checklist created after local verification passes.

### Task 1: Align payout-route tests with legacy mutation behavior

**Files:**
- Modify: `src/app/api/admin/payout/route.ts`
- Modify: `src/app/api/admin/payout/route.test.ts`
- Test: `src/app/api/admin/payout/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the outdated `"rejects the removed legacy payout action"` test with two explicit mutation tests. Keep the existing auth coverage at the top of the file.

```ts
  it("archives unsigned legacy bets for authorized admins", async () => {
    mockBetsDb = JSON.stringify({
      LegacyArchive111111111111111111111111111111: [
        {
          id: "bet-legacy-archive-1",
          userAddress: "LegacyArchive111111111111111111111111111111",
          matchId: 202,
          matchName: "Legacy Match",
          outcome: "home",
          amount: 15,
          status: "pending",
          useBonus: false,
          timestamp: 1234567890,
          paidOut: false,
          signature: null,
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/admin/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive_old_bets" }),
      }) as any
    );
    const json = await response.json();
    const savedDb = JSON.parse(mockBetsDb);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.archived).toBe(1);
    expect(savedDb.LegacyArchive111111111111111111111111111111[0]).toMatchObject({
      archived: true,
      paidOut: true,
    });
  });

  it("marks pre-cutoff legacy wins for manual payout handling", async () => {
    mockBetsDb = JSON.stringify({
      LegacyWinner1111111111111111111111111111111: [
        {
          id: "bet-legacy-win-1",
          userAddress: "LegacyWinner1111111111111111111111111111111",
          matchId: 303,
          matchName: "Legacy Final",
          outcome: "away",
          amount: 12,
          odds: 2.2,
          status: "win",
          useBonus: false,
          timestamp: new Date("2026-05-18T12:00:00Z").getTime(),
          paidOut: false,
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/admin/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_legacy_wins" }),
      }) as any
    );
    const json = await response.json();
    const savedDb = JSON.parse(mockBetsDb);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.marked).toBe(1);
    expect(json.affectedUsers).toBe(1);
    expect(savedDb.LegacyWinner1111111111111111111111111111111[0]).toMatchObject({
      legacyPayout: true,
      paidOut: true,
    });
  });
```

- [ ] **Step 2: Run the targeted test file to verify it fails**

Run:

```bash
npx jest src/app/api/admin/payout/route.test.ts --runInBand
```

Expected:

- the new mutation assertions fail because the route typings and test expectations are not yet aligned
- the old `"rejects the removed legacy payout action"` test no longer exists

- [ ] **Step 3: Write the minimal implementation**

Update `BetRecord` so it matches the legacy fields already used by the route logic.

```ts
interface BetRecord {
  id: string;
  userAddress: string;
  matchId: number;
  matchName: string;
  outcome: string;
  amount: number;
  odds?: number;
  signature?: string | null;
  status?: string;
  useBonus: boolean;
  timestamp: number;
  paidOut?: boolean;
  archived?: boolean;
  legacyPayout?: boolean;
}
```

Do not change the route behavior in this task beyond the type shape.

- [ ] **Step 4: Run the targeted test file to verify it passes**

Run:

```bash
npx jest src/app/api/admin/payout/route.test.ts --runInBand
```

Expected:

- PASS
- the queue auth tests still pass
- the new archive and legacy-win mutation tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/payout/route.ts src/app/api/admin/payout/route.test.ts
git commit -m "fix: align payout route with legacy bet fields"
```

### Task 2: Remove retired admin fallback and add fail-closed auth tests

**Files:**
- Modify: `src/lib/security/auth.ts`
- Create: `src/lib/security/auth.test.ts`
- Test: `src/lib/security/auth.test.ts`

- [ ] **Step 1: Write the failing auth-helper tests**

Create `src/lib/security/auth.test.ts` with focused coverage around `getAdminAddresses()`.

```ts
/**
 * @jest-environment node
 */

describe("getAdminAddresses", () => {
  const originalAdmin = process.env.ADMIN_WALLET_ADDRESS;
  const originalHouse = process.env.NEXT_PUBLIC_HOUSE_WALLET;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.ADMIN_WALLET_ADDRESS;
    delete process.env.NEXT_PUBLIC_HOUSE_WALLET;
  });

  afterAll(() => {
    if (originalAdmin === undefined) {
      delete process.env.ADMIN_WALLET_ADDRESS;
    } else {
      process.env.ADMIN_WALLET_ADDRESS = originalAdmin;
    }

    if (originalHouse === undefined) {
      delete process.env.NEXT_PUBLIC_HOUSE_WALLET;
    } else {
      process.env.NEXT_PUBLIC_HOUSE_WALLET = originalHouse;
    }
  });

  it("returns an empty allowlist when no admin env is configured", async () => {
    const { getAdminAddresses } = await import("./auth");
    expect(getAdminAddresses()).toEqual([]);
  });

  it("returns a de-duplicated list from admin and house env values", async () => {
    process.env.ADMIN_WALLET_ADDRESS = "Admin111111111111111111111111111111111";
    process.env.NEXT_PUBLIC_HOUSE_WALLET = "Admin111111111111111111111111111111111";
    const { getAdminAddresses } = await import("./auth");
    expect(getAdminAddresses()).toEqual(["Admin111111111111111111111111111111111"]);
  });

  it("includes both env addresses when they differ", async () => {
    process.env.ADMIN_WALLET_ADDRESS = "Admin111111111111111111111111111111111";
    process.env.NEXT_PUBLIC_HOUSE_WALLET = "House111111111111111111111111111111111";
    const { getAdminAddresses } = await import("./auth");
    expect(getAdminAddresses()).toEqual([
      "Admin111111111111111111111111111111111",
      "House111111111111111111111111111111111",
    ]);
  });
});
```

- [ ] **Step 2: Run the auth test file to verify it fails**

Run:

```bash
npx jest src/lib/security/auth.test.ts --runInBand
```

Expected:

- FAIL on the empty-allowlist test because the helper currently falls back to a retired hard-coded wallet

- [ ] **Step 3: Write the minimal implementation**

Update `getAdminAddresses()` to fail closed when env is missing.

```ts
export function getAdminAddresses(): string[] {
  const addresses: string[] = [];
  const fromEnv = process.env.ADMIN_WALLET_ADDRESS?.trim();
  if (fromEnv) addresses.push(fromEnv);
  const fromHouse = process.env.NEXT_PUBLIC_HOUSE_WALLET?.trim();
  if (fromHouse) addresses.push(fromHouse);
  return [...new Set(addresses)];
}
```

Do not change the signature verification flow in this task.

- [ ] **Step 4: Run the auth test file to verify it passes**

Run:

```bash
npx jest src/lib/security/auth.test.ts --runInBand
```

Expected:

- PASS
- no retired wallet is returned when env is absent

- [ ] **Step 5: Commit**

```bash
git add src/lib/security/auth.ts src/lib/security/auth.test.ts
git commit -m "fix: fail closed when admin wallet env is missing"
```

### Task 3: Clear the known admin-page build blockers

**Files:**
- Modify: `src/app/[locale]/admin/finance/page.tsx`
- Modify: `src/components/admin/overview/OverviewShortcuts.tsx`

- [ ] **Step 1: Run the production build to verify the current blocker**

Run:

```bash
npm run build
```

Expected:

- FAIL on the known admin-page type issues already observed in local investigation
- first failure should be around missing `onMarkLegacyWins` or legacy shortcut prop shape mismatch if Task 1 and Task 2 are already complete

- [ ] **Step 2: Write the minimal implementation**

Update the locale finance page so `DangerActionsPanel` receives the full current prop set.

```tsx
  const runPayoutAction = useCallback(async (action: 'mark_paid' | 'archive_old_bets' | 'mark_legacy_wins') => {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '財務操作失敗');
      }

      const messages: Record<typeof action, string> = {
        mark_paid: `已標記 ${data.marked ?? 0} 筆為已付款`,
        archive_old_bets: data.message || `已封存 ${data.archived ?? 0} 筆舊注單`,
        mark_legacy_wins: data.message || `已標記 ${data.marked ?? 0} 筆舊架構贏家`,
      };

      setMessage(messages[action]);
      await fetchFinance();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '財務操作失敗');
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchFinance]);

      <DangerActionsPanel
        onArchive={() => runPayoutAction('archive_old_bets')}
        onMarkLegacyWins={() => runPayoutAction('mark_legacy_wins')}
        isSubmitting={isSubmitting}
      />
```

Update `OverviewShortcuts` so it accepts both current `shortcuts` items and legacy admin-page `items` callers during the build-hardening pass.

```tsx
type ShortcutItem = {
  title: string;
  description: string;
  icon: string;
  href: string;
};

type LegacyShortcutItem = {
  label: string;
  href: string;
};

type OverviewShortcutsProps = {
  items?: ShortcutItem[] | LegacyShortcutItem[];
  shortcuts?: ShortcutItem[];
};

function normalizeShortcuts(items?: ShortcutItem[] | LegacyShortcutItem[]): ShortcutItem[] {
  if (!items || items.length === 0) return defaultShortcuts;

  return items.map((item) => {
    if ('title' in item) return item;
    return {
      title: item.label,
      description: item.label,
      icon: '→',
      href: item.href,
    };
  });
}

export function OverviewShortcuts({ items, shortcuts = normalizeShortcuts(items) }: OverviewShortcutsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {shortcuts.map((shortcut) => (
        <a
          key={shortcut.title}
          href={shortcut.href}
          className="group rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5 transition-colors hover:border-neutral-700 hover:bg-neutral-900"
        >
```

- [ ] **Step 3: Run the production build to verify the next blocker**

Run:

```bash
npm run build
```

Expected:

- the admin finance and shortcut prop failures are gone
- if build still fails, the failure moves forward to the homepage compatibility issues handled in Task 4

- [ ] **Step 4: Run diagnostics on the edited files**

Run diagnostics for:

- `src/app/[locale]/admin/finance/page.tsx`
- `src/components/admin/overview/OverviewShortcuts.tsx`

Expected:

- no new diagnostics

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/admin/finance/page.tsx src/components/admin/overview/OverviewShortcuts.tsx
git commit -m "fix: restore admin page build compatibility"
```

### Task 4: Clear the known homepage build blockers without changing betting rules

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/components/ReferralLandingPage.tsx`

- [ ] **Step 1: Run the production build to verify the current homepage blocker**

Run:

```bash
npm run build
```

Expected:

- FAIL on one of the already observed homepage issues:
  - `0n` BigInt literal while `tsconfig` targets `ES2017`
  - `ReferralLandingPage` nullability mismatch
  - stale hard-coded admin wallet checks

- [ ] **Step 2: Write the minimal implementation**

Update both homepage variants to remove the hard-coded admin wallet comparison and use the configured wallet source.

```tsx
  const isAdmin = useMemo(() => {
    return connected && publicKey?.toBase58() === HOUSE_WALLET.toBase58();
  }, [connected, publicKey]);
```

Replace the BigInt literal comparison in both homepage files.

```tsx
        transaction.add(splTransferInstruction(userATA, poolATA, actualPublicKey, rawPoolAmount));
        if (rawCombinedFeeAmount > BigInt(0)) {
          transaction.add(splTransferInstruction(userATA, adminATA, actualPublicKey, rawCombinedFeeAmount));
        }
```

Update the referral landing component prop contract so it matches the current page flow.

```tsx
interface ReferralLandingPageProps {
  referrerId: string | null;
  onSkip: () => void;
}

export function ReferralLandingPage({ referrerId, onSkip }: ReferralLandingPageProps) {
  const { connected } = useWallet();
  const { t } = useLanguage();

  if (connected) {
    return null;
  }

  const formatAddress = (address: string | null) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };
```

- [ ] **Step 3: Run the production build to verify the homepage blockers are gone**

Run:

```bash
npm run build
```

Expected:

- BigInt literal and `referrerId` type failures are gone
- if any additional build blocker remains, it is a newly surfaced downstream type mismatch that must be fixed before Task 5

- [ ] **Step 4: Run diagnostics on the edited files**

Run diagnostics for:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/components/ReferralLandingPage.tsx`

Expected:

- no new diagnostics

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/[locale]/page.tsx src/components/ReferralLandingPage.tsx
git commit -m "fix: harden homepage build compatibility"
```

### Task 5: Normalize local wallet config, verify the bundle, and write the handoff

**Files:**
- Modify: `.env.local`
- Create: `docs/superpowers/plans/2026-05-17-wallet-rotation-handoff.md`

- [ ] **Step 1: Back up and normalize `.env.local` without exposing secrets**

Back up the local file first:

```powershell
Copy-Item .env.local .env.local.bak-2026-05-17
```

Then run this PowerShell snippet from the repo root to keep only the last occurrence of the tracked wallet keys:

```powershell
$path = ".env.local"
$tracked = @(
  "NEXT_PUBLIC_HOUSE_WALLET",
  "ADMIN_WALLET_ADDRESS",
  "NEXT_PUBLIC_COMMISSION_WALLET",
  "ADMIN_SECRET_KEY",
  "COMMISSION_SECRET_KEY"
)
$lines = Get-Content $path
$seen = @{}
$result = New-Object System.Collections.Generic.List[string]
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
  $line = $lines[$i]
  $matched = $false
  foreach ($key in $tracked) {
    if ($line -match "^$key=") {
      if (-not $seen.ContainsKey($key)) {
        $seen[$key] = $true
        $result.Add($line)
      }
      $matched = $true
      break
    }
  }
  if (-not $matched) {
    $result.Add($line)
  }
}
[array]::Reverse($result.ToArray()) | Set-Content $path
```

- [ ] **Step 2: Verify the normalized local wallet keys**

Run:

```powershell
Select-String -Path .env.local -Pattern "^(NEXT_PUBLIC_HOUSE_WALLET|ADMIN_WALLET_ADDRESS|NEXT_PUBLIC_COMMISSION_WALLET|ADMIN_SECRET_KEY|COMMISSION_SECRET_KEY)="
```

Expected:

- exactly one line per tracked key
- the public keys match the latest rotated local values
- no duplicate `ADMIN_SECRET_KEY` remains

- [ ] **Step 3: Run the full build and scan production output for suspicious wallet remnants**

Run:

```bash
npm run build
```

Expected:

- PASS
- `.next` production assets are generated

Then scan the production output:

```powershell
Get-ChildItem .next -Recurse -File | Select-String -Pattern "AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq"
Get-ChildItem .next -Recurse -File | Select-String -Pattern "3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2"
```

Expected:

- no hits for `AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq`
- no unexpected stale hard-coded admin wallet in client bundles

- [ ] **Step 4: Write the sanitized deployment and treasury handoff**

Create `docs/superpowers/plans/2026-05-17-wallet-rotation-handoff.md` with this content:

```md
# Wallet Rotation Deployment Handoff

## Deploy Sync

- Update `NEXT_PUBLIC_HOUSE_WALLET` in the deployment environment to the current rotated admin public key.
- Update `ADMIN_WALLET_ADDRESS` in the deployment environment to the same rotated admin public key.
- Update `NEXT_PUBLIC_COMMISSION_WALLET` in the deployment environment to the current rotated commission public key.
- Update `ADMIN_SECRET_KEY` in the deployment environment to the rotated admin secret key.
- Update `COMMISSION_SECRET_KEY` in the deployment environment to the rotated commission secret key.
- Redeploy only after local `npm run build` passes and `.next` scans show no `AQDd...` hits.

## Security Expectations

- `src/lib/security/auth.ts` must fail closed when admin env is missing.
- No retired hard-coded admin wallet may remain as an auth fallback.
- Old private keys are treated as compromised and must never be reused.

## Treasury Transfer Checklist

1. Open the retired hot wallet in a trusted wallet client.
2. Transfer remaining SOL needed for fees only if required to complete outgoing transfers.
3. Transfer all remaining USDT and other custodial tokens to the newly rotated treasury destination approved by operations.
4. Verify each transfer on-chain before shutting down access to the retired wallet.
5. Remove the retired secret from every deployed environment and local machine that no longer needs it.

## Final Gate

- Do not update production until:
  - local build is green
  - `.next` contains no `AQDd...`
  - deployment env values are updated
  - treasury transfer ownership is explicitly assigned
```

- [ ] **Step 5: Commit the sanitized handoff doc only**

Do not add `.env.local`.

```bash
git add docs/superpowers/plans/2026-05-17-wallet-rotation-handoff.md
git commit -m "docs: add wallet rotation deployment handoff"
```

## Self-Review

- Spec coverage:
  - build restoration -> Task 1, Task 3, Task 4, Task 5
  - admin fallback removal -> Task 2
  - local env normalization -> Task 5
  - production bundle verification -> Task 5
  - deployment and treasury handoff -> Task 5
- Placeholder scan:
  - no `TODO`, `TBD`, or “similar to above” shortcuts remain
  - each code-changing task includes exact snippets and exact commands
- Type consistency:
  - `archived` and `legacyPayout` are optional legacy flags across route logic
  - `getAdminAddresses()` remains the shared auth helper name
  - `HOUSE_WALLET.toBase58()` is the admin comparison source in both homepage variants

