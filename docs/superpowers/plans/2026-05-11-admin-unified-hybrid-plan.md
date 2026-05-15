# Admin Unified Hybrid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the embedded homepage admin panel and the legacy `/admin` system into one hybrid admin experience with a compact homepage quick panel and a unified full `/admin` back office.

**Architecture:** Keep `/admin` as the single operational admin shell, move homepage admin usage to a summary-only quick panel, and split the current mega dashboard into route-level modules and focused section components. Reuse existing APIs and business logic where possible, but reorganize layout, navigation, and component boundaries so the UI becomes scalable and visually coherent.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing UI primitives, Lucide icons, Recharts, Jest, VS Code diagnostics

---

## File Map

- Modify: `src/app/page.tsx`
  - remove full embedded admin rendering
  - replace with an admin quick panel entry path
- Modify: `src/app/admin/layout.tsx`
  - rebuild as the canonical dark admin shell with unified navigation
- Modify: `src/app/admin/page.tsx`
  - convert the overview route into the new unified summary dashboard
- Modify: `src/app/admin/users/page.tsx`
  - restyle and align the users/referrals page with the new shell
- Modify: `src/app/admin/analytics/page.tsx`
  - repurpose toward markets/matches or fold analytics into the new IA if needed
- Modify: `src/app/admin/secure-audit-logs/page.tsx`
  - restyle as the security/system module
- Refactor: `src/components/admin/AdminDashboard.tsx`
  - extract reusable logic or retire full-page usage after module split
- Create: `src/components/admin/QuickPanel.tsx`
  - compact homepage-only admin summary
- Create: `src/components/admin/AdminPageHeader.tsx`
  - shared admin top header block
- Create: `src/components/admin/overview/*`
  - overview summary widgets and alert blocks
- Create: `src/components/admin/markets/*`
  - market list, risk summary, and match details blocks
- Create: `src/components/admin/finance/*`
  - payout and revenue sections
- Create: `src/components/admin/users/*`
  - user search and referral components if extraction is needed
- Create: `src/components/admin/system/*`
  - ATA and audit/system support sections

## Task 1: Establish The Canonical Admin Shell

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\admin\layout.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\AdminPageHeader.tsx`

- [ ] **Step 1: Write the failing structural expectation**

Expected shell structure:

```tsx
<div className="min-h-screen bg-neutral-950 text-white">
  <aside>{/* five-module navigation */}</aside>
  <main>
    <AdminPageHeader />
    {children}
  </main>
</div>
```

Expectation to verify manually after implementation:

```text
1. `/admin` uses the same dark family as the main product.
2. Sidebar shows exactly five primary modules:
   - 總覽
   - 市場與賽事
   - 財務與派彩
   - 用戶與推薦
   - 安全與系統
3. Legacy white shell no longer defines the admin visual language.
```

- [ ] **Step 2: Replace the legacy light layout with a dark canonical shell**

Target `layout.tsx` direction:

```tsx
import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, LineChart, Wallet, Users, Shield } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: '總覽', icon: LayoutDashboard },
  { href: '/admin/markets', label: '市場與賽事', icon: LineChart },
  { href: '/admin/finance', label: '財務與派彩', icon: Wallet },
  { href: '/admin/users', label: '用戶與推薦', icon: Users },
  { href: '/admin/secure-audit-logs', label: '安全與系統', icon: Shield },
];
```

And the container should follow the product’s dark tokens:

```tsx
<div className="flex min-h-screen bg-neutral-950 text-neutral-100">
  <aside className="w-72 border-r border-neutral-800 bg-neutral-900/80 backdrop-blur">
    {/* brand + nav */}
  </aside>
  <main className="flex-1 bg-neutral-950">
    <div className="mx-auto max-w-[1440px] px-6 py-6">{children}</div>
  </main>
</div>
```

- [ ] **Step 3: Add a reusable admin page header component**

Create `AdminPageHeader.tsx` with a minimal shared API:

```tsx
type AdminPageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};
```

Render shape:

```tsx
export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-2 text-sm text-neutral-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Verify the shell compiles cleanly**

Run diagnostics on:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/admin/layout.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/AdminPageHeader.tsx
```

Expected: no diagnostics.

- [ ] **Step 5: Commit shell work**

```bash
git add src/app/admin/layout.tsx src/components/admin/AdminPageHeader.tsx
git commit -m "feat(admin): add unified admin shell"
```

## Task 2: Build The Homepage Quick Panel And Remove Full Embedded Admin

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\QuickPanel.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`

- [ ] **Step 1: Define the quick-panel contract**

The quick panel should be summary-only and expose navigation, not full workflows.

Expected data blocks:

```tsx
type QuickPanelCard = {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'success';
  href?: string;
};
```

Expected visible sections:

```text
1. 核心 KPI
2. 待派彩提醒
3. 異常市場提醒
4. 平台收益摘要
5. 前往 `/admin` 各模組的快捷入口
```

- [ ] **Step 2: Create the quick panel component**

Base rendering direction:

```tsx
export function QuickPanel() {
  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-6 backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Admin Quick Panel</h2>
          <p className="text-sm text-neutral-400">摘要與快捷入口</p>
        </div>
        <Link href="/admin" className="...">進入完整後台</Link>
      </div>
      {/* summary cards + alerts + quick links */}
    </section>
  );
}
```

Constraint: do not render long tables, payout action lists, ATA initialization UI, or destructive buttons inside this component.

- [ ] **Step 3: Replace homepage full admin embedding**

Current homepage branch to remove:

```tsx
{(isAdmin && showAdminPanel) ? (
  <main className="flex-1 w-full max-w-[1400px] mx-auto z-10 relative">
    <AdminDashboard />
  </main>
) : ...}
```

Target direction:

```tsx
{currentView === 'matches' && isAdmin && showAdminPanel ? (
  <QuickPanel />
) : null}
```

Or equivalent rendering that keeps admin summary visibility while routing full operations to `/admin`.

- [ ] **Step 4: Preserve admin discoverability**

Add a clear CTA in the homepage header or quick panel:

```tsx
<Link href="/admin" className="...">
  完整後台
</Link>
```

Expected result:

```text
The homepage no longer hosts the full operational admin dashboard.
Admins can still see a quick summary and jump into `/admin`.
```

- [ ] **Step 5: Verify `page.tsx` and `QuickPanel.tsx`**

Run diagnostics on:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/QuickPanel.tsx
```

Expected: no diagnostics.

- [ ] **Step 6: Commit homepage quick-panel work**

```bash
git add src/app/page.tsx src/components/admin/QuickPanel.tsx
git commit -m "feat(admin): add homepage quick panel"
```

## Task 3: Split The Unified Admin Overview

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\admin\page.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\overview\OverviewKpiGrid.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\overview\OverviewAlerts.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\overview\OverviewShortcuts.tsx`

- [ ] **Step 1: Replace the legacy `/admin` page role**

The new `/admin` page should be a summary dashboard only.

Required content:

```text
1. 四張核心 KPI 卡
2. 異常與待派彩提醒區
3. 平台收益摘要
4. 快速跳轉到市場、財務、用戶、安全頁
```

Not allowed on this page:

```text
- huge long tables
- ATA init details
- full payout list
- deep financial transaction history
```

- [ ] **Step 2: Create overview section components**

Suggested breakdown:

```tsx
<AdminPageHeader title="總覽" description="營運摘要、風險提醒與快捷入口" />
<OverviewKpiGrid />
<OverviewAlerts />
<OverviewShortcuts />
```

Each overview subcomponent should keep one responsibility:

```text
OverviewKpiGrid -> summary cards only
OverviewAlerts -> anomaly / payout / revenue alerts
OverviewShortcuts -> links into detailed admin modules
```

- [ ] **Step 3: Reuse existing fetch logic where possible**

Extract or adapt only the data needed for summaries from the current large admin dashboard:

```tsx
const [totalReserve, setTotalReserve] = useState(0);
const [realStats, setRealStats] = useState(...);
const [payoutData, setPayoutData] = useState(...);
```

Do not import the old monolithic layout wholesale into the new overview route.

- [ ] **Step 4: Verify the overview route stays visually compact**

Manual expectation:

```text
1. Initial viewport shows summary-first content.
2. No long management table appears above the fold.
3. The page feels lighter than the current mega dashboard.
```

- [ ] **Step 5: Run diagnostics**

Run diagnostics on:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/admin/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/overview/OverviewKpiGrid.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/overview/OverviewAlerts.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/overview/OverviewShortcuts.tsx
```

Expected: no diagnostics.

- [ ] **Step 6: Commit overview work**

```bash
git add src/app/admin/page.tsx src/components/admin/overview
git commit -m "feat(admin): rebuild overview dashboard"
```

## Task 4: Create The Markets And Matches Module

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\admin\markets\page.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\markets\MarketHealthPanel.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\markets\MarketList.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\markets\MatchDetailTable.tsx`

- [ ] **Step 1: Move market-monitoring responsibilities out of the mega dashboard**

This module owns:

```text
- market list
- concentration risk
- global distribution chart
- match-level details
- search / sort / export
```

- [ ] **Step 2: Port the existing market data sources**

Reuse current state and fetch patterns from `AdminDashboard.tsx`:

```tsx
const [markets, setMarkets] = useState<MarketData[]>([]);
const [matchDetails, setMatchDetails] = useState(...);
const [searchQuery, setSearchQuery] = useState('');
const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
const [sortBy, setSortBy] = useState<'volume' | 'bettors' | 'id'>('volume');
```

Preserve the same APIs and polling logic unless a smaller extraction is clearly possible.

- [ ] **Step 3: Build the route composition**

Suggested page composition:

```tsx
<AdminPageHeader title="市場與賽事" description="監控賽事資金分布、集中度與投注明細" />
<MarketHealthPanel />
<MarketList />
<MatchDetailTable />
```

- [ ] **Step 4: Keep export and filters inside this page only**

Expected UX result:

```text
Search, sorting, anomaly filtering, and CSV export no longer compete for space on the overview page.
```

- [ ] **Step 5: Run diagnostics**

Run diagnostics on:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/admin/markets/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/markets/MarketHealthPanel.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/markets/MarketList.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/markets/MatchDetailTable.tsx
```

Expected: no diagnostics.

- [ ] **Step 6: Commit markets module**

```bash
git add src/app/admin/markets/page.tsx src/components/admin/markets
git commit -m "feat(admin): add markets and matches module"
```

## Task 5: Create The Finance And Payouts Module

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\admin\finance\page.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\finance\RevenuePanel.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\finance\PayoutPanel.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\finance\DangerActionsPanel.tsx`

- [ ] **Step 1: Move financial and payout workflows into one route**

This page owns:

```text
- winner payouts
- platform revenue
- withdrawals
- archive old bets
- legacy payout handling
```

- [ ] **Step 2: Keep dangerous actions visually separated**

Expected grouping:

```tsx
<RevenuePanel />
<PayoutPanel />
<DangerActionsPanel />
```

`DangerActionsPanel` should host:

```text
- archive old bets
- mark legacy wins
- any action with irreversible or operator-risk consequences
```

- [ ] **Step 3: Reuse current payout and revenue logic**

Current functions to preserve or extract:

```tsx
fetchPayouts()
markAllPaid()
archiveOldBets()
markLegacyWins()
fetchAdminRevenue()
fetchPlatformRevenueStatus()
handleWithdrawPlatformRevenue()
```

Do not change their business meaning; only relocate and reorganize their UI.

- [ ] **Step 4: Ensure the overview page only links here**

Expected result:

```text
The overview page surfaces payout or revenue summaries, but all full payout and money-action workflows live inside `/admin/finance`.
```

- [ ] **Step 5: Run diagnostics**

Run diagnostics on:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/admin/finance/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/finance/RevenuePanel.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/finance/PayoutPanel.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/components/admin/finance/DangerActionsPanel.tsx
```

Expected: no diagnostics.

- [ ] **Step 6: Commit finance module**

```bash
git add src/app/admin/finance/page.tsx src/components/admin/finance
git commit -m "feat(admin): add finance and payouts module"
```

## Task 6: Unify Users, Referrals, And Security Pages

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\admin\users\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\admin\secure-audit-logs\page.tsx`
- Create if needed: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\users\ReferralTools.tsx`
- Create if needed: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\system\AtaInitializationPanel.tsx`

- [ ] **Step 1: Restyle the users page into the new dark admin system**

Required alignment:

```text
- use AdminPageHeader
- dark surfaces
- spacing and border language consistent with the shell
- referral tooling grouped logically with user search
```

- [ ] **Step 2: Decide where leaderboard, airdrop, and commission controls live**

Implementation rule:

```text
Move leaderboard, airdrop, and commission controls into the users/referrals module unless they are needed only as summary data on overview.
```

- [ ] **Step 3: Restyle the audit/system page**

Required content:

```text
- audit logs
- ATA initialization
- security/system messaging
```

If the single page becomes too large, split the ATA block into a dedicated reusable component.

- [ ] **Step 4: Keep analytics either absorbed or deprecated intentionally**

Implementation rule:

```text
If `src/app/admin/analytics/page.tsx` still represents useful standalone reporting, restyle it and align it to the shell.
If its content is fully covered by the new IA, redirect or fold it into the appropriate module deliberately instead of leaving it as a disconnected legacy page.
```

- [ ] **Step 5: Run diagnostics**

Run diagnostics on:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/admin/users/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/admin/secure-audit-logs/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/admin/analytics/page.tsx
```

Expected: no diagnostics.

- [ ] **Step 6: Commit unified users/security work**

```bash
git add src/app/admin/users/page.tsx src/app/admin/secure-audit-logs/page.tsx src/app/admin/analytics/page.tsx src/components/admin/users src/components/admin/system
git commit -m "feat(admin): unify users and system modules"
```

## Task 7: Retire The Mega Dashboard Path And Run Final Verification

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\admin\AdminDashboard.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`

- [ ] **Step 1: Decide the final status of `AdminDashboard.tsx`**

Allowed end states:

```text
1. Keep only as a thin adapter for quick-panel or overview reuse.
2. Delete it if fully replaced.
3. Reduce it to extracted helpers only.
```

Not allowed:

```text
Leave it as the active full operational admin path from the homepage.
```

- [ ] **Step 2: Verify hybrid behavior**

Manual verification checklist:

```text
1. Admin on homepage sees only a compact quick panel.
2. `/admin` opens the full unified back office.
3. Five-module navigation is present and stable.
4. High-risk actions are no longer mixed into the homepage or overview summary.
5. The admin visual language is consistently dark.
```

- [ ] **Step 3: Run the smallest meaningful automated verification**

Run:

```bash
npm test -- src/app/api/bets/route.test.ts src/lib/wallets.test.ts
```

Expected: PASS

If admin-specific tests are added during implementation, include them in the same command.

- [ ] **Step 4: Run final diagnostics sweep on changed admin files**

Use diagnostics on the main changed files:

```text
src/app/page.tsx
src/app/admin/layout.tsx
src/app/admin/page.tsx
src/app/admin/users/page.tsx
src/app/admin/analytics/page.tsx
src/app/admin/secure-audit-logs/page.tsx
```

Expected: no diagnostics.

- [ ] **Step 5: Commit final cleanup**

```bash
git add src/app/page.tsx src/app/admin src/components/admin
git commit -m "refactor(admin): complete unified hybrid admin redesign"
```

## Self-Review

- Spec coverage: the plan covers homepage quick panel, `/admin` as the canonical back office, the five-module IA, dark visual unification, modular admin decomposition, and relocation of risky tools away from overview surfaces.
- Placeholder scan: no `TODO`, `TBD`, or vague “handle later” instructions remain.
- Type consistency: the plan consistently uses `QuickPanel`, `AdminPageHeader`, `markets`, `finance`, `users`, and `secure-audit-logs` module naming without introducing conflicting labels.
