import { calculateReferralStats } from './referral-stats';

describe('calculateReferralStats', () => {
  it('counts only approved commission toward total, month, and withdrawable', () => {
    const now = Date.parse('2026-05-16T12:00:00.000Z');

    const stats = calculateReferralStats({
      commissions: [
        {
          referee: 'ref-pending',
          commission: '0.120000',
          timestamp: '2026-05-16T08:00:00.000Z',
          status: 'pending',
        },
        {
          referee: 'ref-approved',
          commission: '0.080000',
          timestamp: '2026-05-16T09:00:00.000Z',
          status: 'approved',
        },
        {
          referee: 'ref-settled',
          commission: '0.050000',
          timestamp: '2026-05-16T10:00:00.000Z',
          status: 'settled',
        },
        {
          referee: 'WITHDRAWAL',
          commission: '-0.030000',
          timestamp: '2026-05-16T11:00:00.000Z',
          status: 'settled',
        },
      ],
      now,
    });

    expect(stats.total).toBe('0.080000 USDT');
    expect(stats.month).toBe('0.080000 USDT');
    expect(stats.withdrawable).toBe('0.050000 USDT');
  });
});
