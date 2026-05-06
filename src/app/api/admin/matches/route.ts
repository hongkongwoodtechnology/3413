import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

type BetRecord = {
  id: string;
  matchId: string | number;
  matchName: string;
  outcome: string;
  amount: number;
  odds?: number;
  status?: string;
  useBonus: boolean;
  timestamp: number;
};

function loadBetsDb(): Record<string, BetRecord[]> {
  const DB_FILE_PATH = path.join(process.cwd(), 'data', 'bets_db.json');
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function loadMarketDb(): Record<string, any> {
  const MARKET_DB_PATH = path.join(process.cwd(), 'data', 'market_db.json');
  try {
    if (fs.existsSync(MARKET_DB_PATH)) {
      return JSON.parse(fs.readFileSync(MARKET_DB_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

export async function GET() {
  try {
    const betsDb = loadBetsDb();

    const matchMap = new Map<string, {
      matchId: string;
      matchName: string;
      homeAmount: number;
      drawAmount: number;
      awayAmount: number;
      bettorSet: Set<string>;
    }>();

    for (const [address, bets] of Object.entries(betsDb)) {
      for (const bet of bets) {
        const mid = String(bet.matchId);
        if (!matchMap.has(mid)) {
          matchMap.set(mid, {
            matchId: mid,
            matchName: bet.matchName,
            homeAmount: 0,
            drawAmount: 0,
            awayAmount: 0,
            bettorSet: new Set(),
          });
        }
        const entry = matchMap.get(mid)!;
        if (bet.outcome === 'home') entry.homeAmount += bet.amount;
        else if (bet.outcome === 'draw') entry.drawAmount += bet.amount;
        else if (bet.outcome === 'away') entry.awayAmount += bet.amount;
        entry.bettorSet.add(address);
      }
    }

    const data = Array.from(matchMap.values())
      .map(e => ({
        matchId: e.matchId,
        matchName: e.matchName,
        homeAmount: parseFloat(e.homeAmount.toFixed(6)),
        drawAmount: parseFloat(e.drawAmount.toFixed(6)),
        awayAmount: parseFloat(e.awayAmount.toFixed(6)),
        totalPool: parseFloat((e.homeAmount + e.drawAmount + e.awayAmount).toFixed(6)),
        bettorCount: e.bettorSet.size,
      }))
      .sort((a, b) => b.totalPool - a.totalPool);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Admin Matches] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load match data' }, { status: 500 });
  }
}
