import {
  REAL_MONEY_RETURN_RATE,
  TRIAL_FUNDS_WINNER_FEE_RATE,
  TRIAL_FUNDS_RETURN_RATE,
  getReturnRateForBetMode,
  getNetPayoutFromLockedOdds,
} from './bet-mode';

describe('bet mode helpers', () => {
  it('uses the existing platform return rate for real-money bets', () => {
    expect(REAL_MONEY_RETURN_RATE).toBeCloseTo(0.92, 6);
    expect(getReturnRateForBetMode(false)).toBeCloseTo(0.92, 6);
  });

  it('uses the 8% winner-fee basis for trial-funds bets', () => {
    expect(TRIAL_FUNDS_WINNER_FEE_RATE).toBeCloseTo(0.08, 6);
    expect(TRIAL_FUNDS_RETURN_RATE).toBeCloseTo(0.92, 6);
    expect(getReturnRateForBetMode(true)).toBeCloseTo(0.92, 6);
  });

  it('settles from locked odds without a second deduction', () => {
    expect(getNetPayoutFromLockedOdds(25, 1.84, true)).toBeCloseTo(46, 6);
    expect(getNetPayoutFromLockedOdds(25, 1.84, false)).toBeCloseTo(46, 6);
  });
});
