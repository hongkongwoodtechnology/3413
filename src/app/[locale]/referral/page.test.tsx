/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
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
        'referral.history.bet_amount': '投注金额',
        'referral.tab.all': '全部',
        'referral.tab.settled': '已结算',
        'referral.tab.pending': '待结算',
        'referral.tab.approved': '待打款',
        'referral.status.pending': '待对账',
        'referral.status.approved': '待打款',
        'referral.status.settled': '已结算',
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

global.fetch = jest.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/api/referral?address=')) {
    return {
      ok: true,
      json: async () => ({
        data: buildReferralPayload(),
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
      expect(screen.getAllByText('累计佣金').length).toBeGreaterThan(1);
    });

    expect(screen.getAllByText('累计佣金').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.382080 USDT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('可提现佣金').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.000000 USDT').length).toBeGreaterThan(0);
    expect(screen.getByText('佣金已入账，但佣金钱包余额不足，暂不可提')).toBeInTheDocument();
  });

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
      expect(screen.getAllByText('可提现佣金').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('佣金已入账，但佣金钱包余额不足，暂不可提')).not.toBeInTheDocument();
  });

  it('does not show the reserve warning when withdrawable commission is positive', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: buildReferralPayload({
          stats: {
            total: '0.382080 USDT',
            withdrawable: '0.120000 USDT',
            month: '0.382080 USDT',
            friends: 1,
          },
        }),
      }),
    });

    render(<ReferralPage />);

    await waitFor(() => {
      expect(screen.getAllByText('可提现佣金').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('佣金已入账，但佣金钱包余额不足，暂不可提')).not.toBeInTheDocument();
  });

  it('shows bet amount and status in commission rows while hiding withdrawal ledger rows', async () => {
    render(<ReferralPage />);

    await waitFor(() => {
      expect(screen.getByText('投注金额: 5.000000 USDT')).toBeInTheDocument();
    });

    expect(screen.getAllByText('待结算').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已结算').length).toBeGreaterThan(0);
    expect(screen.getByText('+0.120000 USDT')).toBeInTheDocument();
    expect(screen.queryByText('-0.050000 USDT')).not.toBeInTheDocument();
    expect(screen.queryByText('WITHDRAWAL')).not.toBeInTheDocument();
  });

  it('derives referee volume and commission from commission ledger rows when stored aggregates are zero', async () => {
    render(<ReferralPage />);

    await waitFor(() => {
      expect(screen.getByText('7.00 USDT')).toBeInTheDocument();
    });

    expect(screen.getByText('+0.17 USDT')).toBeInTheDocument();
  });

  it('shows approved commissions as withdrawable and renders the approved status label', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: buildReferralPayload({
          stats: {
            total: '0.250000 USDT',
            withdrawable: '0.080000 USDT',
            month: '0.250000 USDT',
            friends: 1,
          },
          commissions: [
            {
              id: 'comm-approved-1',
              referee: 'ApprovedReferee111111111111111111111111',
              betAmount: '5.000000',
              fee: '0.400000',
              commission: '0.080000',
              timestamp: '2026-05-16T08:00:00.000Z',
              status: 'approved',
            },
          ],
          referees: [
            {
              id: 'ref-approved-1',
              address: 'ApprovedReferee111111111111111111111111',
              joinDateValue: 0,
              totalVolumeValue: 0,
              earnedCommissionValue: 0,
            },
          ],
        }),
      }),
    });

    render(<ReferralPage />);

    await waitFor(() => {
      expect(screen.getByText('待打款')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '待打款' })).toBeInTheDocument();
    expect(screen.getAllByText('0.080000 USDT').length).toBeGreaterThan(0);
    expect(screen.getByText('投注金额: 5.000000 USDT')).toBeInTheDocument();
  });
});
