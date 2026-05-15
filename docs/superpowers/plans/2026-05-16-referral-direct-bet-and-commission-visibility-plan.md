# Referral Direct Bet And Commission Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the referral page clearly show each direct referral's bet amount, commission status, and ledger-backed aggregate totals without changing withdrawable or settlement rules.

**Architecture:** Keep the existing `/api/referral` response contract and withdrawal math unchanged. Implement the fix in `src/app/[locale]/referral/page.tsx` by filtering out withdrawal ledger rows, rendering richer commission-history rows, and deriving fallback referral aggregates from commission entries when stored referee totals are zero. Add one minimal translation key and expand the focused referral page tests to lock in the display behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Jest, Testing Library

---

## File Structure

### Files to modify

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`
  - Expand the mock referral payload and add regression tests for bet amount rendering, pending/settled visibility, withdrawal-row exclusion, and referee aggregate fallback.
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
  - Keep the API fetch intact but stop baking display-only getters into fetch results. Derive visible commission rows and fallback referee totals from the ledger in `useMemo` so the UI stays consistent with the raw data.
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`
  - Add the one new history label key used by the page: `referral.history.bet_amount`.

### Files to reference only

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
  - Confirm there is no server contract change and that `withdrawable` remains settled-only.
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`
  - Reference existing API tests only; this plan intentionally does not change route logic.

## Task 1: Lock In The Missing Referral Display With Failing UI Tests

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`

- [ ] **Step 1: Add a reusable mock payload builder**

Insert this helper above `global.fetch = jest.fn(...)` in `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`:

```tsx
const buildReferralPayload = (overrides?: Partial<any>) => ({
  stats: {
    total: '0.382080 USDT',
    withdrawable: '0.000000 USDT',
    month: '0.382080 USDT',
    friends: 1,
  },
  commissions: [
    {
      id: 'comm-pending-1',
      referee: '6fPendingRefereeABCDEFGH123456789',
      betAmount: '5.000000',
      fee: '0.400000',
      commission: '0.120000',
      timestamp: '2026-05-16T08:00:00.000Z',
      status: 'pending',
    },
    {
      id: 'comm-settled-1',
      referee: '6fPendingRefereeABCDEFGH123456789',
      betAmount: '2.000000',
      fee: '0.160000',
      commission: '0.048000',
      timestamp: '2026-05-15T08:00:00.000Z',
      status: 'settled',
    },
    {
      id: 'wd-hidden-1',
      referee: 'WITHDRAWAL',
      betAmount: '0.000000',
      fee: '0.050000',
      commission: '-0.050000',
      timestamp: '2026-05-14T08:00:00.000Z',
      status: 'settled',
    },
  ],
  referees: [
    {
      id: 'ref-1',
      address: '6fPendingRefereeABCDEFGH123456789',
      joinDateValue: 0,
      totalVolumeValue: 0,
      earnedCommissionValue: 0,
    },
  ],
  balances: { usdt: 0, bonus: 0 },
  commissionRate: 0.3,
  ...overrides,
});
```

- [ ] **Step 2: Add the new translation key to the page-test dictionary**

Add this entry to the `dict` object in the `useLanguage` mock inside `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`:

```tsx
'referral.history.bet_amount': '投注金额',
```

- [ ] **Step 3: Make the default fetch mock return the reusable payload**

Replace the current `json: async () => ({ data: { ... } })` block in the GET branch of `global.fetch` with:

```tsx
json: async () => ({
  data: buildReferralPayload(),
}),
```

- [ ] **Step 4: Add a failing history-details test**

Append this test under the existing withdraw-card tests in `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`:

```tsx
it('shows bet amount and status in commission rows while hiding withdrawal ledger rows', async () => {
  render(<ReferralPage />);

  await waitFor(() => {
    expect(screen.getByText('投注金额: 5.000000 USDT')).toBeInTheDocument();
  });

  expect(screen.getByText('待结算')).toBeInTheDocument();
  expect(screen.getByText('已结算')).toBeInTheDocument();
  expect(screen.getByText('+0.120000 USDT')).toBeInTheDocument();
  expect(screen.queryByText('-0.050000 USDT')).not.toBeInTheDocument();
  expect(screen.queryByText('WITHDRAWAL')).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Add a failing aggregate-fallback test**

Append this second test below the previous one:

```tsx
it('derives referee volume and commission from commission ledger rows when stored aggregates are zero', async () => {
  render(<ReferralPage />);

  await waitFor(() => {
    expect(screen.getByText('7.00 USDT')).toBeInTheDocument();
  });

  expect(screen.getByText('+0.17 USDT')).toBeInTheDocument();
});
```

- [ ] **Step 6: Run the focused referral page test file to verify it fails**

Run:

```bash
npm test -- "src/app/[locale]/referral/page.test.tsx" --runInBand
```

Expected:

```text
FAIL src/app/[locale]/referral/page.test.tsx
- Unable to find an element with the text: 投注金额: 5.000000 USDT
- Unable to find an element with the text: 7.00 USDT
```

- [ ] **Step 7: Commit the failing test coverage**

```bash
git add src/app/[locale]/referral/page.test.tsx
git commit -m "test: cover referral bet visibility regressions"
```

## Task 2: Implement Ledger-Backed Referral Display In The Page

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`

- [ ] **Step 1: Replace the ad-hoc numeric parser with a reusable helper**

In `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`, replace the existing `parseUsdtDisplay` helper with this version:

```tsx
const parseNumericValue = (value: string | number | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? '')
    .replace('USDT', '')
    .trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
```

Then update these lines to call the new helper:

```tsx
const totalCommissionValue = parseNumericValue(stats.total);
const withdrawableCommissionValue = parseNumericValue(stats.withdrawable);
```

- [ ] **Step 2: Keep raw referee data from the API instead of formatting inside `fetchReferralData()`**

In `fetchReferralData()`, delete the current `formattedReferees` mapping and store `data.referees` directly:

```tsx
setReferralData({
  stats: data.stats,
  commissions: data.commissions,
  referees: data.referees,
  balances: data.balances || { usdt: 0, bonus: 0 },
  commissionRate: data.commissionRate ?? 0.3,
});
```

- [ ] **Step 3: Derive visible commission rows and ledger fallback aggregates**

Replace the existing `const commissions = ...` and `const allReferees = ...` declarations with this block:

```tsx
const commissions = referralData?.commissions || [];

const visibleCommissions = React.useMemo(
  () => commissions.filter((commission) => commission.referee !== 'WITHDRAWAL'),
  [commissions]
);

const refereeLedgerTotals = React.useMemo(() => {
  const totals = new Map<string, { totalVolumeValue: number; earnedCommissionValue: number }>();

  for (const commission of visibleCommissions) {
    const current = totals.get(commission.referee) || {
      totalVolumeValue: 0,
      earnedCommissionValue: 0,
    };

    current.totalVolumeValue += parseNumericValue(commission.betAmount);
    current.earnedCommissionValue += parseNumericValue(commission.commission);
    totals.set(commission.referee, current);
  }

  return totals;
}, [visibleCommissions]);

const allReferees = React.useMemo(() => {
  return (referralData?.referees || []).map((ref: any) => {
    const derived = refereeLedgerTotals.get(ref.address);
    const totalVolumeValue =
      ref.totalVolumeValue > 0 ? ref.totalVolumeValue : derived?.totalVolumeValue ?? 0;
    const earnedCommissionValue =
      ref.earnedCommissionValue > 0 ? ref.earnedCommissionValue : derived?.earnedCommissionValue ?? 0;

    return {
      ...ref,
      totalVolumeValue,
      earnedCommissionValue,
      joinDate: ref.joinDateValue === 0 ? 'Just now' : `${ref.joinDateValue} days ago`,
      totalVolume: `${totalVolumeValue.toFixed(2)} USDT`,
      earnedCommission: `${earnedCommissionValue.toFixed(2)} USDT`,
    };
  });
}, [referralData?.referees, refereeLedgerTotals]);
```

- [ ] **Step 4: Make the history filters operate on visible commission rows only**

Replace the current `filteredCommissions` definition with:

```tsx
const filteredCommissions = (activeTab === 'all'
  ? visibleCommissions
  : visibleCommissions.filter((commission) => commission.status === activeTab)
).filter((commission) => cutoff === 0 || new Date(commission.timestamp).getTime() >= cutoff);
```

- [ ] **Step 5: Render bet amount, status badge, and explicit USDT units in each history row**

Inside the `paginatedCommissions.map((comm) => ...)` block, replace the left-hand text stack and right-hand amount stack with:

```tsx
<div>
  <div className="text-base font-bold text-white font-mono">
    {comm.referee.length > 12 ? `${comm.referee.slice(0, 4)}...${comm.referee.slice(-4)}` : comm.referee}
  </div>
  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
    <span>{t('referral.history.bet_amount')}: {comm.betAmount} USDT</span>
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        comm.status === 'settled'
          ? 'bg-success/15 text-success'
          : 'bg-neutral-700 text-neutral-300'
      }`}
    >
      {t(`referral.tab.${comm.status}`)}
    </span>
  </div>
  <div className="text-sm text-neutral-500">{comm.timestamp}</div>
</div>
```

```tsx
<div className="text-right">
  <div className="text-lg font-bold text-success">+{comm.commission} USDT</div>
  <div className="text-sm text-neutral-500">Fee: {comm.fee} USDT</div>
</div>
```

- [ ] **Step 6: Run the focused referral page tests**

Run:

```bash
npm test -- "src/app/[locale]/referral/page.test.tsx" --runInBand
```

Expected:

```text
PASS src/app/[locale]/referral/page.test.tsx
```

- [ ] **Step 7: Commit the page implementation**

```bash
git add src/app/[locale]/referral/page.tsx src/app/[locale]/referral/page.test.tsx
git commit -m "fix: show direct referral bet and commission details"
```

## Task 3: Add The Minimal I18n Key For The New History Label

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`

- [ ] **Step 1: Add the new key to the `en`, `zh-TW`, and `zh-CN` referral blocks**

Insert this key next to the existing `referral.history.title` and `referral.history.empty` entries in the three main locale sections of `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`:

```ts
// en
'referral.history.bet_amount': 'Bet Amount',

// zh-TW
'referral.history.bet_amount': '投注金額',

// zh-CN
'referral.history.bet_amount': '投注金额',
```

- [ ] **Step 2: Mirror the same key into every remaining locale object that already defines `referral.history.title`**

For each additional locale block in `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`, add this exact fallback line near the other `referral.history.*` keys:

```ts
'referral.history.bet_amount': 'Bet Amount',
```

This keeps the dictionary shape consistent for the existing i18n validation tests without forcing a broader copy-writing pass.

- [ ] **Step 3: Run the i18n validation test**

Run:

```bash
npm test -- __tests__/i18n-validation.test.ts --runInBand
```

Expected:

```text
PASS __tests__/i18n-validation.test.ts
```

- [ ] **Step 4: Commit the translation update**

```bash
git add src/lib/i18n.ts
git commit -m "fix: add referral bet amount translation key"
```

## Task 4: Verify The Final Change Set And Clean Up Diagnostics

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`

- [ ] **Step 1: Run the focused referral tests together**

Run:

```bash
npm test -- "src/app/[locale]/referral/page.test.tsx" __tests__/i18n-validation.test.ts --runInBand
```

Expected:

```text
PASS src/app/[locale]/referral/page.test.tsx
PASS __tests__/i18n-validation.test.ts
```

- [ ] **Step 2: Check IDE diagnostics on every edited file**

Inspect diagnostics for:

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`

Expected:

```text
No new TypeScript or lint errors introduced by the change set
```

- [ ] **Step 3: Manually verify the referral page against live-like data**

Open the referral page for an address that already has commission rows and confirm:

```text
1. Each visible history row shows a bet amount line
2. Pending and settled rows still respond to the existing tabs
3. Withdrawal entries do not appear in the normal commission history list
4. The referee table shows non-zero volume and earned commission when ledger rows exist
5. Withdrawable values remain unchanged from the pre-fix behavior
```

- [ ] **Step 4: Commit the final verified state**

```bash
git add src/app/[locale]/referral/page.tsx src/app/[locale]/referral/page.test.tsx src/lib/i18n.ts
git commit -m "fix: improve referral commission visibility"
```

## Self-Review

Spec coverage check:

- Direct-referral bet details in history rows: covered by Task 1 and Task 2.
- Preserve existing `全部 / 已結算 / 待結算` and time filters: covered by Task 2.
- Exclude withdrawal records from the normal history list: covered by Task 1 and Task 2.
- Keep withdrawable settled-only: covered by leaving `route.ts` unchanged and by final manual verification in Task 4.
- Derive fallback referral aggregates from the ledger: covered by Task 1 and Task 2.
- Minimal i18n additions: covered by Task 3.

Placeholder scan:

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes exact file paths, concrete code snippets, explicit commands, and expected outcomes.

Type consistency:

- `parseNumericValue()` is used for both stats parsing and ledger-derived fallback totals.
- `visibleCommissions`, `refereeLedgerTotals`, and `allReferees` use the same commission fields already returned by `/api/referral`.
- The new UI label uses the single i18n key `referral.history.bet_amount` consistently in tests and implementation.
