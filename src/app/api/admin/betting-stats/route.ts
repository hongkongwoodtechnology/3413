import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

type BetRecord = {
  id: string;
  userAddress?: string;
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

function loadMatchesSchedule(): Record<string, any> {
  const SCHEDULE_PATH = path.join(process.cwd(), 'data', 'worldcup_schedule_2026.json');
  try {
    if (fs.existsSync(SCHEDULE_PATH)) {
      return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest) {
  try {
    const betsDb = loadBetsDb();
    const marketDb = loadMarketDb();
    const scheduleDb = loadMatchesSchedule();

    const matchMap = new Map<string, {
      matchId: string;
      homeTeam: string;
      awayTeam: string;
      league: string;
      status: string;
      score: string | null;
      homeAmount: number;
      drawAmount: number;
      awayAmount: number;
      bettorSet: Set<string>;
      bonusAmount: number;
    }>();

    for (const [address, bets] of Object.entries(betsDb)) {
      for (const bet of bets) {
        const mid = String(bet.matchId);
        if (!matchMap.has(mid)) {
          const matchNameParts = bet.matchName ? bet.matchName.split(' vs ') : ['?', '?'];
          const homeTeam = matchNameParts[0]?.trim() || '?';
          const awayTeam = matchNameParts[1]?.trim() || '?';

          const mkt = marketDb[mid];
          const schedMatch = scheduleDb[mid];

          let league = '';
          let status = 'unknown';
          let score: string | null = null;

          if (mkt) {
            if (mkt.finalWinner) {
              status = 'finished';
              score = mkt.finalScore || null;
            } else if (mkt.settled) {
              status = 'settled';
            } else {
              status = 'active';
            }
            league = mkt.league || '';
          }

          if (!league && schedMatch) {
            league = schedMatch.league || '';
          }

          matchMap.set(mid, {
            matchId: mid,
            homeTeam,
            awayTeam,
            league,
            status,
            score,
            homeAmount: 0,
            drawAmount: 0,
            awayAmount: 0,
            bettorSet: new Set(),
            bonusAmount: 0,
          });
        }
        const entry = matchMap.get(mid)!;
        if (bet.outcome === 'home') entry.homeAmount += bet.amount;
        else if (bet.outcome === 'draw') entry.drawAmount += bet.amount;
        else if (bet.outcome === 'away') entry.awayAmount += bet.amount;
        if (bet.useBonus) entry.bonusAmount += bet.amount;
        entry.bettorSet.add(address);
      }
    }

    const data = Array.from(matchMap.values())
      .map(e => ({
        matchId: e.matchId,
        homeTeam: e.homeTeam,
        awayTeam: e.awayTeam,
        league: e.league,
        status: e.status,
        score: e.score,
        homeAmount: parseFloat(e.homeAmount.toFixed(6)),
        drawAmount: parseFloat(e.drawAmount.toFixed(6)),
        awayAmount: parseFloat(e.awayAmount.toFixed(6)),
        totalPool: parseFloat((e.homeAmount + e.drawAmount + e.awayAmount).toFixed(6)),
        bonusAmount: parseFloat(e.bonusAmount.toFixed(6)),
        bettorCount: e.bettorSet.size,
      }))
      .sort((a, b) => b.totalPool - a.totalPool);

    const grandTotal = parseFloat(data.reduce((sum, m) => sum + m.totalPool, 0).toFixed(6));
    const grandBonus = parseFloat(data.reduce((sum, m) => sum + m.bonusAmount, 0).toFixed(6));
    const totalBettors = new Set<string>();
    for (const address of Object.keys(betsDb)) {
      totalBettors.add(address);
    }

    return NextResponse.json({
      success: true,
      data: {
        matches: data,
        summary: {
          totalMatches: data.length,
          grandTotal,
          grandBonus,
          totalBettors: totalBettors.size,
        },
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[Admin Betting Stats] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load betting stats' }, { status: 500 });
  }
}
