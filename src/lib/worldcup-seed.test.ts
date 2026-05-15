/**
 * @jest-environment node
 */

import fs from 'fs';
import type { Match } from '@/lib/types';
import { applyWorldCupSeedFallback, loadWorldCupSeed } from './worldcup-seed';

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    readFileSync: jest.fn(),
  },
}));

describe('applyWorldCupSeedFallback', () => {
  const makeMatch = (overrides: Partial<Match> = {}): Match => ({
    id: 101,
    league: 'Premier League',
    category: 'england',
    home: 'Arsenal',
    away: 'Chelsea',
    date: '2026-05-20 20:00',
    timestamp: 1779307200000,
    pools: { home: 0, draw: 0, away: 0 },
    status: 'upcoming',
    score: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injects seed fixtures when no worldcup matches exist', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      {
        id: 'wc-2026-group-a-001',
        home: 'Mexico',
        away: 'Japan',
        league: 'World Cup 2026',
        category: 'worldcup',
        date: '2026-06-11 20:00',
        timestamp: 1781131200000,
        status: 'upcoming',
        score: '',
      },
    ]));

    const result = applyWorldCupSeedFallback([
      makeMatch(),
    ]);

    expect(result.some(match => match.category === 'worldcup')).toBe(true);
    expect(result.find(match => String(match.id) === 'wc-2026-group-a-001')?.home).toBe('Mexico');
  });

  it('does not inject seed fixtures when live worldcup matches already exist', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      {
        id: 'wc-2026-group-a-001',
        home: 'Mexico',
        away: 'Japan',
        league: 'World Cup 2026',
        category: 'worldcup',
        date: '2026-06-11 20:00',
        timestamp: 1781131200000,
        status: 'upcoming',
        score: '',
      },
    ]));

    const result = applyWorldCupSeedFallback([
      makeMatch({
        id: 202,
        league: 'World Cup Qualifiers',
        category: 'worldcup',
        home: 'Brazil',
        away: 'Argentina',
        date: '2026-06-01 20:00',
        timestamp: 1780344000000,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].home).toBe('Brazil');
  });

  it('skips malformed seed entries and keeps valid worldcup entries', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      {
        id: 'wc-2026-group-a-001',
        home: 'Mexico',
        away: 'Japan',
        league: 'World Cup 2026',
        category: 'worldcup',
        date: '2026-06-11 20:00',
        timestamp: 1781131200000,
        status: 'upcoming',
        score: '',
      },
      {
        id: 'broken-record',
        home: 'Broken Only',
      },
    ]));

    const result = applyWorldCupSeedFallback([]);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('worldcup');
    expect(result[0].away).toBe('Japan');
  });

  it('preserves worldcup category and reserved ids from the real seed file', () => {
    const realFs = jest.requireActual('fs') as typeof import('fs');
    (fs.readFileSync as jest.Mock).mockImplementation(realFs.readFileSync);

    const result = loadWorldCupSeed();

    expect(result.length).toBeGreaterThan(0);
    expect(String(result[0].id).startsWith('wc-2026-')).toBe(true);
    expect(result.every((match) => match.category === 'worldcup')).toBe(true);
  });
});
