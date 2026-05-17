import { splitBetAmount } from './wallets';

export type OutcomePools = {
  home: number;
  draw: number;
  away: number;
};

export function getProjectedPoolIncrement(params: {
  amount: number;
  useBonus: boolean;
  commissionRate: number;
  currentRealPool: number;
}): number {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return 0;
  }

  if (params.useBonus) {
    return params.amount;
  }

  const split = splitBetAmount(
    params.amount,
    params.commissionRate,
    params.currentRealPool
  );

  return Number.isFinite(split.pool) && split.pool > 0 ? split.pool : 0;
}

export function isInitialPoolState(pools: OutcomePools): boolean {
  const activeCount = [pools.home, pools.draw, pools.away].filter(
    (value) => value > 0
  ).length;

  return activeCount <= 1;
}
