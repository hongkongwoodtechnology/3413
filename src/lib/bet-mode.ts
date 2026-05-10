import { PLATFORM_FEE_RATE } from './wallets';

export const TRIAL_FUNDS_WINNER_FEE_RATE = 0.08;
export const REAL_MONEY_RETURN_RATE = 1 - PLATFORM_FEE_RATE;
export const TRIAL_FUNDS_RETURN_RATE = 1 - TRIAL_FUNDS_WINNER_FEE_RATE;

export function getReturnRateForBetMode(useBonus: boolean): number {
  return useBonus ? TRIAL_FUNDS_RETURN_RATE : REAL_MONEY_RETURN_RATE;
}

export function getNetPayoutFromLockedOdds(amount: number, lockedOdds: number, _useBonus: boolean): number {
  return Math.round(amount * lockedOdds * 1e6) / 1e6;
}
