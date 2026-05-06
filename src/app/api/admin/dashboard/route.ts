import { NextRequest, NextResponse } from 'next/server';
import { GET as getMatches } from '../../matches/route';
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
      const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Dashboard] Error loading bets database:', error);
  }
  return {};
}

export async function GET(request: NextRequest) {
    try {
        // 直接呼叫同專案的 Route Handler 函數，並建立 NextRequest 供其讀取 nextUrl
        const fakeRequest = new NextRequest(new URL('/api/matches?lang=zh-TW', request.url).toString());
        const matchesResponse = await getMatches(fakeRequest);
        const matchesData = await matchesResponse.json();

        // 從 bets_db.json 計算每個 matchId 的真實投注筆數與金額
        const betsDb = loadBetsDb();
        const betCountByMatch: Record<string, number> = {};
        const betVolumeByMatch: Record<string, number> = {};

        for (const address of Object.keys(betsDb)) {
          for (const bet of betsDb[address]) {
            const mid = String(bet.matchId);
            betCountByMatch[mid] = (betCountByMatch[mid] || 0) + 1;
            betVolumeByMatch[mid] = (betVolumeByMatch[mid] || 0) + bet.amount;
          }
        }

        // 過濾出進行中的比賽 (Live) 作為 Dashboard 的主要數據
        const liveMatches = (matchesData || []).filter((m: any) => m.status === 'live').map((m: any) => {
            const mid = String(m.id);
            const realPool = (m.pools?.home || 0) + (m.pools?.away || 0) + (m.pools?.draw || 0);
            return {
                id: mid,
                teamA: m.home,
                teamB: m.away,
                totalPool: realPool,
                totalBets: betCountByMatch[mid] || 0,
                oddsA: (1 + 10000 / (m.pools?.home || 10000)).toFixed(2),
                oddsB: (1 + 10000 / (m.pools?.away || 10000)).toFixed(2),
                status: m.date || 'Live'
            };
        });

        // 基於真實投注時間戳生成趨勢圖數據 (過去24小時，每2小時一組)
        const now = Date.now();
        const trendSlots: { time: string; volume: number; count: number }[] = [];
        const slotMs = 2 * 60 * 60 * 1000; // 2小時為一個區間
        const totalSlots = 12;
        for (let i = totalSlots - 1; i >= 0; i--) {
          const slotEnd = now - i * slotMs;
          const slotStart = slotEnd - slotMs;
          const d = new Date(slotEnd);
          trendSlots.push({
            time: `${d.getHours().toString().padStart(2, '0')}:00`,
            volume: 0,
            count: 0,
          });
        }

        for (const address of Object.keys(betsDb)) {
          for (const bet of betsDb[address]) {
            if (!bet.timestamp) continue;
            for (let i = 0; i < trendSlots.length; i++) {
              const slotEnd = now - (totalSlots - 1 - i) * slotMs;
              const slotStart = slotEnd - slotMs;
              if (bet.timestamp >= slotStart && bet.timestamp < slotEnd) {
                trendSlots[i].volume += bet.amount;
                trendSlots[i].count += 1;
                break;
              }
            }
          }
        }

        const trendData = trendSlots.map(s => ({
          time: s.time,
          volume: s.volume > 0 ? parseFloat(s.volume.toFixed(2)) : 0,
        }));

        // 基於真實聯賽分類計算分布數據
        const leagueDistribution: Record<string, number> = {};
        const matchIdToLeague: Record<string, string> = {};
        for (const m of matchesData || []) {
          const mid = String(m.id);
          if (m.league) {
            const leagueName = m.league.length > 20 ? m.league.substring(0, 20) + '...' : m.league;
            matchIdToLeague[mid] = leagueName;
          }
        }

        for (const address of Object.keys(betsDb)) {
          for (const bet of betsDb[address]) {
            const mid = String(bet.matchId);
            const league = matchIdToLeague[mid] || '其他賽事';
            leagueDistribution[league] = (leagueDistribution[league] || 0) + 1;
          }
        }

        let distributionData = Object.entries(leagueDistribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, value]) => ({ name, value }));

        if (distributionData.length === 0) {
          distributionData = [
            { name: '尚無投注數據', value: 1 },
          ];
        }

        return NextResponse.json({ 
            success: true, 
            data: {
                liveMatches,
                trendData,
                distributionData
            }
        });
    } catch (error) {
        console.error('Dashboard fetch error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch real dashboard data' }, { status: 500 });
    }
}
