import { getRevenueReferrerDisplay } from './revenue-display';

describe('getRevenueReferrerDisplay', () => {
  it('maps the platform system key to a human-readable label', () => {
    expect(getRevenueReferrerDisplay('__platform__')).toBe('平台直收');
  });

  it('returns wallet addresses unchanged for regular referrers', () => {
    expect(getRevenueReferrerDisplay('FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf')).toBe(
      'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf'
    );
  });
});
