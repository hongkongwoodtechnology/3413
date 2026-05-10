import { DynamicOddsEngine } from './odds-engine';

describe('phase-aware odds engine', () => {
  it('uses initial odds during single-sided phase even for live matches', () => {
    const engine = new DynamicOddsEngine();
    const quote = engine.calculatePhaseAwareLockedOdds({
      pools: { home: 25, draw: 0, away: 0 },
      liabilities: { home: 0, draw: 0, away: 0 },
      selectedOutcome: 'home',
      betAmount: 5,
      initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
      attractionWindowUsed: { home: 0, draw: 0, away: 0 },
      score: '0-2',
      liveMinute: 67,
      status: 'live',
      returnRate: 0.92,
    });

    expect(quote?.odds).toBe(1.88);
    expect(quote?.riskLevel).toBe('refund_single_side');
  });

  it('caps early cold-underdog pricing by attraction-window and solvency rules', () => {
    const engine = new DynamicOddsEngine();
    const quote = engine.calculatePhaseAwareLockedOdds({
      pools: { home: 100, draw: 50, away: 0 },
      liabilities: { home: 0, draw: 0, away: 0 },
      selectedOutcome: 'away',
      betAmount: 5,
      initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
      attractionWindowUsed: { home: 0, draw: 0, away: 0 },
      score: null,
      liveMinute: undefined,
      status: 'upcoming',
      returnRate: 0.92,
    });

    expect(quote?.odds).toBeLessThanOrEqual(15);
    expect(quote?.odds).toBeGreaterThan(1.01);
  });
});
