/**
 * @jest-environment node
 */

import fs from 'fs';
import { POST } from './route';
import { getNetPayoutFromLockedOdds } from '@/lib/bet-mode';
import { flushMarketDbCache } from '@/lib/marketDb';

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

function mockDatabases({
  betsDb = {},
  marketDb,
}: {
  betsDb?: Record<string, unknown>;
  marketDb?: Record<string, unknown>;
}) {
  flushMarketDbCache();
  (fs.readFileSync as jest.Mock).mockImplementation((file: string) => {
    if (String(file).includes('bets_db.json')) {
      return JSON.stringify(betsDb);
    }
    if (String(file).includes('market_db.json')) {
      return JSON.stringify(
        marketDb ?? {
          '101': {
            realTotalPool: 250,
            liabilities: { home: 0, draw: 0, away: 0 },
            pools: { home: 100, draw: 80, away: 70 },
            initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
            attractionWindowUsed: { home: 0, draw: 0, away: 0 },
          },
          '202': {
            realTotalPool: 100,
            liabilities: { home: 0, draw: 0, away: 0 },
            pools: { home: 100, draw: 0, away: 0 },
            initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
            attractionWindowUsed: { home: 0, draw: 0, away: 0 },
          },
        }
      );
    }
    return '{}';
  });
}

describe('bets POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    flushMarketDbCache();
    mockDatabases({});
  });

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

  it('uses stored locked odds as the only payout basis for trial-funds wins', () => {
    expect(getNetPayoutFromLockedOdds(20, 2.15, true)).toBeCloseTo(43, 6);
  });

  it('locks initial odds while the market is still single-sided', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'single-side-user',
        matchId: 202,
        matchName: 'Single vs Side',
        outcome: 'home',
        amount: 5,
        odds: 1.88,
        useBonus: false,
        timestamp: 1234567891,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.odds).toBe(1.88);
  });

  it('locks the same initial odds for trial-funds first bets in a single-sided market', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'single-side-trial-user',
        matchId: 202,
        matchName: 'Single vs Side',
        outcome: 'home',
        amount: 5,
        odds: 1.88,
        useBonus: true,
        timestamp: 12345678915,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.useBonus).toBe(true);
    expect(json.data.odds).toBe(1.88);
    expect(json.data.netPayout).toBe(9.4);
  });

  it('accepts a trial-funds bet when cumulative match usage stays within the 15% cap', async () => {
    mockDatabases({
      betsDb: {
        'existing-trial-user': [
          {
            id: 'bet-existing-1',
            userAddress: 'existing-trial-user',
            matchId: 101,
            matchName: 'A vs B',
            outcome: 'draw',
            amount: 30,
            odds: 3.4,
            netPayout: 102,
            status: 'pending',
            useBonus: true,
            timestamp: 1234567000,
          },
        ],
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-under-cap',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 7,
        odds: 2.15,
        useBonus: true,
        timestamp: 1234567895,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.useBonus).toBe(true);
  });

  it('rejects a trial-funds bet when cumulative match usage exceeds the 15% cap', async () => {
    mockDatabases({
      betsDb: {
        'existing-trial-user': [
          {
            id: 'bet-existing-1',
            userAddress: 'existing-trial-user',
            matchId: 101,
            matchName: 'A vs B',
            outcome: 'draw',
            amount: 30,
            odds: 3.4,
            netPayout: 102,
            status: 'pending',
            useBonus: true,
            timestamp: 1234567000,
          },
        ],
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-over-cap',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 8,
        odds: 2.15,
        useBonus: true,
        timestamp: 1234567896,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe('risk_trial_funds_cap');
    expect(json.trialFundsCap).toBe(37.5);
    expect(json.trialFundsUsed).toBe(30);
    expect(json.trialFundsRemaining).toBe(7.5);
    expect(json.error).toContain('體驗金超出單場上限');
  });

  it('does not apply the trial-funds cap to real-money bets', async () => {
    mockDatabases({
      betsDb: {
        'existing-trial-user': [
          {
            id: 'bet-existing-1',
            userAddress: 'existing-trial-user',
            matchId: 101,
            matchName: 'A vs B',
            outcome: 'draw',
            amount: 30,
            odds: 3.4,
            netPayout: 102,
            status: 'pending',
            useBonus: true,
            timestamp: 1234567000,
          },
        ],
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'real-money-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'home',
        amount: 8,
        odds: 2.15,
        useBonus: false,
        timestamp: 1234567897,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.useBonus).toBe(false);
  });

  it('rejects a trial-funds bet when it would become the first bet in an empty match pool', async () => {
    mockDatabases({
      marketDb: {
        '303': {
          realTotalPool: 0,
          liabilities: { home: 0, draw: 0, away: 0 },
          pools: { home: 0, draw: 0, away: 0 },
          initialOdds: { home: 2.1, draw: 3.2, away: 3.6 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user-zero-pool',
        matchId: 303,
        matchName: 'Zero Pool Match',
        outcome: 'home',
        amount: 1,
        odds: 2.1,
        useBonus: true,
        timestamp: 1234567898,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe('risk_trial_funds_first_bet_blocked');
    expect(json.error).toContain('體驗金不可作為該場賭池首注');
  });

  it('allows a real-money bet to open an empty match pool', async () => {
    mockDatabases({
      marketDb: {
        '303': {
          realTotalPool: 0,
          liabilities: { home: 0, draw: 0, away: 0 },
          pools: { home: 0, draw: 0, away: 0 },
          initialOdds: { home: 2.1, draw: 3.2, away: 3.6 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      },
    });

    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'real-user-zero-pool',
        matchId: 303,
        matchName: 'Zero Pool Match',
        outcome: 'home',
        amount: 1,
        odds: 2.1,
        useBonus: false,
        timestamp: 1234567899,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.useBonus).toBe(false);
  });

  it('persists attraction-window usage for early cold underdog bets', async () => {
    const req = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'away',
        amount: 5,
        odds: 15,
        useBonus: true,
        timestamp: 1234567892,
        liveMinute: 12,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.odds).toBe(15);
    expect(json.data.netPayout).toBe(75);

    const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls;
    const marketWrite = writeCalls.find(([filePath]) =>
      String(filePath).includes('market_db.json')
    );
    const savedMarketDb = JSON.parse(String(marketWrite?.[1] || '{}'));

    expect(savedMarketDb['101'].attractionWindowUsed.away).toBe(5);
  });

  it('does not reset attraction-window pricing by splitting small orders', async () => {
    const requestA = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'away',
        amount: 8,
        odds: 15,
        useBonus: false,
        timestamp: 1234567893,
      }),
    });

    await POST(requestA);

    const requestB = new Request('http://localhost/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: 'trial-user',
        matchId: 101,
        matchName: 'A vs B',
        outcome: 'away',
        amount: 4,
        odds: 12,
        useBonus: false,
        timestamp: 1234567894,
      }),
    });

    await POST(requestB);

    const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls;
    const marketWrites = writeCalls.filter(([filePath]) =>
      String(filePath).includes('market_db.json')
    );
    const lastMarketWrite = marketWrites[marketWrites.length - 1];
    const savedMarketDb = JSON.parse(String(lastMarketWrite?.[1] || '{}'));

    expect(savedMarketDb['101'].attractionWindowUsed.away).toBe(10);
  });
});
