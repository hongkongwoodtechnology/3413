import { calculateReferralStats } from './referral-stats';

describe('calculateReferralStats', () => {
  it('includes pending commissions in total and month, while withdrawable only counts settled', () => {
    const now = Date.now();

    const stats = calculateReferralStats({
      commissions: [
        {
          referee: 'ref-1',
          commission: '0.120000',
          timestamp: new Date(now).toISOString(),
          status: 'pending',
        },
        {
          referee: 'ref-2',
          commission: '0.080000',
          timestamp: new Date(now).toISOString(),
          status: 'settled',
        },
        {
          referee: 'WITHDRAWAL',
          commission: '-0.030000',
          timestamp: new Date(now).toISOString(),
          status: 'settled',
        },
      ],
      now,
    });

    expect(stats.total).toBe('0.200000 USDT');
    expect(stats.month).toBe('0.200000 USDT');
    expect(stats.withdrawable).toBe('0.050000 USDT');
  });
});
