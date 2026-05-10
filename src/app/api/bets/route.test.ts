/**
 * @jest-environment node
 */

import { POST } from './route';

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn((file: string) => {
      if (String(file).includes('bets_db.json')) return '{}';
      if (String(file).includes('market_db.json')) {
        return JSON.stringify({
          '101': {
            realTotalPool: 250,
            liabilities: { home: 0, draw: 0, away: 0 },
            pools: { home: 100, draw: 80, away: 70 },
          },
        });
      }
      return '{}';
    }),
    writeFileSync: jest.fn(),
  },
}));

jest.mock('@/lib/gdriveBackup', () => ({ triggerAutoBackup: jest.fn() }));
jest.mock('@/lib/reserve', () => ({
  addToReserve: jest.fn(),
  loadReserve: jest.fn(() => ({ balance: 1000 })),
}));

describe('bets POST', () => {
  it('stores trial-funds bets with the submitted locked odds and net payout', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 20,
        odds: 2.15,
        useBonus: true,
        timestamp: 1234567890,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.useBonus).toBe(true);
    expect(json.data.odds).toBe(2.15);
    expect(json.data.netPayout).toBe(43);
  });
});
