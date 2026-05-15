/**
 * @jest-environment node
 */

const ADMIN_ADDRESS = "2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K";

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
      return "{}";
    }),
    writeFileSync: jest.fn((filePath: string, data: string) => {
      const normalized = String(filePath).replace(/\\/g, "/");
      if (normalized.endsWith("/data/bets_db.json")) mockFiles["bets_db.json"] = data;
      if (normalized.endsWith("/data/referral_db.json")) mockFiles["referral_db.json"] = data;
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
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.ADMIN_SECRET_KEY;
    delete process.env.CRON_SECRET;
    delete process.env.ADMIN_WALLET_ADDRESS;
  });

  it("includes trial-funds winning bets in on-chain payout processing", async () => {
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

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/settle"));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toMatch(/CRON_SECRET/);
  });
});
