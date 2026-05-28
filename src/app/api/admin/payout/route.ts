import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdminAuth } from "@/lib/security/auth";
import { MarketDataInfo } from "@/lib/marketDb";

interface BetRecord {
  id: string;
  userAddress: string;
  matchId: number;
  matchName: string;
  outcome: string;
  amount: number;
  odds?: number;
  netPayout?: number;
  signature?: string | null;
  status?: string;
  useBonus: boolean;
  timestamp: number;
  paidOut?: boolean;
  archived?: boolean;
  legacyPayout?: boolean;
}

interface PayoutEntry {
  userAddress: string;
  matchId: number;
  matchName: string;
  betId: string;
  outcome: string;
  betAmount: number;
  odds: number;
  winAmount: number;
  paidOut: boolean;
  type: "win" | "refund";
}

interface MatchSolvency {
  matchId: string;
  matchName: string;
  realTotalPool: number;
  totalNeeded: number;
  solvent: boolean;
  shortfall: number;
  refundCount: number;
  winCount: number;
}

function loadBetsDb(): Record<string, BetRecord[]> {
  const p = path.join(process.cwd(), "data", "bets_db.json");
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {}
  return {};
}

function saveBetsDb(db: Record<string, BetRecord[]>) {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bets_db.json"), JSON.stringify(db, null, 2), "utf-8");
}

function loadMarketDb(): Record<string, MarketDataInfo> {
  const p = path.join(process.cwd(), "data", "market_db.json");
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {}
  return {};
}

export async function GET() {
  try {
    const db = loadBetsDb();
    const marketDb = loadMarketDb();
    const payouts: PayoutEntry[] = [];
    const matchNeeded = new Map<string, { matchName: string; needed: number; refundCount: number; winCount: number }>();

    for (const [address, bets] of Object.entries(db)) {
      for (const bet of bets) {
        if (bet.useBonus) continue;

        if (bet.status === "win" && !bet.paidOut && bet.amount > 0) {
          const netPayout = typeof bet.netPayout === "number"
            ? bet.netPayout
            : Math.round(bet.amount * (bet.odds || 1) * 1e6) / 1e6;
          payouts.push({
            userAddress: address,
            matchId: bet.matchId,
            matchName: bet.matchName,
            betId: bet.id,
            outcome: bet.outcome,
            betAmount: bet.amount,
            odds: bet.odds || 1,
            winAmount: netPayout,
            paidOut: bet.paidOut || false,
            type: "win",
          });
          const mid = String(bet.matchId);
          if (!matchNeeded.has(mid)) {
            matchNeeded.set(mid, { matchName: bet.matchName, needed: 0, refundCount: 0, winCount: 0 });
          }
          matchNeeded.get(mid)!.needed += netPayout;
          matchNeeded.get(mid)!.winCount += 1;
        }
        if (bet.status === "refunded" && !bet.paidOut && bet.amount > 0) {
          payouts.push({
            userAddress: address,
            matchId: bet.matchId,
            matchName: bet.matchName,
            betId: bet.id,
            outcome: bet.outcome,
            betAmount: bet.amount,
            odds: 1,
            winAmount: bet.amount,
            paidOut: bet.paidOut || false,
            type: "refund",
          });
          const mid = String(bet.matchId);
          if (!matchNeeded.has(mid)) {
            matchNeeded.set(mid, { matchName: bet.matchName, needed: 0, refundCount: 0, winCount: 0 });
          }
          matchNeeded.get(mid)!.needed += bet.amount;
          matchNeeded.get(mid)!.refundCount += 1;
        }
      }
    }

    const totalOwed = payouts.reduce((s, p) => s + p.winAmount, 0);

    const solvencies: MatchSolvency[] = [];
    for (const [matchId, info] of matchNeeded) {
      const mkt = marketDb[matchId];
      const realTotalPool = mkt?.realTotalPool ?? 0;
      const solvent = info.needed <= realTotalPool + 1e-9;
      solvencies.push({
        matchId,
        matchName: info.matchName,
        realTotalPool: Math.round(realTotalPool * 1e6) / 1e6,
        totalNeeded: Math.round(info.needed * 1e6) / 1e6,
        solvent,
        shortfall: solvent ? 0 : Math.round((info.needed - realTotalPool) * 1e6) / 1e6,
        refundCount: info.refundCount,
        winCount: info.winCount,
      });
    }

    const allSolvent = solvencies.every(s => s.solvent);

    return NextResponse.json({
      success: true,
      payouts,
      totalOwed: Math.round(totalOwed * 1e6) / 1e6,
      count: payouts.length,
      solvencies,
      allSolvent,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const { action, userAddresses } = await request.json();

    if (action === "mark_paid") {
      const db = loadBetsDb();
      let marked = 0;

      for (const [address, bets] of Object.entries(db)) {
        if (userAddresses && !userAddresses.includes(address)) continue;
        for (const bet of bets) {
          if (bet.status === "win" && !bet.paidOut && !bet.useBonus) {
            bet.paidOut = true;
            marked++;
          }
        }
      }

      saveBetsDb(db);
      return NextResponse.json({ success: true, marked });
    }

    if (action === "archive_old_bets") {
      const db = loadBetsDb();
      let archived = 0;

      for (const [, bets] of Object.entries(db)) {
        for (const bet of bets) {
          if (
            !bet.archived &&
            !bet.useBonus &&
            !bet.signature
          ) {
            bet.archived = true;
            bet.paidOut = true;
            archived++;
          }
        }
      }

      saveBetsDb(db);
      return NextResponse.json({
        success: true,
        archived,
        message: `已封存 ${archived} 筆無鏈上簽名的舊測試注單。`,
      });
    }

    if (action === "mark_legacy_wins") {
      const db = loadBetsDb();
      const LEGACY_CUTOFF = new Date("2026-05-19T00:00:00Z").getTime();
      let marked = 0;
      const affectedUsers: string[] = [];
      const details: { user: string; match: string; amount: number; odds: number }[] = [];

      for (const [address, bets] of Object.entries(db)) {
        for (const bet of bets) {
          if (
            bet.status === "win" &&
            !bet.paidOut &&
            !bet.useBonus &&
            !bet.legacyPayout &&
            bet.timestamp > 0 &&
            bet.timestamp < LEGACY_CUTOFF
          ) {
            bet.legacyPayout = true;
            bet.paidOut = true;
            marked++;
            if (!affectedUsers.includes(address)) affectedUsers.push(address);
            details.push({
              user: address,
              match: bet.matchName,
              amount: bet.amount,
              odds: bet.odds || 1,
            });
          }
        }
      }

      const totalWinUsdt = details.reduce((s, d) => s + d.amount * d.odds, 0);

      saveBetsDb(db);
      return NextResponse.json({
        success: true,
        marked,
        affectedUsers: affectedUsers.length,
        totalWinUsdt: Math.round(totalWinUsdt * 1e6) / 1e6,
        details,
        message: `已標記 ${marked} 筆舊架構贏家注單（總 ${Math.round(totalWinUsdt * 1e6) / 1e6} USDT）。\n\n這些注單的資金在舊 Pool ATA (z54Jv3Xup...)，需從 Admin Phantom 手動發送 USDT 給以下贏家：\n${details.map(d => `  - ${d.user.slice(0, 8)}... ${d.match}: ${d.amount}U × ${d.odds.toFixed(2)} = ${(d.amount * d.odds).toFixed(4)} USDT`).join('\n')}`,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
