/**
 * @jest-environment node
 */

process.env.NEXT_PUBLIC_POOL_WALLET = process.env.NEXT_PUBLIC_POOL_WALLET || "9FfHYyK8ZKsA82BPtierU4sWmwTS8QTGqrGqtTt6tEu7";
process.env.NEXT_PUBLIC_HOUSE_WALLET = process.env.NEXT_PUBLIC_HOUSE_WALLET || "3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2";
process.env.ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || process.env.NEXT_PUBLIC_HOUSE_WALLET;
process.env.NEXT_PUBLIC_COMMISSION_WALLET = process.env.NEXT_PUBLIC_COMMISSION_WALLET || "5S4yRQn6EHjq2CzvHrniE8vwXj7qbnMBr8E8mYh5AS4x";

const ADMIN_ADDRESS = "3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2";

type MockFileMap = Record<string, string>;

let mockFiles: MockFileMap = {};
let mockRpcSignatureStatuses: Array<{ err: unknown; confirmationStatus: string }> = [];

jest.mock("fs", () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn((filePath: string) => {
      const normalized = String(filePath).replace(/\\/g, "/");
      if (normalized.endsWith("/data/bets_db.json")) return mockFiles["bets_db.json"] ?? "{}";
      if (normalized.endsWith("/data/referral_db.json")) return mockFiles["referral_db.json"] ?? "{}";
      if (normalized.endsWith("/data/market_db.json")) return mockFiles["market_db.json"] ?? "{}";
      return "{}";
    }),
    writeFileSync: jest.fn((filePath: string, data: string) => {
      const normalized = String(filePath).replace(/\\/g, "/");
      if (normalized.endsWith("/data/bets_db.json")) mockFiles["bets_db.json"] = data;
      if (normalized.endsWith("/data/referral_db.json")) mockFiles["referral_db.json"] = data;
      if (normalized.endsWith("/data/market_db.json")) mockFiles["market_db.json"] = data;
    }),
  },
}));

jest.mock("https", () => {
  const { EventEmitter } = require("events");

  return {
    __esModule: true,
    default: {
      request: jest.fn((options: { hostname: string }, callback: (res: InstanceType<typeof EventEmitter> & { statusCode?: number }) => void) => {
        const req = new EventEmitter() as InstanceType<typeof EventEmitter> & {
          write: (chunk: string) => void;
          end: () => void;
          destroy: () => void;
        };

        let requestBody = "";

        req.write = (chunk: string) => {
          requestBody += chunk;
        };

        req.destroy = () => {};

        req.end = () => {
          const response = new EventEmitter() as InstanceType<typeof EventEmitter> & { statusCode?: number };
          response.statusCode = 200;
          callback(response);

          const parsedBody = JSON.parse(requestBody);
          const method = parsedBody.method;

          let result: unknown;

          if (method === "getLatestBlockhash") {
            result = { value: { blockhash: "mock-blockhash" } };
          } else if (method === "getTokenAccountBalance") {
            result = { value: { amount: "1000000000" } };
          } else if (method === "getAccountInfo") {
            result = { value: null };
          } else if (method === "sendTransaction") {
            result = "mock-signature";
          } else if (method === "getSignatureStatuses") {
            result = {
              value: [
                mockRpcSignatureStatuses.shift() ?? {
                  err: null,
                  confirmationStatus: "finalized",
                },
              ],
            };
          } else {
            throw new Error(`Unhandled RPC method in test: ${method} @ ${options.hostname}`);
          }

          response.emit("data", JSON.stringify({ jsonrpc: "2.0", id: parsedBody.id ?? 1, result }));
          response.emit("end");
        };

        return req;
      }),
    },
  };
});

jest.mock("@solana/web3.js", () => {
  class PublicKey {
    value: string;

    constructor(value: string) {
      this.value = value;
    }

    toBase58() {
      return this.value;
    }

    toBuffer() {
      return Buffer.from(this.value.padEnd(32, "1").slice(0, 32));
    }

    static findProgramAddressSync() {
      return [new PublicKey("MockAta1111111111111111111111111111111111")];
    }
  }

  class Keypair {
    publicKey: PublicKey;

    constructor() {
      this.publicKey = new PublicKey(ADMIN_ADDRESS);
    }

    static fromSecretKey() {
      return new Keypair();
    }
  }

  class Transaction {
    feePayer?: PublicKey;
    recentBlockhash?: string;
    instructions: unknown[] = [];

    add(instruction: unknown) {
      this.instructions.push(instruction);
      return this;
    }

    partialSign() {}

    serialize() {
      return Buffer.from("mock-serialized-tx");
    }
  }

  class TransactionInstruction {
    constructor(public args: unknown) {}
  }

  return {
    __esModule: true,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    ComputeBudgetProgram: {
      setComputeUnitLimit: jest.fn(() => ({ type: "compute-budget" })),
    },
    SystemProgram: {
      programId: new PublicKey("11111111111111111111111111111111"),
    },
  };
});

import fs from "fs";

describe("cron settle payouts", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.clearAllMocks();
    process.env.ADMIN_SECRET_KEY = "[1,2,3]";
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.ADMIN_WALLET_ADDRESS = ADMIN_ADDRESS;
    mockRpcSignatureStatuses = [{ err: null, confirmationStatus: "finalized" }];
    mockFiles = {
      "bets_db.json": JSON.stringify({
        BonusWinner111111111111111111111111111111: [
          {
            id: "bet-bonus-win-1",
            userAddress: "BonusWinner111111111111111111111111111111",
            matchId: 101,
            matchName: "A vs B",
            outcome: "home",
            amount: 10,
            odds: 2.5,
            netPayout: 25,
            status: "win",
            useBonus: true,
            timestamp: 1234567890,
            paidOut: false,
          },
        ],
      }),
      "referral_db.json": "{}",
      "market_db.json": "{}",
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.ADMIN_SECRET_KEY;
    delete process.env.CRON_SECRET;
    delete process.env.ADMIN_WALLET_ADDRESS;
  });

  it("includes trial-funds winning bets in on-chain payout processing", async () => {
    mockFiles["market_db.json"] = JSON.stringify({
      "101": {
        realTotalPool: 100,
        liabilities: { home: 25, draw: 0, away: 0 },
        pools: { home: 50, draw: 25, away: 25 },
      },
    });

    const { GET } = await import("./route");
    const responsePromise = GET(new Request("http://localhost/api/cron/settle", {
      headers: { "x-cron-secret": "test-cron-secret" },
    }));
    await jest.runAllTimersAsync();
    const response = await responsePromise;
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.wins).toBe(1);
    expect(json.totalUsdtPaid).toBe(25);

    const savedBetsDb = JSON.parse(mockFiles["bets_db.json"]);
    expect(savedBetsDb.BonusWinner111111111111111111111111111111[0].paidOut).toBe(true);
  });

  it("refunds the full original gross stake for refunded bets", async () => {
    mockFiles["bets_db.json"] = JSON.stringify({
      RefundUser111111111111111111111111111111111: [
        {
          id: "bet-refund-1",
          userAddress: "RefundUser111111111111111111111111111111111",
          matchId: 202,
          matchName: "Refund Match",
          outcome: "home",
          amount: 10,
          odds: 2,
          netPayout: 18.4,
          status: "refunded",
          useBonus: false,
          timestamp: 1234567890,
          paidOut: false,
        },
      ],
    });
    mockFiles["market_db.json"] = JSON.stringify({
      "202": {
        realTotalPool: 10,
        liabilities: { home: 0, draw: 0, away: 0 },
        pools: { home: 10, draw: 0, away: 0 },
      },
    });

    const { GET } = await import("./route");
    const responsePromise = GET(new Request("http://localhost/api/cron/settle", {
      headers: { "x-cron-secret": "test-cron-secret" },
    }));
    await jest.runAllTimersAsync();
    const response = await responsePromise;
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.refunds).toBe(1);
    expect(json.totalUsdtPaid).toBe(10);

    const savedBetsDb = JSON.parse(mockFiles["bets_db.json"]);
    expect(savedBetsDb.RefundUser111111111111111111111111111111111[0].paidOut).toBe(true);
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/settle"));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toMatch(/CRON_SECRET/);
  });

  it("defers referral commission payout to the referral withdraw flow", async () => {
    mockFiles["bets_db.json"] = "{}";
    mockFiles["referral_db.json"] = JSON.stringify({
      Referrer111: {
        stats: {
          total: "0.080000 USDT",
          withdrawable: "0.080000 USDT",
          month: "0.080000 USDT",
          friends: 1,
        },
        commissions: [
          {
            id: "comm-approved-1",
            referee: "Referee111",
            betAmount: "5.000000",
            fee: "0.400000",
            commission: "0.080000",
            timestamp: "2026-05-16T00:00:00.000Z",
            status: "approved",
            signature: "sig-approved-1",
            approvedAt: "2026-05-16T00:05:00.000Z",
          },
        ],
        referees: [],
        balances: { usdt: 0, bonus: 0 },
      },
    });

    const { GET } = await import("./route");
    const responsePromise = GET(
      new Request("http://localhost/api/cron/settle", {
        headers: { "x-cron-secret": "test-cron-secret" },
      })
    );
    await jest.runAllTimersAsync();
    const response = await responsePromise;
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.commissions).toBe(0);
    expect(json.message).toBe("No pending payouts");

    const savedReferralDb = JSON.parse(mockFiles["referral_db.json"]);
    expect(savedReferralDb.Referrer111.commissions[0].status).toBe("approved");
  });

  describe("single-match pool isolation", () => {
    it("refunds-at-cost when a match pool is insufficient (instead of blocking)", async () => {
      mockFiles["bets_db.json"] = JSON.stringify({
        InsolventUser11111111111111111111111111111: [
          {
            id: "bet-match1-win",
            userAddress: "InsolventUser11111111111111111111111111111",
            matchId: 301,
            matchName: "Team C vs Team D",
            outcome: "away",
            amount: 0.05,
            odds: 2.99,
            netPayout: 0.1495,
            status: "win",
            useBonus: false,
            timestamp: 1234567890,
            paidOut: false,
          },
        ],
      });
      mockFiles["market_db.json"] = JSON.stringify({
        "301": {
          realTotalPool: 0.08,
          liabilities: { home: 0.0776, draw: 0, away: 0.1495 },
          pools: { home: 0.03, draw: 0, away: 0.05 },
        },
      });

      const { GET } = await import("./route");
      const responsePromise = GET(new Request("http://localhost/api/cron/settle", {
        headers: { "x-cron-secret": "test-cron-secret" },
      }));
      await jest.runAllTimersAsync();
      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.wins).toBe(0);
      expect(json.refunds).toBe(1);
      expect(json.insolventRefundCount).toBe(1);
      expect(json.insolventMatches).toHaveLength(1);
      expect(json.insolventMatches[0].matchId).toBe("301");
      expect(json.insolventMatches[0].realTotalPool).toBe(0.08);
      expect(json.insolventMatches[0].shortfall).toBeCloseTo(0.0695, 4);
    });

    it("allows payout when all match pools are solvent", async () => {
      mockFiles["bets_db.json"] = JSON.stringify({
        SolventUser1111111111111111111111111111111: [
          {
            id: "bet-match1-win",
            userAddress: "SolventUser1111111111111111111111111111111",
            matchId: 401,
            matchName: "Team E vs Team F",
            outcome: "home",
            amount: 0.03,
            odds: 2.0,
            netPayout: 0.06,
            status: "win",
            useBonus: false,
            timestamp: 1234567890,
            paidOut: false,
          },
        ],
      });
      mockFiles["market_db.json"] = JSON.stringify({
        "401": {
          realTotalPool: 0.10,
          liabilities: { home: 0.06, draw: 0, away: 0 },
          pools: { home: 0.05, draw: 0.03, away: 0.02 },
        },
      });

      const { GET } = await import("./route");
      const responsePromise = GET(new Request("http://localhost/api/cron/settle", {
        headers: { "x-cron-secret": "test-cron-secret" },
      }));
      await jest.runAllTimersAsync();
      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.wins).toBe(1);
      expect(json.totalUsdtPaid).toBe(0.06);
    });

    it("pays solvent match normally and refunds-at-cost for insolvent one", async () => {
      mockFiles["bets_db.json"] = JSON.stringify({
        UserA111111111111111111111111111111111111: [
          {
            id: "bet-solvent",
            userAddress: "UserA111111111111111111111111111111111111",
            matchId: 501,
            matchName: "Good Match",
            outcome: "home",
            amount: 1,
            odds: 1.5,
            netPayout: 1.5,
            status: "win",
            useBonus: false,
            timestamp: 1234567890,
            paidOut: false,
          },
        ],
        UserB111111111111111111111111111111111111: [
          {
            id: "bet-insolvent",
            userAddress: "UserB111111111111111111111111111111111111",
            matchId: 502,
            matchName: "Bad Match",
            outcome: "away",
            amount: 0.05,
            odds: 2.99,
            netPayout: 0.1495,
            status: "win",
            useBonus: false,
            timestamp: 1234567890,
            paidOut: false,
          },
        ],
      });
      mockFiles["market_db.json"] = JSON.stringify({
        "501": {
          realTotalPool: 10,
          liabilities: { home: 1.5, draw: 0, away: 0 },
          pools: { home: 5, draw: 3, away: 2 },
        },
        "502": {
          realTotalPool: 0.08,
          liabilities: { home: 0.0776, draw: 0, away: 0.1495 },
          pools: { home: 0.03, draw: 0, away: 0.05 },
        },
      });

      const { GET } = await import("./route");
      const responsePromise = GET(new Request("http://localhost/api/cron/settle", {
        headers: { "x-cron-secret": "test-cron-secret" },
      }));
      await jest.runAllTimersAsync();
      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.wins).toBe(1);
      expect(json.refunds).toBe(1);
      expect(json.insolventRefundCount).toBe(1);
      expect(json.insolventMatches).toHaveLength(1);
      expect(json.insolventMatches[0].matchId).toBe("502");
      expect(json.totalUsdtPaid).toBe(1.55);
    });

    it("bonus wins refund at cost when match pool is insolvent", async () => {
      mockFiles["bets_db.json"] = JSON.stringify({
        BonusUser11111111111111111111111111111111: [
          {
            id: "bet-bonus-win-insolvent",
            userAddress: "BonusUser11111111111111111111111111111111",
            matchId: 601,
            matchName: "Trial Match",
            outcome: "home",
            amount: 20,
            odds: 1.5,
            netPayout: 30,
            status: "win",
            useBonus: true,
            timestamp: 1234567890,
            paidOut: false,
          },
        ],
      });
      mockFiles["market_db.json"] = JSON.stringify({
        "601": {
          realTotalPool: 0.01,
          liabilities: { home: 0, draw: 0, away: 0 },
          pools: { home: 0.01, draw: 0, away: 0 },
        },
      });

      const { GET } = await import("./route");
      const responsePromise = GET(new Request("http://localhost/api/cron/settle", {
        headers: { "x-cron-secret": "test-cron-secret" },
      }));
      await jest.runAllTimersAsync();
      const response = await responsePromise;
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.wins).toBe(0);
      expect(json.refunds).toBe(1);
      expect(json.insolventRefundCount).toBe(1);
      expect(json.totalUsdtPaid).toBe(20);
    });
  });
});
