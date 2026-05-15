/**
 * @jest-environment node
 */

import type { NextRequest } from 'next/server';

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn((filePath: string) => {
      const path = String(filePath);
      if (path.includes('livescore_cache.json')) {
        return JSON.stringify({
          savedAt: Date.now(),
          liveData: { Ts: Date.now(), Stages: [] },
          dateDataList: [],
        });
      }

      if (path.includes('worldcup_schedule_2026.json')) {
        return JSON.stringify([
          {
            id: 'wc-2026-group-a-001',
            home: 'Mexico',
            away: 'South Africa',
            league: 'World Cup 2026',
            category: 'worldcup',
            date: '2026-06-11 13:00',
            timestamp: 1781197200000,
            status: 'upcoming',
            score: '',
          },
        ]);
      }

      if (path.includes('bets_db.json')) {
        return '{}';
      }

      return '{}';
    }),
    writeFileSync: jest.fn(),
  },
}));

jest.mock('@/lib/marketDb', () => ({
  loadMarketDb: jest.fn(() => ({})),
  saveMarketDb: jest.fn(),
}));

jest.mock('@/lib/wallets', () => ({
  PLATFORM_FEE_RATE: 0.08,
}));

jest.mock('@/lib/translate', () => ({
  translateToZhTW: jest.fn(async (name: string) => ({ translated: name })),
}));

type ApiMatch = {
  id: string | number;
  category: string;
  home: string;
};

describe('/api/matches GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ Ts: Date.now(), Stages: [] }),
    })) as jest.Mock;
  });

  it('returns worldcup seed fixtures when the resolved feed has no worldcup matches', async () => {
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/matches?lang=en') as unknown as NextRequest);
    const json = (await response.json()) as ApiMatch[];

    expect(Array.isArray(json)).toBe(true);
    expect(json.some((match) => match.category === 'worldcup')).toBe(true);
    expect(json.find((match) => String(match.id) === 'wc-2026-group-a-001')?.home).toBe('Mexico');
  });
});
