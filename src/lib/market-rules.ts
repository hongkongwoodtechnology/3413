export type OutcomeKey = 'home' | 'draw' | 'away';

export const ATTRACTION_WINDOW_SIZE = 10;
export const ATTRACTION_WINDOW_MAX_ODDS = 15.0;

export type OutcomePools = Record<OutcomeKey, number>;
export type AttractionWindowUsage = Record<OutcomeKey, number>;

export function countActiveOutcomes(pools: OutcomePools): number {
  return (['home', 'draw', 'away'] as OutcomeKey[]).filter(
    (key) => (pools[key] || 0) > 0
  ).length;
}

export function isSingleSidedMarket(pools: OutcomePools): boolean {
  return countActiveOutcomes(pools) === 1;
}

export function getSingleSidedOutcome(pools: OutcomePools): OutcomeKey | null {
  const active = (['home', 'draw', 'away'] as OutcomeKey[]).filter(
    (key) => (pools[key] || 0) > 0
  );

  return active.length === 1 ? active[0] : null;
}

export function getAttractionWindowRemaining(
  usage: AttractionWindowUsage,
  outcome: OutcomeKey
): number {
  return Math.max(0, ATTRACTION_WINDOW_SIZE - (usage[outcome] || 0));
}

export function splitBetByAttractionWindow(
  amount: number,
  usage: AttractionWindowUsage,
  outcome: OutcomeKey
): { attractiveAmount: number; regularAmount: number } {
  const attractiveAmount = Math.min(
    Math.max(0, amount),
    getAttractionWindowRemaining(usage, outcome)
  );

  return {
    attractiveAmount,
    regularAmount: Math.max(0, amount - attractiveAmount),
  };
}
