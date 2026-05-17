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

  it("excludes trial-funds winning bets from the pending payout list", async () => {
    const response = await GET(new Request("http://localhost/api/admin/payout"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.count).toBe(0);
    expect(json.totalOwed).toBe(0);
    expect(json.payouts).toEqual([]);
  });

  it("archives unsigned legacy bets for authorized admins", async () => {
    mockBetsDb = JSON.stringify({
      LegacyArchive111111111111111111111111111111: [
        {
          id: "bet-legacy-archive-1",
          userAddress: "LegacyArchive111111111111111111111111111111",
          matchId: 202,
          matchName: "Legacy Match",
          outcome: "home",
          amount: 15,
          status: "pending",
          useBonus: false,
          timestamp: 1234567890,
          paidOut: false,
          signature: null,
        },
      ],
    });

    const response = await POST(new Request("http://localhost/api/admin/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive_old_bets" }),
    }) as any);
    const json = await response.json();
    const savedDb = JSON.parse(mockBetsDb);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.archived).toBe(1);
    expect(savedDb.LegacyArchive111111111111111111111111111111[0]).toMatchObject({
      archived: true,
      paidOut: true,
    });
  });

  it("marks pre-cutoff legacy wins for manual payout handling", async () => {
    mockBetsDb = JSON.stringify({
      LegacyWinner1111111111111111111111111111111: [
        {
          id: "bet-legacy-win-1",
          userAddress: "LegacyWinner1111111111111111111111111111111",
          matchId: 303,
          matchName: "Legacy Final",
          outcome: "away",
          amount: 12,
          odds: 2.2,
          status: "win",
          useBonus: false,
          timestamp: new Date("2026-05-18T12:00:00Z").getTime(),
          paidOut: false,
        },
      ],
    });

    const response = await POST(new Request("http://localhost/api/admin/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_legacy_wins" }),
    }) as any);
    const json = await response.json();
    const savedDb = JSON.parse(mockBetsDb);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.marked).toBe(1);
    expect(json.affectedUsers).toBe(1);
    expect(savedDb.LegacyWinner1111111111111111111111111111111[0]).toMatchObject({
      legacyPayout: true,
      paidOut: true,
    });
  });
});
