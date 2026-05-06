import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { triggerAutoBackup } from '@/lib/gdriveBackup';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// 模擬資料庫
interface Commission {
    id: string;
    referee: string;
    betAmount: string;
    fee: string;
    commission: string;
    timestamp: string;
    status: 'settled' | 'pending';
    signature?: string;
}

interface Referee {
    id: string;
    address: string;
    joinDateValue: number;
    totalVolumeValue: number;
    earnedCommissionValue: number;
    rewardIssued?: boolean; // 新增：標記是否已發放 100U 體驗金
}

type UserData = {
    stats: { total: string, withdrawable: string, month: string, friends: number };
    commissions: Commission[];
    referees: Referee[];
    balances: { usdt: number; bonus: number }; // 新增：用戶餘額與體驗金餘額
    commissionRate?: number; // 新增：管理員設定的專屬推薦手續費分成 (預設 0.3，即 30%)
};

// 檔案式資料庫路徑
const DB_FILE_PATH = path.join(process.cwd(), 'data', 'referral_db.json');

const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];
const USDT_DECIMALS = 6;
const USDT_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDT_MINT || "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
const POOL_WALLET = new PublicKey(process.env.NEXT_PUBLIC_POOL_WALLET || "9FfHYyK8ZKsA82BPtierU4sWmwTS8QTGqrGqtTt6tEu7");
const HOUSE_WALLET = new PublicKey(process.env.NEXT_PUBLIC_HOUSE_WALLET || "2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K");
const COMMISSION_WALLET = new PublicKey(process.env.NEXT_PUBLIC_COMMISSION_WALLET || "2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K");
const ZERO = BigInt(0);

function toRawAmount(amount: number): bigint {
    if (!Number.isFinite(amount) || amount < 0) return ZERO;
    const scale = Math.pow(10, USDT_DECIMALS);
    return BigInt(Math.round(amount * scale));
}

async function verifySplitTransfer(params: {
    signature: string;
    userAddress: string;
    poolAmount: number;
    houseAmount: number;
    commissionAmount: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    let tx: any;
    let lastError: any;
    
    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
        try {
            const connection = new Connection(RPC_ENDPOINTS[i], "confirmed");
            tx = await connection.getParsedTransaction(params.signature, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0
            });
            break;
        } catch (e: any) {
            lastError = e;
            if (e?.message?.includes?.("403") || e?.message?.includes?.("429")) {
                console.warn(`[Referral Verify] RPC ${i} failed (403/429), trying fallback...`);
                continue;
            }
            return { ok: false, error: `RPC 錯誤: ${e.message}` };
        }
    }
    
    if (!tx) {
        if (lastError) return { ok: false, error: `所有 RPC 不可用: ${lastError.message}` };
        return { ok: false, error: "找不到交易（可能 RPC 未同步或 signature 無效）" };
    }
    if (tx.meta?.err) return { ok: false, error: "交易失敗（meta.err != null）" };
    
    const userKey = new PublicKey(params.userAddress);
    const signedByUser = tx.transaction.message.accountKeys.some((k: any) => k.pubkey.equals(userKey) && k.signer);
    if (!signedByUser) return { ok: false, error: "交易不是由投注者簽名" };
    
    const poolAta = await getAssociatedTokenAddress(USDT_MINT, POOL_WALLET, true);
    const houseAta = await getAssociatedTokenAddress(USDT_MINT, HOUSE_WALLET, true);
    const commissionAta = await getAssociatedTokenAddress(USDT_MINT, COMMISSION_WALLET, true);
    
    const expected = new Map<string, bigint>();
    const addExpected = (dest: string, amount: bigint) => {
        expected.set(dest, (expected.get(dest) || ZERO) + amount);
    };
    addExpected(poolAta.toBase58(), toRawAmount(params.poolAmount));
    addExpected(houseAta.toBase58(), toRawAmount(params.houseAmount));
    addExpected(commissionAta.toBase58(), toRawAmount(params.commissionAmount));
    
    const transfersByDest = new Map<string, bigint>();
    
    const addTransfer = (destination: string, amountRaw: bigint) => {
        if (!destination) return;
        if (amountRaw <= ZERO) return;
        transfersByDest.set(destination, (transfersByDest.get(destination) || ZERO) + amountRaw);
    };
    
    const collect = (ixs: any[]) => {
        for (const ix of ixs) {
            const program = ix?.program;
            const parsed = ix?.parsed;
            if (program !== "spl-token" || !parsed) continue;
            
            const type = parsed?.type;
            const info = parsed?.info;
            if (type !== "transfer" && type !== "transferChecked") continue;
            
            const destination = info?.destination || info?.destinationAccount || info?.dest;
            const amountStr = info?.amount || info?.tokenAmount?.amount;
            if (!destination || !amountStr) continue;
            
            try {
                addTransfer(destination, BigInt(amountStr));
            } catch {
                continue;
            }
        }
    };
    
    collect(tx.transaction.message.instructions as any[]);
    for (const inner of tx.meta?.innerInstructions || []) {
        collect(inner.instructions as any[]);
    }
    
    for (const [dest, expectedRaw] of expected.entries()) {
        const actualRaw = transfersByDest.get(dest) || ZERO;
        if (actualRaw !== expectedRaw) {
            return { ok: false, error: `交易金額驗證失敗：${dest} expected=${expectedRaw.toString()} actual=${actualRaw.toString()}` };
        }
    }
    
    return { ok: true };
}

// 讀取檔案資料庫
function loadDatabase(): Record<string, UserData> {
    try {
        if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
            fs.mkdirSync(path.join(process.cwd(), 'data'));
        }
        if (fs.existsSync(DB_FILE_PATH)) {
            const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading referral database:', error);
    }
    return {};
}

// 寫入檔案資料庫 (並自動建立本地備份)
function saveDatabase(db: Record<string, UserData>) {
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
        const localBackupPath = path.join(backupDir, `referral_db_${dateStr}.json`);
        fs.writeFileSync(localBackupPath, jsonData, 'utf-8');

        // 3. 嘗試觸發 Google Drive 自動備份 (不會阻塞主流程，且內建節流機制)
        triggerAutoBackup();

    } catch (error) {
        console.error('Error saving referral database:', error);
    }
}

// 初始化預設資料
function getOrCreateUserData(address: string, db: Record<string, UserData>) {
    if (!db[address]) {
        db[address] = {
            stats: {
                total: "0 USDT",
                withdrawable: "0 USDT",
                month: "0 USDT",
                friends: 0
            },
            commissions: [],
            referees: [],
            balances: { usdt: 0, bonus: 0 }
        };
        saveDatabase(db);
    }
    return db[address];
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
        return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // 模擬網路延遲
    await new Promise(resolve => setTimeout(resolve, 800));

    const db = loadDatabase();
    const userData = getOrCreateUserData(address, db);
    
    let modified = false;
    for (const c of userData.commissions) {
        if (c.status === 'settled' && !c.signature && c.referee !== 'WITHDRAWAL') {
            c.status = 'pending';
            modified = true;
        }
    }
    
    const settledCommissions = userData.commissions.filter(c => c.status === 'settled' && c.referee !== 'WITHDRAWAL');
    const totalEarned = settledCommissions.reduce((sum, c) => sum + (parseFloat(c.commission) || 0), 0);
    const now = Date.now();
    const monthEarned = settledCommissions.reduce((sum, c) => {
        const ts = Date.parse(c.timestamp);
        if (!Number.isFinite(ts)) return sum;
        if (now - ts > 30 * 24 * 60 * 60 * 1000) return sum;
        return sum + (parseFloat(c.commission) || 0);
    }, 0);
    const withdrawn = userData.commissions
        .filter(c => c.referee === 'WITHDRAWAL' && c.status === 'settled')
        .reduce((sum, c) => sum + Math.abs(parseFloat(c.commission) || 0), 0);
    
    const nextTotal = totalEarned.toFixed(6) + ' USDT';
    const nextMonth = monthEarned.toFixed(6) + ' USDT';
    const nextWithdrawable = Math.max(0, totalEarned - withdrawn).toFixed(6) + ' USDT';
    
    if (userData.stats.total !== nextTotal || userData.stats.month !== nextMonth || userData.stats.withdrawable !== nextWithdrawable) {
        userData.stats.total = nextTotal;
        userData.stats.month = nextMonth;
        userData.stats.withdrawable = nextWithdrawable;
        modified = true;
    }
    
    if (modified) {
        saveDatabase(db);
    }

    return NextResponse.json({ data: userData }, {
        headers: {
            'Cache-Control': 'no-store, max-age=0'
        }
    });
}

// 模擬新增推薦人 (Webhook 或智能合約事件觸發)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const db = loadDatabase();
        
        // 處理投注事件 (鏈上真實拆分轉帳觸發)
        if (body.action === 'place_bet') {
            const { userAddress, referrerAddress: clientReferrer, betAmount, poolAmount, houseAmount, commissionAmount, signature } = body;
            
            if (!userAddress || betAmount === undefined) {
                return NextResponse.json({ error: 'Missing parameters for place_bet' }, { status: 400 });
            }
            
            if (!signature || typeof signature !== 'string') {
                return NextResponse.json({ error: 'Missing signature for place_bet' }, { status: 400 });
            }

            // 使用前端傳來的實際鏈上拆分金額
            const actualPool = typeof poolAmount === 'number' ? poolAmount : betAmount * 0.92;
            const actualHouse = typeof houseAmount === 'number' ? houseAmount : betAmount * 0.056;
            const actualCommission = typeof commissionAmount === 'number' ? commissionAmount : betAmount * 0.024;

            const userData = getOrCreateUserData(userAddress, db);
            
            let referrerAddress = clientReferrer;
            if (!referrerAddress) {
                for (const [addr, data] of Object.entries(db)) {
                    if (data.referees.some(r => r.address === userAddress)) {
                        referrerAddress = addr;
                        break;
                    }
                }
            }
            
            if (referrerAddress && referrerAddress !== userAddress) {
                const referrerData = getOrCreateUserData(referrerAddress, db);
                
                // 尋找對應的 referee 記錄並更新
                const refereeIndex = referrerData.referees.findIndex(r => r.address === userAddress);
                if (refereeIndex !== -1) {
                    const verification = await verifySplitTransfer({
                        signature,
                        userAddress,
                        poolAmount: actualPool,
                        houseAmount: actualHouse,
                        commissionAmount: actualCommission
                    });
                    
                    if (!verification.ok) {
                        referrerData.commissions.unshift({
                            id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            referee: userAddress,
                            betAmount: Number(betAmount).toFixed(6),
                            fee: (actualHouse + actualCommission).toFixed(6),
                            commission: actualCommission.toFixed(6),
                            timestamp: new Date().toISOString(),
                            status: 'pending' as const,
                            signature
                        });
                        saveDatabase(db);
                        return NextResponse.json({ success: false, error: verification.error });
                    }
                    
                    const ref = referrerData.referees[refereeIndex];
                    ref.totalVolumeValue += betAmount;
                    
                    // 使用鏈上實際佣金金額（已透過 SPL Transfer 發送到 COMMISSION_WALLET）
                    const commissionEarned = actualCommission;
                    const platformFee = actualHouse + actualCommission;
                    
                    ref.earnedCommissionValue += commissionEarned;
                    
                    // 建立佣金記錄（含鏈上拆分明細）
                    referrerData.commissions.unshift({
                        id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        referee: userAddress,
                        betAmount: betAmount.toFixed(6),
                        fee: platformFee.toFixed(6),
                        commission: commissionEarned.toFixed(6),
                        timestamp: new Date().toISOString(),
                        status: 'settled' as const,
                        signature
                    });
                    
                    // 更新推薦人的 stats（可提現佣金來自 COMMISSION_WALLET）
                    const prevTotal = parseFloat(referrerData.stats.total) || 0;
                    const prevMonth = parseFloat(referrerData.stats.month) || 0;
                    const prevWithdrawable = parseFloat(referrerData.stats.withdrawable) || 0;
                    
                    referrerData.stats.total = (prevTotal + commissionEarned).toFixed(6) + ' USDT';
                    referrerData.stats.withdrawable = (prevWithdrawable + commissionEarned).toFixed(6) + ' USDT';
                    referrerData.stats.month = (prevMonth + commissionEarned).toFixed(6) + ' USDT';
                    
                    console.log(`[COMMISSION] ✅ ${commissionEarned.toFixed(6)} USDT verified on-chain | Referrer: ${referrerAddress} | Bettor: ${userAddress} | Bet: ${betAmount} USDT`);
                    
                    // 檢查是否達到 3U 門檻且尚未發放獎勵
                    if (ref.totalVolumeValue >= 3 && !ref.rewardIssued) {
                        userData.balances.bonus += 100;
                        ref.rewardIssued = true;
                        console.log(`[REWARD ISSUED] 100U Bonus issued to ${userAddress} for reaching 3U volume (Referred by ${referrerAddress})`);
                    }
                }
                saveDatabase(db);
            } else {
                 // 沒有推薦人 (獨立開戶)，不進行任何體驗金的累計與發放
                 console.log(`[NO REWARD] ${userAddress} placed a bet but has no referrer. No bonus eligible.`);
            }

            return NextResponse.json({ success: true, message: 'Bet processed' });
        }

        // 處理管理員空投體驗金 (Airdrop tUSDT)
        if (body.action === 'airdrop_bonus') {
            const { adminAddress, targetAddress, amount } = body;
            
            // 驗證管理員身份 (這裡簡單寫死，真實環境應透過 JWT 或其他驗證機制)
            if (adminAddress !== '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
            
            if (!targetAddress || !amount || amount <= 0) {
                return NextResponse.json({ error: 'Invalid parameters for airdrop' }, { status: 400 });
            }

            const targetData = getOrCreateUserData(targetAddress, db);
            targetData.balances.bonus += amount;
            
            saveDatabase(db);
            
            console.log(`[ADMIN AIRDROP] Admin ${adminAddress} dropped ${amount} tUSDT to ${targetAddress}`);
            return NextResponse.json({ success: true, message: 'Bonus airdropped successfully', newBalance: targetData.balances.bonus });
        }

        // 處理管理員調節介紹人手續費分成 (Commission Rate)
        if (body.action === 'update_commission_rate') {
            const { adminAddress, targetAddress, rate } = body;

            // 驗證管理員身份
            if (adminAddress !== '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }

            // 驗證 rate 範圍是否在 30% ~ 100% (0.3 ~ 1.0)
            const numericRate = parseFloat(rate);
            if (!targetAddress || isNaN(numericRate) || numericRate < 0.3 || numericRate > 1.0) {
                return NextResponse.json({ error: 'Invalid parameters. Rate must be between 0.3 and 1.0 (30% - 100%)' }, { status: 400 });
            }

            const targetData = getOrCreateUserData(targetAddress, db);
            targetData.commissionRate = numericRate;
            
            saveDatabase(db);
            
            console.log(`[ADMIN COMMISSION] Admin ${adminAddress} updated ${targetAddress} commission rate to ${numericRate * 100}%`);
            return NextResponse.json({ success: true, message: `Commission rate updated to ${numericRate * 100}%`, newRate: numericRate });
        }

        // 原有的綁定推薦人邏輯
        const { address, newRefereeAddress } = body;

        if (!address && !body.action) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }
        
        // 如果沒有 action，代表是舊的綁定推薦人邏輯
        if (!body.action && address && newRefereeAddress) {
            const userData = getOrCreateUserData(address, db);
            
            // 新增一個 Referee
            userData.referees.unshift({
                id: `ref-new-${Date.now()}`,
                address: newRefereeAddress,
                joinDateValue: 0, // 0 days ago (just now)
                totalVolumeValue: 0,
                earnedCommissionValue: 0,
                rewardIssued: false
            });

            userData.stats.friends += 1;
            saveDatabase(db);

            return NextResponse.json({ success: true, data: userData });
        }

        // 獲取所有推薦人的排行榜 (僅限管理員)
        if (body.action === 'withdraw_commission') {
            const { userAddress, amount } = body;
            
            if (!userAddress || !amount || amount <= 0) {
                return NextResponse.json({ error: 'Invalid parameters for withdrawal' }, { status: 400 });
            }

            const userData = getOrCreateUserData(userAddress, db);
            const currentWithdrawable = parseFloat(userData.stats.withdrawable) || 0;
            
            if (amount > currentWithdrawable) {
                return NextResponse.json({ error: 'Insufficient withdrawable balance' }, { status: 400 });
            }
            
            const newWithdrawable = currentWithdrawable - amount;
            userData.stats.withdrawable = newWithdrawable.toFixed(6) + ' USDT';
            
            const withdrawalRecord = {
                id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                referee: 'WITHDRAWAL',
                betAmount: '0.000000',
                fee: amount.toFixed(6),
                commission: (-amount).toFixed(6),
                timestamp: new Date().toISOString(),
                status: 'settled' as const
            };
            userData.commissions.unshift(withdrawalRecord);
            
            saveDatabase(db);
            
            console.log(`[WITHDRAW] ${userAddress} requested withdrawal of ${amount} USDT. Remaining: ${userData.stats.withdrawable}`);
            return NextResponse.json({ success: true, message: 'Withdrawal recorded', newBalance: userData.stats.withdrawable });
        }

        if (body.action === 'get_leaderboard') {
            const { adminAddress } = body;
            
            if (adminAddress !== '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }

            const leaderboard = Object.entries(db).map(([userAddress, data]) => {
                const totalEarned = data.referees.reduce((sum, r) => sum + r.earnedCommissionValue, 0);
                return {
                    address: userAddress,
                    friends: data.stats.friends,
                    totalEarned: totalEarned,
                    commissionRate: data.commissionRate || 0.3
                };
            });

            // 依據推薦人數排序，人數相同則依據賺取佣金排序
            leaderboard.sort((a, b) => {
                if (b.friends !== a.friends) return b.friends - a.friends;
                return b.totalEarned - a.totalEarned;
            });

            // 過濾掉沒有推薦人的紀錄 (可選)
            const activeLeaderboard = leaderboard.filter(item => item.friends > 0);

            return NextResponse.json({ success: true, data: activeLeaderboard });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
