/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MarketHealthPanel } from './MarketHealthPanel';
import { MarketList } from './MarketList';
import { MatchDetailTable } from './MatchDetailTable';

const matches = [
  { id: '1', teamA: 'A', teamB: 'B', status: 'live', totalPool: 1000, totalBets: 20, oddsA: '1.8', oddsB: '2.1' },
  { id: '2', teamA: 'C', teamB: 'D', status: 'live', totalPool: 800, totalBets: 12, oddsA: '1.5', oddsB: '2.8' },
];

describe('markets module blocks', () => {
  it('renders market health metrics', () => {
    render(<MarketHealthPanel totalPool={1800} liveMatches={2} topMatchShare={55.6} />);

    expect(screen.getByText('總市場池')).toBeInTheDocument();
    expect(screen.getByText('即時賽事')).toBeInTheDocument();
    expect(screen.getByText('集中度')).toBeInTheDocument();
  });

  it('renders market list cards', () => {
    render(<MarketList matches={matches} />);

    expect(screen.getByText('A vs B')).toBeInTheDocument();
    expect(screen.getByText('C vs D')).toBeInTheDocument();
  });

  it('renders match detail table', () => {
    render(<MatchDetailTable matches={matches} />);

    expect(screen.getByText('對戰')).toBeInTheDocument();
    expect(screen.getByText('投注池')).toBeInTheDocument();
    expect(screen.getByText('1.8')).toBeInTheDocument();
    expect(screen.getByText('2.8')).toBeInTheDocument();
  });
});
