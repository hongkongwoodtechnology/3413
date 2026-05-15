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
      expect(screen.getAllByText('可提现佣金').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('佣金已入账，但佣金钱包余额不足，暂不可提')).not.toBeInTheDocument();
  });
});
