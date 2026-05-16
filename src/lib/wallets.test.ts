import {
  splitBetAmount,
  formatMissingAtaInitializationMessage,
  getBoundReferrerStorageKey,
  getDestinationAtaTargets,
  resolvePreferredWalletAddress,
  stripLegacyAdminEntries,
  stripLegacyBetFields,
} from './wallets';

describe('wallet destination helpers', () => {
  it('returns pool, house and commission ATA targets', () => {
    const targets = getDestinationAtaTargets();
    expect(targets.map((t) => t.key)).toEqual(['pool', 'house', 'commission']);
  });

  it('includes missing ATA labels in the initialization error message', () => {
    const message = formatMissingAtaInitializationMessage(['平台佣金收款', '平台淨收益收款']);
    expect(message).toContain('平台尚未初始化收款帳戶');
    expect(message).toContain('平台佣金收款');
    expect(message).toContain('平台淨收益收款');
  });

  it('prefers the Phantom provider address when it differs from the app wallet address', () => {
    expect(
      resolvePreferredWalletAddress(
        'wallet-adapter-address',
        'phantom-provider-address'
      )
    ).toBe('phantom-provider-address');
  });

  it('falls back to the app wallet address when no Phantom override exists', () => {
    expect(resolvePreferredWalletAddress('wallet-adapter-address', null)).toBe(
      'wallet-adapter-address'
    );
  });

  it('builds the localStorage key for a resolved referral address', () => {
    expect(getBoundReferrerStorageKey('wallet-address')).toBe(
      'bound_referrer_wallet-address'
    );
  });

  it('trims surrounding whitespace from the referral storage key address', () => {
    expect(getBoundReferrerStorageKey('  wallet-address  ')).toBe(
      'bound_referrer_wallet-address'
    );
  });

  it('routes the full platform fee to house when there is no referrer', () => {
    const split = splitBetAmount(1, 0, 1);

    expect(split.pool).toBeCloseTo(0.92);
    expect(split.house).toBeCloseTo(0.08);
    expect(split.commission).toBeCloseTo(0);
    expect(split.support).toBeCloseTo(0);
    expect(split.platformFee).toBeCloseTo(0.08);
  });

  it('keeps pool separate while exposing house and commission components', () => {
    const split = splitBetAmount(0.04, 0.3);

    expect(split.pool).toBeCloseTo(0.0368, 6);
    expect(split.house).toBeCloseTo(0.00224, 6);
    expect(split.commission).toBeCloseTo(0.00096, 6);
    expect(split.platformFee).toBeCloseTo(0.0032, 6);
  });

  it('removes legacy admin address entries from referral-like data', () => {
    expect(
      stripLegacyAdminEntries({
        '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K': { balances: { usdt: 0, bonus: 0 } },
        '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2': { balances: { usdt: 1, bonus: 2 } },
        user123: { balances: { usdt: 3, bonus: 4 } },
      })
    ).toEqual({
      '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2': { balances: { usdt: 1, bonus: 2 } },
      user123: { balances: { usdt: 3, bonus: 4 } },
    });
  });

  it('removes legacy payout fields from bet records', () => {
    expect(
      stripLegacyBetFields({
        wallet123: [
          { id: 'bet-1', amount: 1, legacyPayout: true, userAddress: 'wallet123' },
          { id: 'bet-2', amount: 2, userAddress: 'wallet123' },
        ],
      })
    ).toEqual({
      wallet123: [
        { id: 'bet-1', amount: 1, userAddress: 'wallet123' },
        { id: 'bet-2', amount: 2, userAddress: 'wallet123' },
      ],
    });
  });
});
