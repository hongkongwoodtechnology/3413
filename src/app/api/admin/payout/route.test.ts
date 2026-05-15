/**
 * @jest-environment node
 */

let mockBetsDb = "{}";

const mockRequireAdminAuth = jest.fn();

jest.mock("fs", () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(() => mockBetsDb),
    writeFileSync: jest.fn((filePath: string, data: string) => {
      if (String(filePath).replace(/\\/g, "/").endsWith("/data/bets_db.json")) {
        mockBetsDb = data;
      }
    }),
  },
}));

jest.mock("@/lib/security/auth", () => ({
  requireAdminAuth: (...args: unknown[]) => mockRequireAdminAuth(...args),
}));

import { GET, POST } from "./route";

describe("admin payout queue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdminAuth.mockResolvedValue({ authorized: true });
    mockBetsDb = JSON.stringify({
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
    });
  });

  it("rejects unauthenticated reads of the payout queue", async () => {
    mockRequireAdminAuth.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await GET(new Request("http://localhost/api/admin/payout"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Authentication required");
  });

  it("rejects unauthenticated payout mutations", async () => {
    mockRequireAdminAuth.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await POST(new Request("http://localhost/api/admin/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_paid" }),
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Authentication required");
  });

  it("shows trial-funds winning bets in the pending payout list for authorized admins", async () => {
    const response = await GET(new Request("http://localhost/api/admin/payout"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
    expect(json.totalOwed).toBe(25);
    expect(json.payouts[0]).toMatchObject({
      betId: "bet-bonus-win-1",
      userAddress: "BonusWinner111111111111111111111111111111",
      type: "win",
      winAmount: 25,
    });
  });

  it("rejects the removed legacy payout action", async () => {
    const response = await POST(new Request("http://localhost/api/admin/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_legacy_wins" }),
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Unknown action");
  });
});
