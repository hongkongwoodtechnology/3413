import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { triggerAutoBackup } from '@/lib/gdriveBackup';
import { loadMarketDb, saveMarketDb, MarketDataInfo } from '@/lib/marketDb';
import { getNetPayoutFromLockedOdds } from '@/lib/bet-mode';
import { PLATFORM_FEE_RATE } from '@/lib/wallets';
import { addToReserve, loadReserve } from '@/lib/reserve';
import { DynamicOddsEngine } from '@/lib/odds-engine';
import { countActiveOutcomes, splitBetByAttractionWindow } from '@/lib/market-rules';

// 檔案式資料庫路徑
const DB_FILE_PATH = path.join(process.cwd(), 'data', 'bets_db.json');

type BetRecord = {
  id: string;
  userAddress: string;
  matchId: number;
  matchName: string;
  outcome: 'home' | 'draw' | 'away';
  amount: number;
  odds?: number;
  netPayout?: number;
  signature?: string | null;
  status?: string; // 'pending', 'win', 'loss', 'refunded'
  useBonus: boolean;
  timestamp: number;
  archived?: boolean;
  paidOut?: boolean;
};

// 讀取檔案資料庫
function loadDatabase(): Record<string, BetRecord[]> {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (fs.existsSync(DB_FILE_PATH)) {
            const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading bets database:', error);
    }
    return {};
}

// 寫入檔案資料庫 (並自動建立本地備份)
function saveDatabase(db: Record<string, BetRecord[]>) {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        const backupDir = path.join(dataDir, 'backups');

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const jsonData = JSON.stringify(db, null, 2);
        
        // 1. 寫入主要資料庫檔案
        fs.writeFileSync(DB_FILE_PATH, jsonData, 'utf-8');

        // 2. 每天建立一個滾動備份 (Rolling Backup)，避免主檔案意外損毀
        const dateStr = new Date().toISOString().split('T')[0]; // e.g. 2026-04-20
        const localBackupPath = path.join(backupDir, `bets_db_${dateStr}.json`);
        fs.writeFileSync(localBackupPath, jsonData, 'utf-8');

        // 3. 嘗試觸發 Google Drive 自動備份 (不會阻塞主流程，且內建節流機制)
        triggerAutoBackup();

    } catch (error) {
        console.error('Error saving bets database:', error);
    }
}

// GET: 獲取特定使用者的所有投注紀錄（含自動結算）
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const db = loadDatabase();
        const marketDb = loadMarketDb();
        let betsModified = false;

        for (const userAddress of Object.keys(db)) {
            for (const bet of db[userAddress]) {
                if (bet.status === 'pending' || !bet.status) {
                    const mkt = marketDb[String(bet.matchId)];
                    if (mkt && mkt.finalWinner) {
                        bet.status = bet.outcome === mkt.finalWinner ? 'win' : 'loss';
                        betsModified = true;
                        console.log(`[BetsAPI Settle] ${bet.outcome === mkt.finalWinner ? 'WIN' : 'LOSS'}: bet ${bet.id} (${bet.outcome}) match ${bet.matchId} winner=${mkt.finalWinner} score=${mkt.finalScore}`);
                    } else if (mkt && mkt.refundProcessed && !mkt.finalWinner) {
                        const l = mkt.liabilities;
                        const outcomesWithBets = [l.home > 0, l.draw > 0, l.away > 0].filter(Boolean).length;
                        if (outcomesWithBets === 1) {
                            bet.status = 'refunded';
                            betsModified = true;
                            console.log(`[BetsAPI Refund] Refunded bet ${bet.id} (only 1 outcome bet) match ${bet.matchId}`);
                        }
                    }
                    if (!bet.status) {
                        bet.status = 'pending';
                    }
                }
            }
        }

        if (betsModified) {
            saveDatabase(db);
        }

        const userBets = db[address] || [];

        userBets.sort((a, b) => b.timestamp - a.timestamp);

        return NextResponse.json({ success: true, data: userBets }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch bets' }, { status: 500 });
    }
}

// POST: 新增一筆投注紀錄
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userAddress, matchId, matchName, outcome, amount, odds, useBonus, timestamp, liveMinute, signature } = body;

        if (!userAddress || !matchId || !matchName || !outcome || amount === undefined) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        if (outcome !== 'home' && outcome !== 'draw' && outcome !== 'away') {
            return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
        }

        const outcomeKey = outcome as 'home' | 'draw' | 'away';

        // 80分鐘自動鎖定投注機制
        if (liveMinute !== undefined && typeof liveMinute === 'number' && liveMinute >= 80) {
            return NextResponse.json({ error: '賽事已進行到80分鐘或以上，自動鎖定停止投注。' }, { status: 403 });
        }

        const db = loadDatabase();
        if (!db[userAddress]) {
            db[userAddress] = [];
        }

        const lockedOdds = odds || 1.0;
        const netPayout = getNetPayoutFromLockedOdds(amount, lockedOdds, !!useBonus);

        const marketDb = loadMarketDb();
        const key = String(matchId);
        const currentMarket: MarketDataInfo = marketDb[key] || {
            realTotalPool: 0,
            liabilities: { home: 0, draw: 0, away: 0 },
            pools: { home: 0, draw: 0, away: 0 },
            attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        };

        const currentRealTotal = currentMarket.realTotalPool || 0;
        const currentPools = currentMarket.pools || { home: 0, draw: 0, away: 0 };
        currentMarket.attractionWindowUsed ||= { home: 0, draw: 0, away: 0 };
        const currentTotalReal = currentPools.home + currentPools.draw + currentPools.away;
        const isFeeFundedCold = currentTotalReal < 0.50;

        const options: Array<'home' | 'draw' | 'away'> = ['home', 'draw', 'away'];
        const opponentPoolBefore = options
            .filter(o => o !== outcomeKey)
            .reduce((sum, o) => sum + (currentPools[o] || 0), 0);
        const isSingleSidePool = currentPools[outcomeKey] > 0 && opponentPoolBefore === 0;
        const activeOutcomeCount = countActiveOutcomes(currentPools);
        const isInitialOddsPhase = activeOutcomeCount === 0 || (activeOutcomeCount === 1 && (currentPools[outcomeKey] || 0) > 0);

        if (isInitialOddsPhase) {
            const expectedInitialOdds = currentMarket.initialOdds?.[outcomeKey];
            if (typeof expectedInitialOdds === 'number') {
                if (Math.abs(lockedOdds - expectedInitialOdds) > 1e-6) {
                    return NextResponse.json({ error: '單邊首注賠率異常。' }, { status: 403 });
                }
            } else if (lockedOdds < 1.01) {
                return NextResponse.json({ error: '單邊首注賠率異常。' }, { status: 403 });
            }
        } else if (!isFeeFundedCold) {
            if (lockedOdds < 1.01) {
                return NextResponse.json({ error: '賠率異常。' }, { status: 403 });
            }
            const projectedGross = currentRealTotal + amount;
            const projectedLiabilityFit = (currentMarket.liabilities[outcomeKey] || 0) + (amount * lockedOdds);
            if (projectedLiabilityFit > projectedGross * (1 - PLATFORM_FEE_RATE) + 1e-9) {
                return NextResponse.json(
                    { error: '投注被拒絕：對手盤資金不足，可能導致無法派彩。' },
                    { status: 403 }
                );
            }
        } else {
            const projectedLiability = (currentMarket.liabilities[outcomeKey] || 0) + (amount * lockedOdds);
            const realPoolFunds = currentRealTotal + amount * (1 - PLATFORM_FEE_RATE);
            const reserve = loadReserve().balance;
            if (projectedLiability > realPoolFunds + reserve + 1e-9) {
                return NextResponse.json(
                    { error: '投注被拒絕：儲備池不足，無法保證償付。' },
                    { status: 403 }
                );
            }
        }

        const currentOptionPool = currentPools[outcomeKey] || 0;
        const newTotalPool = currentTotalReal + amount;
        const newOptionConcentration = (currentOptionPool + amount) / (newTotalPool || 1);
        const MAX_POSITION_RATIO = 0.85;
        const COLD_START_CAP = 0.50;
        const isColdStart = currentTotalReal < COLD_START_CAP;
        if (!isColdStart && newTotalPool > 0 && newOptionConcentration > MAX_POSITION_RATIO && !isInitialOddsPhase) {
            return NextResponse.json(
                { error: `投注被拒絕：該選項已達到持倉上限 (${(MAX_POSITION_RATIO * 100).toFixed(0)}%)，請等待更多資金注入其他選項。` },
                { status: 403 }
            );
        }

        if (!isInitialOddsPhase && currentTotalReal > 0 && !isFeeFundedCold) {
            const engine = new DynamicOddsEngine();
            const xMax = engine.getMaxBetAmount(currentPools, outcomeKey);
            if (xMax <= 0) {
                return NextResponse.json(
                    { error: '投注被拒絕：該選項資金池已達賠付上限，請選擇其他選項。' },
                    { status: 403 }
                );
            }
            if (amount > xMax) {
                return NextResponse.json(
                    { error: `投注金額超出上限，此選項最大可投注 ${xMax.toFixed(4)} USDT（超過將使賠率低於 1.01）。` },
                    { status: 403 }
                );
            }
        }

        const newBet: BetRecord = {
            id: `bet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            userAddress,
            matchId,
            matchName,
            outcome,
            amount,
            odds: lockedOdds,
            netPayout,
            signature: typeof signature === 'string' ? signature : null,
            status: 'pending',
            useBonus: !!useBonus,
            timestamp: timestamp || Date.now()
        };

        db[userAddress].unshift(newBet);
        saveDatabase(db);

        if (!currentMarket.pools) {
            currentMarket.pools = { home: 0, draw: 0, away: 0 };
        }

        if (!isInitialOddsPhase) {
            const split = splitBetByAttractionWindow(
                amount,
                currentMarket.attractionWindowUsed,
                outcomeKey
            );
            currentMarket.attractionWindowUsed[outcomeKey] =
                (currentMarket.attractionWindowUsed[outcomeKey] || 0) + split.attractiveAmount;
        }

        currentMarket.realTotalPool = (currentMarket.realTotalPool || 0) + amount;
        currentMarket.liabilities[outcomeKey] = (currentMarket.liabilities?.[outcomeKey] || 0) + (amount * lockedOdds);
        currentMarket.pools[outcomeKey] = (currentMarket.pools?.[outcomeKey] || 0) + amount;

        marketDb[key] = currentMarket;
        saveMarketDb(marketDb);

        const platformFee = amount * PLATFORM_FEE_RATE;
        addToReserve(platformFee * 0.5);

        return NextResponse.json({ success: true, data: newBet });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to save bet' }, { status: 500 });
    }
}
