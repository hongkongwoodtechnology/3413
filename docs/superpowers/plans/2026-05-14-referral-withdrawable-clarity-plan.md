# Referral Withdrawable Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the referral withdrawal card clearly distinguish `累计佣金` from `可提现佣金`, and show a reserve-insufficient explanation when total commission exists but withdrawable commission is zero.

**Architecture:** Keep the existing `/api/referral` response and withdrawal behavior unchanged. Implement the fix entirely in the referral page by deriving a local `showReserveWarning` boolean from `stats.total` and `stats.withdrawable`, then add the required i18n keys so the UI can render the dual-value block and the warning text consistently.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Jest with `ts-jest`, Testing Library, existing `useLanguage` / wallet hooks

---

## File Map

- Create: `src/app/[locale]/referral/page.test.tsx`
  - Focused UI test for the withdrawal card state: dual values plus reserve warning visibility.
- Modify: `src/app/[locale]/referral/page.tsx`
  - Add local parsing helpers, compute the reserve-warning condition, render `累计佣金` above `可提现佣金`, and insert the warning text in the withdrawal card without changing the withdrawal action.
- Modify: `src/lib/i18n.ts`
  - Add `referral.withdraw.total_label` and `referral.withdraw.reserve_insufficient` for `zh-CN` and `zh-TW`, plus safe English fallbacks to avoid missing-key regressions in tests and default rendering.

### Task 1: Add a focused referral page rendering test

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ReferralPage from './page';

jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: true,
    publicKey: { toBase58: () => 'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf' },
  }),
}));

jest.mock('@/components/LanguageProvider', () => ({
  useLanguage: () => ({
    language: 'zh-CN',
    t: (key: string) => {
      const dict: Record<string, string> = {
        'referral.withdraw.title': '提现佣金',
        'referral.withdraw.amount': '提现金额',
        'referral.withdraw.address': '接收地址',
        'referral.withdraw.rate_label': '佣金比例',
        'referral.withdraw.rate_desc': '这是此介绍人当前可获得的佣金百分比。',
        'referral.withdraw.btn': '确认提现',
        'referral.withdraw.success': '提现成功！',
        'referral.withdraw.total_label': '累计佣金',
        'referral.withdraw.reserve_insufficient': '佣金已入账，但佣金钱包余额不足，暂不可提',
        'referral.stat.withdrawable': '可提现佣金',
        'referral.title': '邀请好友赚佣金',
        'referral.subtitle': '邀请好友加入，永久获得其交易手续费的 30% 作为奖励！',
        'referral.stat.total': '累计佣金',
        'referral.stat.month': '本月佣金',
        'referral.stat.friends': '成功邀请人数',
        'referral.history.title': '近期佣金动态',
        'referral.history.empty': '暂无佣金，快邀请好友一起预测吧！',
        'referral.tab.all': '全部',
        'referral.tab.settled': '已结算',
        'referral.tab.pending': '待结算',
        'referral.page.bonus_balance': '体验金余额',
        'referral.page.processing': '处理中...',
        'btn.close': '返回',
      };
      return dict[key] || key;
    },
  }),
}));

jest.mock('@/components/WalletButton', () => ({
  WalletButton: () => <button>Wallet</button>,
}));

jest.mock('@/components/LocalizedLink', () => ({
  LocalizedLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

global.fetch = jest.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/api/referral?address=')) {
    return {
      ok: true,
      json: async () => ({
        data: {
          stats: {
            total: '0.382080 USDT',
            withdrawable: '0.000000 USDT',
            month: '0.382080 USDT',
            friends: 1,
          },
          commissions: [],
          referees: [],
          balances: { usdt: 0, bonus: 0 },
          commissionRate: 0.3,
        },
      }),
    } as Response;
  }
  throw new Error(`Unexpected fetch: ${url}`);
}) as jest.Mock;

describe('ReferralPage withdraw card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows total commission, withdrawable commission, and reserve warning when withdrawable is zero', async () => {
    render(<ReferralPage />);

    await waitFor(() => {
      expect(screen.getByText('累计佣金')).toBeInTheDocument();
    });

    expect(screen.getAllByText('累计佣金').length).toBeGreaterThan(0);
    expect(screen.getByText('0.382080 USDT')).toBeInTheDocument();
    expect(screen.getByText('可提现佣金')).toBeInTheDocument();
    expect(screen.getByText('0.000000 USDT')).toBeInTheDocument();
    expect(screen.getByText('佣金已入账，但佣金钱包余额不足，暂不可提')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx jest src/app/[locale]/referral/page.test.tsx --runInBand
```

Expected: FAIL because the current withdrawal card does not yet render `referral.withdraw.total_label` or the reserve-insufficient warning text.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/[locale]/referral/page.tsx
const stats = referralData?.stats || {
  total: "0 USDT",
  withdrawable: "0 USDT",
  month: "0 USDT",
  friends: 0
};

const parseUsdtDisplay = (value: string) => {
  const normalized = String(value || '').replace('USDT', '').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const totalCommissionValue = parseUsdtDisplay(stats.total);
const withdrawableCommissionValue = parseUsdtDisplay(stats.withdrawable);
const showReserveWarning = totalCommissionValue > 0 && withdrawableCommissionValue === 0;
```

```tsx
// src/app/[locale]/referral/page.tsx
<div className="space-y-4">
  <div className="rounded-2xl border border-neutral-700/60 bg-neutral-950/40 p-4 space-y-2">
    <div className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
      {t('referral.withdraw.total_label')}
    </div>
    <div className="text-2xl font-bold text-white tracking-tight">
      {stats.total}
    </div>
  </div>

  <div className="rounded-2xl border border-neutral-700/60 bg-neutral-950/40 p-4 space-y-2">
    <div className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
      {t('referral.stat.withdrawable')}
    </div>
    <div className="text-3xl font-bold text-white tracking-tight">
      {stats.withdrawable}
    </div>
    {showReserveWarning ? (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        {t('referral.withdraw.reserve_insufficient')}
      </div>
    ) : null}
  </div>
</div>
```

```ts
// src/lib/i18n.ts
'referral.withdraw.total_label': 'Total Commission',
'referral.withdraw.reserve_insufficient': 'Commission has been recorded, but the commission wallet balance is currently insufficient for withdrawal.',
```

```ts
// src/lib/i18n.ts (zh-TW)
'referral.withdraw.total_label': '累計佣金',
'referral.withdraw.reserve_insufficient': '佣金已入帳，但佣金錢包餘額不足，暫不可提',
```

```ts
// src/lib/i18n.ts (zh-CN)
'referral.withdraw.total_label': '累计佣金',
'referral.withdraw.reserve_insufficient': '佣金已入账，但佣金钱包余额不足，暂不可提',
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx jest src/app/[locale]/referral/page.test.tsx --runInBand
```

Expected: PASS with the new labels and reserve warning rendered.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/referral/page.test.tsx src/app/[locale]/referral/page.tsx src/lib/i18n.ts
git commit -m "feat: clarify referral withdrawable commission state"
```

### Task 2: Verify the updated withdrawal card does not break existing behavior

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.tsx`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\referral\page.test.tsx`

- [ ] **Step 1: Extend the test with non-warning scenarios**

```tsx
it('does not show the reserve warning when both total and withdrawable are zero', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: {
        stats: {
          total: '0.000000 USDT',
          withdrawable: '0.000000 USDT',
          month: '0.000000 USDT',
          friends: 0,
        },
        commissions: [],
        referees: [],
        balances: { usdt: 0, bonus: 0 },
        commissionRate: 0.3,
      },
    }),
  });

  render(<ReferralPage />);

  await waitFor(() => {
    expect(screen.getByText('可提现佣金')).toBeInTheDocument();
  });

  expect(screen.queryByText('佣金已入账，但佣金钱包余额不足，暂不可提')).not.toBeInTheDocument();
});

it('does not show the reserve warning when withdrawable commission is positive', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: {
        stats: {
          total: '0.382080 USDT',
          withdrawable: '0.120000 USDT',
          month: '0.382080 USDT',
          friends: 1,
        },
        commissions: [],
        referees: [],
        balances: { usdt: 0, bonus: 0 },
        commissionRate: 0.3,
      },
    }),
  });

  render(<ReferralPage />);

  await waitFor(() => {
    expect(screen.getByText('可提现佣金')).toBeInTheDocument();
  });

  expect(screen.queryByText('佣金已入账，但佣金钱包余额不足，暂不可提')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx jest src/app/[locale]/referral/page.test.tsx --runInBand
```

Expected: FAIL until the page logic cleanly suppresses the warning for both zero-total and positive-withdrawable states.

- [ ] **Step 3: Refine the page logic only if needed**

```tsx
const parseUsdtDisplay = (value: string) => {
  const normalized = String(value || '').replace('USDT', '').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const totalCommissionValue = parseUsdtDisplay(stats.total);
const withdrawableCommissionValue = parseUsdtDisplay(stats.withdrawable);
const showReserveWarning =
  totalCommissionValue > 0 &&
  withdrawableCommissionValue === 0;
```

If this logic is already present and correct from Task 1, keep the implementation unchanged and only retain the expanded tests.

- [ ] **Step 4: Run the focused test suite and diagnostics**

Run:

```bash
npx jest src/app/[locale]/referral/page.test.tsx --runInBand
```

Expected: PASS

Run:

```bash
npx tsc --noEmit
```

Expected: existing project type errors may remain elsewhere, but no new errors should be introduced from `src/app/[locale]/referral/page.tsx` or `src/app/[locale]/referral/page.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/referral/page.test.tsx src/app/[locale]/referral/page.tsx src/lib/i18n.ts
git commit -m "test: cover referral withdrawable reserve warning states"
```
