import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

type BetRecord = {
  id: string;
  userAddress: string;
  matchId: string | number;
  matchName: string;
  outcome: string;
  amount: number;
  odds?: number;
  status?: string;
  useBonus: boolean;
  timestamp: number;
};

export async function GET() {
  try {
    const DB_FILE_PATH = path.join(process.cwd(), 'data', 'bets_db.json');
    const MARKET_DB_PATH = path.join(process.cwd(), 'data', 'market_db.json');

    let betsDb: Record<string, BetRecord[]> = {};
    if (fs.existsSync(DB_FILE_PATH)) {
      betsDb = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'));
    }

    let marketDb: Record<string, any> = {};
    if (fs.existsSync(MARKET_DB_PATH)) {
      marketDb = JSON.parse(fs.readFileSync(MARKET_DB_PATH, 'utf-8'));
    }

    let totalVolume = 0;
    let totalBets = 0;
    const uniqueAddresses = new Set<string>();

    for (const [address, bets] of Object.entries(betsDb)) {
      uniqueAddresses.add(address);
      for (const bet of bets) {
        totalVolume += bet.amount || 0;
        totalBets += 1;
      }
    }

    // 从 market_db.json 获取更精确的总资金池
    let totalPoolFromMarket = 0;
    for (const key of Object.keys(marketDb)) {
      totalPoolFromMarket += marketDb[key].realTotalPool || 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalVolume: parseFloat(totalVolume.toFixed(2)),
        totalBets,
        totalBettors: uniqueAddresses.size,
        totalPoolFromMarket: parseFloat(totalPoolFromMarket.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Admin Stats API Error:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
