/**
 * @jest-environment node
 */

process.env.NEXT_PUBLIC_HOUSE_WALLET = process.env.NEXT_PUBLIC_HOUSE_WALLET || '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2';
process.env.ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || process.env.NEXT_PUBLIC_HOUSE_WALLET;
process.env.NEXT_PUBLIC_POOL_WALLET = process.env.NEXT_PUBLIC_POOL_WALLET || '9FfHYyK8ZKsA82BPtierU4sWmwTS8QTGqrGqtTt6tEu7';

import { Connection, PublicKey } from '@solana/web3.js';

class MockRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  private body?: string;

  constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
    this.url = url;
    this.method = init?.method ?? 'GET';
    this.headers = init?.headers ?? {};
    this.body = init?.body;
  }

  async json() {
    return this.body ? JSON.parse(this.body) : {};
  }
}

let mockReferralDb = '{}';
let mockBetsDb = '{}';
const mockGetAssociatedTokenAddress = jest.fn(async (_mint: unknown, owner: { toBase58: () => string }) => ({
  toBase58: () => `ata-${owner.toBase58()}`,
}));

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn((filePath: string) => {
      const normalized = String(filePath).replace(/\\/g, '/');
      if (normalized.endsWith('/data/referral_db.json')) {
        return mockReferralDb;
      }
      if (normalized.endsWith('/data/bets_db.json')) {
        return mockBetsDb;
      }
      return '{}';
    }),
    writeFileSync: jest.fn((filePath: string, data: string) => {
      const normalized = String(filePath).replace(/\\/g, '/');
      if (normalized.endsWith('/data/referral_db.json')) {
        mockReferralDb = data;
      }
      if (normalized.endsWith('/data/bets_db.json')) {
        mockBetsDb = data;
      }
    }),
  },
}));

jest.mock('@/lib/gdriveBackup', () => ({
  triggerAutoBackup: jest.fn(),
}));

jest.mock('@/lib/security/auth', () => ({
  getAdminAddresses: jest.fn(() => [
    '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2',
    '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K',
  ]),
}));

jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: (...args: unknown[]) => mockGetAssociatedTokenAddress(...args),
}));

const mockSendUsdtCommission = jest.fn();

jest.mock('@/lib/solana-transfer', () => ({
  sendUsdtCommission: (...args: unknown[]) => mockSendUsdtCommission(...args),
}));

Object.assign(globalThis, {
  Request: MockRequest,
});

const { GET, POST } = require('./route');

const CURRENT_ADMIN_ADDRESS = '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2';
const RETIRED_ADMIN_ADDRESS = '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K';

function mockVerifiedSplitTransfer(params: {
  userAddress: string;
  poolAmount: number;
  houseAmount: number;
  commissionAmount: number;
}) {
  const poolDestination = 'ata-9FfHYyK8ZKsA82BPtierU4sWmwTS8QTGqrGqtTt6tEu7';
  const feeDestination = `ata-${CURRENT_ADMIN_ADDRESS}`;

  return jest.spyOn(Connection.prototype, 'getParsedTransaction').mockResolvedValue({
    meta: {
      err: null,
      innerInstructions: [],
    },
    transaction: {
      message: {
        accountKeys: [{ pubkey: new PublicKey(params.userAddress), signer: true }],
        instructions: [
          {
            program: 'spl-token',
            parsed: {
              type: 'transfer',
              info: {
                destination: poolDestination,
                amount: String(Math.round(params.poolAmount * 1_000_000)),
              },
            },
          },
          {
            program: 'spl-token',
            parsed: {
              type: 'transfer',
              info: {
                destination: feeDestination,
                amount: String(Math.round((params.houseAmount + params.commissionAmount) * 1_000_000)),
              },
            },
          },
        ],
      },
    },
  } as any);
}

describe('Referral API', () => {
  beforeEach(() => {
    mockReferralDb = '{}';
    mockBetsDb = '{}';
    jest.restoreAllMocks();
    delete process.env.ADMIN_WALLET_ADDRESS;
    delete process.env.NEXT_PUBLIC_HOUSE_WALLET;
  });

  it('should return 400 if address is not provided in GET request', async () => {
    const req = new Request('http://localhost:3000/api/referral');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Address is required');
  });

  it('should return default data for a new address', async () => {
    const testAddress = '0xTest123';
    const req = new Request(`http://localhost:3000/api/referral?address=${testAddress}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data).toBeDefined();
    expect(json.data.stats).toBeDefined();
    expect(json.data.commissions).toBeDefined();
    expect(json.data.referees).toBeDefined();
    expect(json.data.balances).toBeDefined();
    expect(json.data.stats.friends).toBe(0);
    expect(json.data.commissions.length).toBe(0);
    expect(json.data.referees.length).toBe(0);
    expect(json.data.balances.bonus).toBe(0);
  });

  it('should add a new referee via POST request', async () => {
    const testAddress = '0xTest123';
    const newRefereeAddress = '0xNewUser456';

    const req = new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: testAddress, newRefereeAddress }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.stats.friends).toBe(1);
    expect(json.data.referees.length).toBe(1);
    expect(json.data.referees[0].address).toBe(newRefereeAddress);
    expect(json.data.referees[0].joinDateValue).toBe(0);
    expect(json.data.referees[0].rewardIssued).toBe(false);
  });

  it('should issue 100U bonus when referee volume reaches 1000U', async () => {
    const referrer = 'AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq';
    const referee = 'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf';

    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: referrer, newRefereeAddress: referee }),
      })
    );

    mockVerifiedSplitTransfer({
      userAddress: referee,
      poolAmount: 460,
      houseAmount: 28,
      commissionAmount: 12,
    });
    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bet',
          userAddress: referee,
          referrerAddress: referrer,
          betAmount: 500,
          signature: 'bonus-bet-1',
        }),
      })
    );

    let res = await GET(new Request(`http://localhost:3000/api/referral?address=${referee}`));
    let json = await res.json();
    expect(json.data.balances.bonus).toBe(0);

    mockVerifiedSplitTransfer({
      userAddress: referee,
      poolAmount: 552,
      houseAmount: 33.6,
      commissionAmount: 14.4,
    });
    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bet',
          userAddress: referee,
          referrerAddress: referrer,
          betAmount: 600,
          signature: 'bonus-bet-2',
        }),
      })
    );

    res = await GET(new Request(`http://localhost:3000/api/referral?address=${referee}`));
    json = await res.json();
    expect(json.data.balances.bonus).toBe(100);

    res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
    json = await res.json();
    const refRecord = json.data.referees.find((r: any) => r.address === referee);
    expect(refRecord.totalVolumeValue).toBe(1100);
    expect(refRecord.rewardIssued).toBe(true);

    mockVerifiedSplitTransfer({
      userAddress: referee,
      poolAmount: 4.6,
      houseAmount: 0.28,
      commissionAmount: 0.12,
    });
    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bet',
          userAddress: referee,
          referrerAddress: referrer,
          betAmount: 5,
          signature: 'bonus-bet-3',
        }),
      })
    );

    res = await GET(new Request(`http://localhost:3000/api/referral?address=${referee}`));
    json = await res.json();
    expect(json.data.balances.bonus).toBe(100);
  });

  it('should NOT issue bonus if user has no referrer (independent account)', async () => {
    const independentUser = '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2';

    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bet',
          userAddress: independentUser,
          betAmount: 5,
          signature: 'independent-bet-1',
        }),
      })
    );

    const res = await GET(new Request(`http://localhost:3000/api/referral?address=${independentUser}`));
    const json = await res.json();
    expect(json.data.balances.bonus).toBe(0);
  });

  it('should return 400 if POST request misses parameters', async () => {
    const req = new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: '0xTest123' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing parameters');
  });

  it('creates pending commissions on place_bet and keeps them non-withdrawable before final settlement', async () => {
    mockVerifiedSplitTransfer({
      userAddress: 'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf',
      poolAmount: 4.6,
      houseAmount: 0.28,
      commissionAmount: 0.12,
    });

    const referrer = 'AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq';
    const referee = 'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf';

    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: referrer, newRefereeAddress: referee }),
      })
    );

    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bet',
          userAddress: referee,
          referrerAddress: referrer,
          betAmount: 5,
          poolAmount: 4.6,
          houseAmount: 0.28,
          commissionAmount: 0.12,
          signature: 'mock-signature-three-state',
        }),
      })
    );

    let res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
    let json = await res.json();
    expect(json.data.commissions[0].status).toBe('pending');
    expect(json.data.stats.withdrawable).toBe('0.000000 USDT');

    res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
    json = await res.json();
    expect(json.data.commissions[0].status).toBe('pending');
    expect(json.data.stats.total).toBe('0.000000 USDT');
    expect(json.data.stats.withdrawable).toBe('0.000000 USDT');
  });

  it('promotes pending commission to approved when the matching bet finishes as loss', async () => {
    const referrer = 'AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq';
    const referee = 'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf';

    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: referrer, newRefereeAddress: referee }),
      })
    );

    mockVerifiedSplitTransfer({
      userAddress: referee,
      poolAmount: 4.6,
      houseAmount: 0.28,
      commissionAmount: 0.12,
    });

    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bet',
          userAddress: referee,
          referrerAddress: referrer,
          betAmount: 5,
          poolAmount: 4.6,
          houseAmount: 0.28,
          commissionAmount: 0.12,
          signature: 'mock-signature-three-state',
        }),
      })
    );

    mockBetsDb = JSON.stringify({
      [referee]: [
        {
          id: 'bet-loss-1',
          userAddress: referee,
          matchId: 1001,
          matchName: 'A vs B',
          outcome: 'home',
          amount: 5,
          signature: 'mock-signature-three-state',
          status: 'loss',
          useBonus: false,
          timestamp: Date.now(),
        },
      ],
    });

    const reconcileRes = await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_commissions',
          userAddress: referrer,
        }),
      })
    );
    const reconcileJson = await reconcileRes.json();
    expect(reconcileJson.success).toBe(true);
    expect(reconcileJson.updated).toBe(1);

    res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
    json = await res.json();
    expect(json.data.commissions[0].status).toBe('approved');
    expect(json.data.stats.total).toBe('0.120000 USDT');
    expect(json.data.stats.withdrawable).toBe('0.120000 USDT');
  });

  it('accepts combined fee custody into the house wallet for new bets', async () => {
    const referrer = 'AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq';
    const referee = 'FhehP5xXeHrMSFZkti2vAXDm4ZJeqXNu3vARGCTV8pkf';

    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: referrer, newRefereeAddress: referee }),
      })
    );

    mockVerifiedSplitTransfer({
      userAddress: referee,
      poolAmount: 4.6,
      houseAmount: 0.28,
      commissionAmount: 0.12,
    });

    const res = await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bet',
          userAddress: referee,
          referrerAddress: referrer,
          betAmount: 5,
          poolAmount: 4.6,
          houseAmount: 0.28,
          commissionAmount: 0.12,
          signature: 'combined-fee-bet',
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('allows the current admin wallet to airdrop bonus', async () => {
    const req = new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'airdrop_bonus',
        adminAddress: CURRENT_ADMIN_ADDRESS,
        targetAddress: '0xBonusTarget',
        amount: 25,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.newBalance).toBe(25);
  });

  it('rejects a non-admin wallet for bonus airdrop', async () => {
    const req = new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'airdrop_bonus',
        adminAddress: 'NotAdmin1111111111111111111111111111111111',
        targetAddress: '0xBonusTarget2',
        amount: 10,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Unauthorized');
  });

  it('rejects the retired admin wallet even when stale config references it', async () => {
    process.env.ADMIN_WALLET_ADDRESS = RETIRED_ADMIN_ADDRESS;

    const req = new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'airdrop_bonus',
        adminAddress: RETIRED_ADMIN_ADDRESS,
        targetAddress: '0xLegacyTarget',
        amount: 5,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('Unauthorized');
  });

  it('allows the current admin wallet to fetch leaderboard', async () => {
    await POST(
      new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '0xLeaderReferrer',
          newRefereeAddress: '0xLeaderUser',
        }),
      })
    );

    const req = new Request('http://localhost:3000/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_leaderboard',
        adminAddress: CURRENT_ADMIN_ADDRESS,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  describe('withdraw_commission - 鏈上 SPL 轉帳', () => {
    const withdrawUser = 'AQDd735nBNxWxoeNAG7bUn2SA56fennrCYRR1Ykc4fyq';

    beforeEach(() => {
      mockSendUsdtCommission.mockReset();
      process.env.NEXT_PUBLIC_HOUSE_WALLET = '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2';
      process.env.ADMIN_WALLET_ADDRESS = '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2';
      process.env.ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || '5HfhiSp2Xg8oZXr82z8spJiVnLGVyueq3838JkFWXc9m1RT4TsfgfFDG1b6jGMbEL5XHWEyD1Trb7UX3KsfPKn1y';

      const db = JSON.parse(mockReferralDb);
      const userData = db[withdrawUser] || {
        stats: { total: '0.010560 USDT', withdrawable: '0.010560 USDT', month: '0.010560 USDT', friends: 1 },
        commissions: [],
        referees: [],
        balances: { usdt: 0, bonus: 0 },
      };
      userData.stats.total = '0.010560 USDT';
      userData.stats.withdrawable = '0.010560 USDT';
      db[withdrawUser] = userData;
      mockReferralDb = JSON.stringify(db);
    });

    it('calls sendUsdtCommission with correct params and returns the tx signature', async () => {
      mockSendUsdtCommission.mockResolvedValueOnce({
        success: true,
        signature: 'abc123-commission-tx',
      });

      const req = new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw_commission',
          userAddress: withdrawUser,
          amount: 0.010560,
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.signature).toBe('abc123-commission-tx');
      expect(mockSendUsdtCommission).toHaveBeenCalledTimes(1);

      const callArgs = mockSendUsdtCommission.mock.calls[0];
      expect(callArgs[1]).toBe(CURRENT_ADMIN_ADDRESS);
      expect(callArgs[2]).toBe(withdrawUser);
      expect(callArgs[3]).toBe(0.010560);
    });

    it('returns 502 with error when on-chain transfer fails', async () => {
      mockSendUsdtCommission.mockResolvedValueOnce({
        success: false,
        error: 'insufficient funds',
      });

      const req = new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw_commission',
          userAddress: withdrawUser,
          amount: 0.010560,
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(502);
      expect(json.success).toBe(false);
      expect(json.error).toContain('insufficient funds');
    });

    it('does not update DB when transfer fails', async () => {
      const dbBefore = JSON.parse(mockReferralDb);
      const withdrawableBefore = dbBefore[withdrawUser]?.stats?.withdrawable || '0.010560 USDT';

      mockSendUsdtCommission.mockResolvedValueOnce({
        success: false,
        error: 'network error',
      });

      await POST(new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw_commission',
          userAddress: withdrawUser,
          amount: 0.010560,
        }),
      }));

      const dbAfter = JSON.parse(mockReferralDb);
      expect(dbAfter[withdrawUser]?.stats?.withdrawable).toBe(withdrawableBefore);
    });

    it('updates withdrawable balance after successful transfer', async () => {
      mockSendUsdtCommission.mockResolvedValueOnce({
        success: true,
        signature: 'commission-transfer-tx',
      });

      await POST(new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw_commission',
          userAddress: withdrawUser,
          amount: 0.010560,
        }),
      }));

      const dbAfter = JSON.parse(mockReferralDb);
      expect(dbAfter[withdrawUser].stats.withdrawable).toBe('0.000000 USDT');
      expect(dbAfter[withdrawUser].commissions[0].referee).toBe('WITHDRAWAL');
      expect(dbAfter[withdrawUser].commissions[0].status).toBe('settled');
      expect(dbAfter[withdrawUser].commissions[0].settlementTx).toBe('commission-transfer-tx');
    });

    it('returns 400 when amount exceeds withdrawable', async () => {
      const req = new Request('http://localhost:3000/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw_commission',
          userAddress: withdrawUser,
          amount: 99,
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain('Insufficient');
      expect(mockSendUsdtCommission).not.toHaveBeenCalled();
    });
  });
});
