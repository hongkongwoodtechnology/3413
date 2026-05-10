import {
  ATTRACTION_WINDOW_MAX_ODDS,
  ATTRACTION_WINDOW_SIZE,
  countActiveOutcomes,
  getAttractionWindowRemaining,
  getSingleSidedOutcome,
  isSingleSidedMarket,
  splitBetByAttractionWindow,
} from './market-rules';

describe('market rules helpers', () => {
  it('detects when the market is single-sided', () => {
    expect(countActiveOutcomes({ home: 5, draw: 0, away: 0 })).toBe(1);
    expect(isSingleSidedMarket({ home: 5, draw: 0, away: 0 })).toBe(true);
    expect(getSingleSidedOutcome({ home: 5, draw: 0, away: 0 })).toBe('home');
  });

  it('reports no single-sided outcome once two sides have funds', () => {
    expect(countActiveOutcomes({ home: 5, draw: 1, away: 0 })).toBe(2);
    expect(isSingleSidedMarket({ home: 5, draw: 1, away: 0 })).toBe(false);
    expect(getSingleSidedOutcome({ home: 5, draw: 1, away: 0 })).toBeNull();
  });

  it('tracks remaining attraction quota per outcome', () => {
    expect(ATTRACTION_WINDOW_SIZE).toBe(10);
    expect(ATTRACTION_WINDOW_MAX_ODDS).toBe(15);
    expect(
      getAttractionWindowRemaining({ home: 0, draw: 0, away: 8 }, 'away')
    ).toBe(2);
  });

  it('splits a bet between attraction-window and post-window portions', () => {
    expect(
      splitBetByAttractionWindow(6, { home: 0, draw: 0, away: 8 }, 'away')
    ).toEqual({ attractiveAmount: 2, regularAmount: 4 });
  });
});
