export const MAX_LOCKED_ODDS = 15;

export function clampLockedOdds(odds: number | null | undefined): number {
  if (typeof odds !== 'number' || !Number.isFinite(odds)) {
    return 1;
  }

  if (odds <= 0) {
    return 1;
  }

  return Math.min(odds, MAX_LOCKED_ODDS);
}
