import { useEffect, useState, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } from '@solana/web3.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, AlertTriangle, TrendingUp, Search, DollarSign, Activity, ShieldCheck, Download, Filter, ArrowUpDown, PiggyBank } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { useLanguage } from '@/components/LanguageProvider';

// IDL for parsing market accounts
const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');

interface MarketData {
  pubkey: string;
  matchId: number;
  status: number;
  poolHome: number;
  poolDraw: number;
  poolAway: number;
  totalPool: number;
  bettorCount: number;
}

const COLORS = ['#9945FF', '#14F195', '#F5A623']; // Solana Purple, Solana Green, Orange

interface LeaderboardEntry {
  address: string;
  friends: number;
  totalEarned: number;
  commissionRate: number;
}

export function AdminDashboard() {
  const { t } = useLanguage();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'volume' | 'bettors' | 'id'>('volume');
  
  // Airdrop State
  const [airdropAddress, setAirdropAddress] = useState('');
  const [airdropAmount, setAirdropAmount] = useState('');
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [airdropStatus, setAirdropStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Commission Rate State
  const [rateAddress, setRateAddress] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [rateStatus, setRateStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true);

  // Reserve State
  const [totalReserve, setTotalReserve] = useState(0);

  // Real Stats from file DB
  const [realStats, setRealStats] = useState<{ totalVolume: number; totalBets: number; totalBettors: number } | null>(null);

  // Match Bet Details from file DB
  const [matchDetails, setMatchDetails] = useState<{
    matchId: string; matchName: string;
    homeAmount: number; drawAmount: number; awayAmount: number;
    totalPool: number; bettorCount: number;
  }[]>([]);
  const [isMatchDetailsLoading, setIsMatchDetailsLoading] = useState(true);

  // Payout State
  const [payoutData, setPayoutData] = useState<{ payouts: any[]; totalOwed: number; count: number } | null>(null);
  const [isPayoutLoading, setIsPayoutLoading] = useState(false);

  const fetchPayouts = async () => {
    setIsPayoutLoading(true);
    try {
      const res = await fetch("/api/admin/payout");
      const data = await res.json();
      if (data.success) setPayoutData(data);
    } catch (err) {
      console.error("Failed to fetch payouts", err);
    } finally {
      setIsPayoutLoading(false);
    }
  };

  const markAllPaid = async () => {
    try {
      const res = await fetch("/api/admin/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid" }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`已標記 ${data.marked} 筆為已付款。\n\n請用 Admin 錢包手動發送 USDT 給以下贏家。`);
        fetchPayouts();
      }
    } catch (err) {
      console.error("Failed to mark paid", err);
    }
  };

  const archiveOldBets = async () => {
    try {
      const res = await fetch("/api/admin/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive_old_bets" }),
      });
      const data = await res.json();
      alert(data.message || `已封存 ${data.archived} 筆。`);
      fetchPayouts();
    } catch (err) {
      console.error("Failed to archive", err);
    }
  };

  const markLegacyWins = async () => {
    if (!confirm("確定標記舊架構贏家注單為已處理？\n\n這些注單的資金在舊 Pool ATA，需從 Admin Phantom 手動發送 USDT 給贏家。")) return;
    try {
      const res = await fetch("/api/admin/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_legacy_wins" }),
      });
      const data = await res.json();
      alert(data.message || `已標記 ${data.marked} 筆。`);
      fetchPayouts();
    } catch (err) {
      console.error("Failed to mark legacy wins", err);
    }
  };

  // ATA Init State
  const [ataInitStatus, setAtaInitStatus] = useState<'idle' | 'checking' | 'creating' | 'done' | 'error'>('idle');
  const [ataCheckResult, setAtaCheckResult] = useState<{ existing: string[]; needed: string[] } | null>(null);

  const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
  const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOC_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const ADMIN_ADDRESS = new PublicKey("2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K");

  function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
    const [ata] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
      ASSOC_TOKEN_PROGRAM
    );
    return ata;
  }

  const DESTINATION_ATAS = [
    { label: "Admin (所有資金統一收款)", owner: ADMIN_ADDRESS },
  ].map(d => ({ ...d, ata: findAta(USDT_MINT, d.owner) }));

  const checkAtas = async () => {
    setAtaInitStatus('checking');
    const existing: string[] = [];
    const needed: string[] = [];
    for (const { label, ata } of DESTINATION_ATAS) {
      try {
        const body = JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getAccountInfo",
          params: [ata.toBase58(), { commitment: "confirmed", encoding: "base64" }],
        });
        const res = await fetch("/api/rpc", {
          method: "POST", headers: { "Content-Type": "application/json" }, body,
        });
        if (!res.ok) { needed.push(label); continue; }
        const raw = await res.json();
        const dataArr = raw?.result?.value?.data;
        if (!dataArr) { needed.push(label); continue; }
        const b64 = Array.isArray(dataArr) ? dataArr[0] : dataArr;
        if (!b64 || typeof b64 !== "string") { needed.push(label); continue; }
        const bytes = Buffer.from(b64, "base64");
        if (bytes.length < 72) { needed.push(label); continue; }
        existing.push(label);
      } catch {
        needed.push(label);
      }
    }
    setAtaCheckResult({ existing, needed });
    setAtaInitStatus('idle');
  };

  const createAtas = async () => {
    if (!ataCheckResult || ataCheckResult.needed.length === 0) return;
    const provider = (window as any)?.solana;
    if (!provider?.signAndSendTransaction) {
      setAtaInitStatus('error');
      return;
    }
    setAtaInitStatus('creating');
    try {
      const blockhashBody = JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getLatestBlockhash",
        params: [{ commitment: "finalized" }],
      });
      const bhRes = await fetch("/api/rpc", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: blockhashBody,
      });
      const bhJson = await bhRes.json();
      const blockhash = bhJson?.result?.value?.blockhash;
      if (!blockhash) throw new Error("No blockhash");

      const tx = new Transaction();
      tx.feePayer = publicKey!;
      tx.recentBlockhash = blockhash;
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));

      const neededEntries = ataCheckResult.needed
        .map(label => DESTINATION_ATAS.find(d => d.label === label)!)
        .filter(Boolean);

      for (const { ata, owner } of neededEntries) {
        tx.add(new TransactionInstruction({
          keys: [
            { pubkey: publicKey!, isSigner: true, isWritable: true },
            { pubkey: ata, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: false, isWritable: false },
            { pubkey: USDT_MINT, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
          ],
          programId: ASSOC_TOKEN_PROGRAM,
          data: Buffer.alloc(0),
        }));
      }

      provider.signAndSendTransaction(tx, { skipPreflight: false })
        .then(() => {
          setAtaInitStatus('done');
          setTimeout(() => checkAtas(), 3000);
        })
        .catch((err: any) => {
          if (err?.message?.includes?.("User rejected") || err?.code === 4001) {
            setAtaInitStatus('idle');
          } else {
            console.error("ATA init failed:", err);
            setAtaInitStatus('error');
          }
        });
    } catch (err) {
      console.error("ATA init failed:", err);
      setAtaInitStatus('error');
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_leaderboard',
          adminAddress: publicKey?.toBase58() || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      fetchLeaderboard();
    }
  }, [publicKey]);

  const handleAirdrop = async () => {
    if (!airdropAddress || !airdropAmount) {
      setAirdropStatus({ type: 'error', msg: '請填寫目標地址與金額' });
      return;
    }
    setIsAirdropping(true);
    setAirdropStatus(null);
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'airdrop_bonus',
          adminAddress: publicKey?.toBase58() || '',
          targetAddress: airdropAddress,
          amount: parseFloat(airdropAmount)
        })
      });
      const data = await res.json();
      if (data.success) {
        setAirdropStatus({ type: 'success', msg: `成功發放 ${airdropAmount} tUSDT！` });
        setAirdropAddress('');
        setAirdropAmount('');
      } else {
        setAirdropStatus({ type: 'error', msg: data.error || '發放失敗' });
      }
    } catch (err) {
      setAirdropStatus({ type: 'error', msg: '網路錯誤' });
    } finally {
      setIsAirdropping(false);
      setTimeout(() => setAirdropStatus(null), 5000);
    }
  };

  const handleUpdateCommissionRate = async () => {
    if (!rateAddress || !commissionRate) {
      setRateStatus({ type: 'error', msg: '請填寫目標地址與分成比例' });
      return;
    }
    
    const rateValue = parseFloat(commissionRate) / 100;
    if (isNaN(rateValue) || rateValue < 0.3 || rateValue > 1.0) {
        setRateStatus({ type: 'error', msg: '分成比例必須在 30% 到 100% 之間' });
        return;
    }

    setIsUpdatingRate(true);
    setRateStatus(null);
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_commission_rate',
          adminAddress: publicKey?.toBase58() || '',
          targetAddress: rateAddress,
          rate: rateValue
        })
      });
      const data = await res.json();
      if (data.success) {
        setRateStatus({ type: 'success', msg: data.message });
        setRateAddress('');
        setCommissionRate('');
        fetchLeaderboard(); // 重新整理排行榜以反映新的分成比例
      } else {
        setRateStatus({ type: 'error', msg: data.error || '設定失敗' });
      }
    } catch (err) {
      setRateStatus({ type: 'error', msg: '網路錯誤' });
    } finally {
      setIsUpdatingRate(false);
      setTimeout(() => setRateStatus(null), 5000);
    }
  };

  // Poll for market updates every 2.5s (satisfies < 3s requirement)
  useEffect(() => {
    let isMounted = true;
    
    const fetchMarkets = async () => {
      try {
        // Fetch all accounts owned by the program. 
        // We filter for the "market" discriminator (first 8 bytes).
        // Since we don't have the full IDL here, we can manually parse the basic layout
        // or just mock it safely if parsing is too complex without full IDL.
        // Layout: 8 (disc) + 32 (authority) + 32 (oracle_authority) + 8 (match_id) + 8 (start_time) + 1 (status) + 2 (result) + 8 (home) + 8 (draw) + 8 (away) + 1 (bump) + 8 (bettor_count)
        const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
          filters: [
            { dataSize: 124 }, // Exact size of Market account based on updated struct
          ]
        });

        const parsedMarkets: MarketData[] = accounts.map(acc => {
          const data = acc.account.data;
          const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
          // match_id is at offset 8+32+32 = 72
          const matchId = Number(dataView.getBigUint64(72, true));
          // status is at offset 72+8+8 = 88
          const status = dataView.getUint8(88);
          // pools are at 88 + 1 + 2 = 91
          const poolHome = Number(dataView.getBigUint64(91, true)) / 1e9;
          const poolDraw = Number(dataView.getBigUint64(99, true)) / 1e9;
          const poolAway = Number(dataView.getBigUint64(107, true)) / 1e9;
          // bettor_count at 115 + 1 = 116
          const bettorCount = Number(dataView.getBigUint64(116, true));

          return {
            pubkey: acc.pubkey.toBase58(),
            matchId,
            status,
            poolHome,
            poolDraw,
            poolAway,
            totalPool: poolHome + poolDraw + poolAway,
            bettorCount
          };
        });

        if (isMounted) {
          // Check if there's an active local validator with data
          if (parsedMarkets.length === 0) {
            setMarkets([]); // Set to empty instead of mock data
          } else {
            setMarkets(parsedMarkets.sort((a, b) => b.totalPool - a.totalPool));
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch markets:", err);
        // Do not use mock data on error, just show empty
        if (isMounted) {
          setMarkets([]);
          setIsLoading(false);
        }
      }
    };

    fetchMarkets();
    const interval = setInterval(fetchMarkets, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [connection]);

  useEffect(() => {
    const fetchReserve = async () => {
      try {
        const res = await fetch('/api/admin/reserve');
        if (res.ok) {
          const data = await res.json();
          if (data.success) setTotalReserve(data.balance);
        }
      } catch { /* ignore */ }
    };
    fetchReserve();
    const interval = setInterval(fetchReserve, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        if (data.success) {
          setRealStats(data.data);
        }
      } catch { /* ignore */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchMatchDetails = async () => {
      try {
        const res = await fetch('/api/admin/matches');
        const data = await res.json();
        if (data.success) {
          setMatchDetails(data.data);
        }
      } catch { /* ignore */ }
      finally { setIsMatchDetailsLoading(false); }
    };
    fetchMatchDetails();
    const interval = setInterval(fetchMatchDetails, 15000);
    return () => clearInterval(interval);
  }, []);

  // Aggregated Stats
  const { totalVolume, totalBettors, anomalies, concentrationRisk } = useMemo(() => {
    let volume = 0;
    let bettors = 0;
    const anomaliesList: MarketData[] = [];
    const riskStats = { warning: 0, danger: 0, critical: 0 };

    markets.forEach(m => {
      volume += m.totalPool;
      bettors += m.bettorCount;
      
      if (m.totalPool > 1000) {
        const maxRatio = Math.max(m.poolHome, m.poolDraw, m.poolAway) / m.totalPool;
        if (maxRatio >= 0.85) {
          anomaliesList.push(m);
          riskStats.critical++;
        } else if (maxRatio >= 0.75) {
          anomaliesList.push(m);
          riskStats.danger++;
        } else if (maxRatio >= 0.60) {
          riskStats.warning++;
        }
      }
    });

    return { totalVolume: volume, totalBettors: bettors, anomalies: anomaliesList, concentrationRisk: riskStats };
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    let result = markets.filter(m => m.matchId.toString().includes(searchQuery));
    
    if (showAnomaliesOnly) {
        result = result.filter(m => anomalies.some(a => a.matchId === m.matchId));
    }

    return result.sort((a, b) => {
        if (sortBy === 'volume') return b.totalPool - a.totalPool;
        if (sortBy === 'bettors') return b.bettorCount - a.bettorCount;
        return b.matchId - a.matchId;
    });
  }, [markets, searchQuery, showAnomaliesOnly, sortBy, anomalies]);

  const exportToCSV = () => {
    const headers = ['Match ID', 'Total Pool (USDT)', 'Home Pool', 'Draw Pool', 'Away Pool', 'Bettors', 'Status', 'Is Anomaly'];
    const rows = filteredMarkets.map(m => [
      m.matchId, 
      m.totalPool.toFixed(2), 
      m.poolHome.toFixed(2), 
      m.poolDraw.toFixed(2), 
      m.poolAway.toFixed(2), 
      m.bettorCount, 
      m.status,
      anomalies.some(a => a.matchId === m.matchId) ? 'Yes' : 'No'
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `admin_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const chartData = useMemo(() => {
    return [
      { name: 'Home', value: markets.reduce((acc, m) => acc + m.poolHome, 0) },
      { name: 'Draw', value: markets.reduce((acc, m) => acc + m.poolDraw, 0) },
      { name: 'Away', value: markets.reduce((acc, m) => acc + m.poolAway, 0) }
    ];
  }, [markets]);

  return (
    <div className="w-full text-white p-6 pb-24 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary-purple to-solana-green flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary-purple" />
            {t('admin.title')}
          </h1>
          <p className="text-neutral-400 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse"></span>
            {t('admin.monitoring')}
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-neutral-800/50 p-2 rounded-2xl border border-neutral-700/50 backdrop-blur-sm">
          <div className="flex flex-col items-end pr-4 border-r border-neutral-700">
            <span className="text-xs text-neutral-500">{t('admin.wallet')}</span>
            <span className="text-sm font-mono text-primary-purple font-bold">
              {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
            </span>
          </div>
          <div className="px-2">
            <div className="bg-primary-purple/20 text-primary-purple px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-primary-purple/30">
              {t('admin.mode')}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md hover:bg-neutral-800/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-400">{t('admin.airdrop.title')}</CardTitle>
            <DollarSign className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-2">
              <Input 
                placeholder={t('admin.airdrop.target')} 
                value={airdropAddress} 
                onChange={(e) => setAirdropAddress(e.target.value)} 
                className="bg-neutral-950/50 border-neutral-700 text-xs h-8" 
              />
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  placeholder={t('admin.airdrop.amount')} 
                  value={airdropAmount} 
                  onChange={(e) => setAirdropAmount(e.target.value)} 
                  className="bg-neutral-950/50 border-neutral-700 text-xs h-8 w-1/2" 
                />
                <Button 
                  onClick={handleAirdrop} 
                  disabled={isAirdropping} 
                  className="h-8 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isAirdropping ? t('admin.airdrop.processing') : t('admin.airdrop.btn')}
                </Button>
              </div>
              {airdropStatus && (
                <div className={`text-xs mt-1 p-1.5 rounded-md ${airdropStatus.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {airdropStatus.msg}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 新增：調節推薦手續費分成 */}
        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md hover:bg-neutral-800/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-400">{t('admin.rate.title')}</CardTitle>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-2">
              <Input 
                placeholder={t('admin.rate.target')} 
                value={rateAddress} 
                onChange={(e) => setRateAddress(e.target.value)} 
                className="bg-neutral-950/50 border-neutral-700 text-xs h-8" 
              />
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  min="30"
                  max="100"
                  placeholder={t('admin.rate.amount')} 
                  value={commissionRate} 
                  onChange={(e) => setCommissionRate(e.target.value)} 
                  className="bg-neutral-950/50 border-neutral-700 text-xs h-8 w-1/2" 
                />
                <Button 
                  onClick={handleUpdateCommissionRate} 
                  disabled={isUpdatingRate} 
                  className="h-8 text-xs flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isUpdatingRate ? t('admin.rate.processing') : t('admin.rate.btn')}
                </Button>
              </div>
              {rateStatus && (
                <div className={`text-xs mt-1 p-1.5 rounded-md ${rateStatus.type === 'success' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                  {rateStatus.msg}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-neutral-400 text-sm font-medium mb-1">{t('admin.stats.volume')}</p>
                <h3 className="text-4xl font-black text-white">${(realStats?.totalVolume ?? totalVolume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
              </div>
              <div className="p-3 bg-solana-green/20 rounded-2xl">
                <DollarSign className="w-6 h-6 text-solana-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-neutral-400 text-sm font-medium mb-1">{t('admin.stats.bettors')}</p>
                <h3 className="text-4xl font-black text-white">{(realStats?.totalBettors ?? totalBettors).toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-primary-purple/20 rounded-2xl">
                <Activity className="w-6 h-6 text-primary-purple" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md ${anomalies.length > 0 ? 'ring-1 ring-red-500/50' : ''}`}>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-neutral-400 text-sm font-medium mb-1">{t('admin.stats.anomalies')}</p>
                <h3 className={`text-4xl font-black ${anomalies.length > 0 ? 'text-red-400' : 'text-white'}`}>
                  {anomalies.length}
                </h3>
              </div>
              <div className={`p-3 rounded-2xl ${anomalies.length > 0 ? 'bg-red-500/20' : 'bg-neutral-800'}`}>
                <AlertTriangle className={`w-6 h-6 ${anomalies.length > 0 ? 'text-red-500' : 'text-neutral-500'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-neutral-400 text-sm font-medium mb-1">集中度風險</p>
                <div className="flex gap-3 mt-1">
                  <div className="text-center">
                    <span className="text-2xl font-black text-amber-400">{concentrationRisk.warning}</span>
                    <p className="text-[10px] text-neutral-500">⚠60%+</p>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-black text-orange-400">{concentrationRisk.danger}</span>
                    <p className="text-[10px] text-neutral-500">⚡75%+</p>
                  </div>
                  <div className="text-center">
                    <span className="text-2xl font-black text-red-400">{concentrationRisk.critical}</span>
                    <p className="text-[10px] text-neutral-500">🚫85%+</p>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-amber-500/20 rounded-2xl">
                <ShieldCheck className={`w-6 h-6 ${concentrationRisk.critical > 0 ? 'text-red-500' : concentrationRisk.danger > 0 ? 'text-orange-500' : 'text-amber-500'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/30 border border-emerald-500/20 rounded-3xl backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-neutral-400 text-sm font-medium mb-1">平台儲備池</p>
                <h3 className="text-4xl font-black text-emerald-400">${totalReserve.toFixed(6)}</h3>
                <p className="text-[10px] text-neutral-500 mt-1">由 8% 抽水累積 · 用於應急 + 促銷</p>
              </div>
              <div className="p-3 bg-emerald-500/20 rounded-2xl">
                <PiggyBank className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Global Distribution Chart */}
        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary-purple" />
              {t('admin.chart.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: any) => [`$${(value || 0).toFixed(2)}`, 'Volume']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#9945FF]"></span> {t('admin.chart.home')}</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#14F195]"></span> {t('admin.chart.draw')}</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#F5A623]"></span> {t('admin.chart.away')}</div>
            </div>
          </CardContent>
        </Card>

        {/* Market List */}
        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 gap-4">
            <CardTitle className="text-lg font-bold">{t('admin.market.title')}</CardTitle>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input 
                  placeholder={t('admin.market.search')} 
                  className="pl-9 bg-neutral-950/50 border-neutral-700 text-sm h-9 rounded-xl focus-visible:ring-primary-purple"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <button 
                onClick={() => setShowAnomaliesOnly(!showAnomaliesOnly)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${showAnomaliesOnly ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-neutral-950/50 text-neutral-400 border-neutral-700 hover:text-neutral-200'}`}
              >
                <Filter className="w-4 h-4" />
                {t('admin.market.anomalies')}
              </button>

              <select 
                className="bg-neutral-950/50 border border-neutral-700 text-neutral-300 text-sm rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary-purple appearance-none cursor-pointer"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="volume">{t('admin.market.sort.volume')}</option>
                <option value="bettors">{t('admin.market.sort.bettors')}</option>
                <option value="id">{t('admin.market.sort.id')}</option>
              </select>

              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary-purple/10 text-primary-purple border border-primary-purple/30 hover:bg-primary-purple hover:text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                {t('admin.market.export')}
              </button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-[400px] pr-2">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-neutral-500">
                <div className="animate-spin w-8 h-8 border-4 border-primary-purple border-t-transparent rounded-full"></div>
              </div>
            ) : filteredMarkets.length === 0 ? (
              <div className="h-full flex items-center justify-center text-neutral-500">
                {t('admin.market.empty')}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMarkets.map((market) => {
                  const isAnomaly = anomalies.some(a => a.matchId === market.matchId);
                  const maxRatio = market.totalPool > 0 ? Math.max(market.poolHome, market.poolDraw, market.poolAway) / market.totalPool : 0;
                  const concLabel = maxRatio >= 0.85 ? '🚫 85%+' : maxRatio >= 0.75 ? '⚡ 75%+' : maxRatio >= 0.60 ? '⚠ 60%+' : null;
                  
                  return (
                    <div key={market.pubkey} className={`p-4 rounded-xl border ${isAnomaly ? 'bg-red-500/5 border-red-500/30' : 'bg-neutral-950 border-neutral-800'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-lg font-bold">{t('admin.market.match')}{market.matchId}</span>
                          {isAnomaly && (
                            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              {t('admin.market.skewed')}
                            </span>
                          )}
                          {concLabel && (
                            <span className={'text-xs px-2 py-1 rounded-full ' + (maxRatio >= 0.85 ? 'bg-red-500/10 text-red-400' : maxRatio >= 0.75 ? 'bg-orange-500/10 text-orange-400' : 'bg-amber-500/10 text-amber-400')}>
                              {concLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-neutral-400">{t('admin.market.pool')}</div>
                          <div className="font-bold text-solana-green">${market.totalPool.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                      
                      {/* Distribution Bar */}
                      <div className="h-4 w-full rounded-full overflow-hidden flex bg-neutral-800">
                        {market.totalPool > 0 ? (
                          <>
                            <div style={{ width: `${(market.poolHome / market.totalPool) * 100}%` }} className="bg-[#9945FF] transition-all duration-500"></div>
                            <div style={{ width: `${(market.poolDraw / market.totalPool) * 100}%` }} className="bg-[#14F195] transition-all duration-500"></div>
                            <div style={{ width: `${(market.poolAway / market.totalPool) * 100}%` }} className="bg-[#F5A623] transition-all duration-500"></div>
                          </>
                        ) : (
                          <div className="w-full bg-neutral-800"></div>
                        )}
                      </div>
                      
                      <div className="flex justify-between mt-2 text-xs font-mono text-neutral-400">
                        <span className="text-[#9945FF]">{market.totalPool > 0 ? ((market.poolHome / market.totalPool) * 100).toFixed(1) : 0}% Home</span>
                        <span className="text-[#14F195]">{market.totalPool > 0 ? ((market.poolDraw / market.totalPool) * 100).toFixed(1) : 0}% Draw</span>
                        <span className="text-[#F5A623]">{market.totalPool > 0 ? ((market.poolAway / market.totalPool) * 100).toFixed(1) : 0}% Away</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 賽事投注明細 */}
      <div className="mt-8">
        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {t('admin.matchdetail.title')}
            </CardTitle>
            <span className="text-xs text-neutral-500">{matchDetails.length} {t('admin.matchdetail.match').toLowerCase()}</span>
          </CardHeader>
          <CardContent>
            {isMatchDetailsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary-purple border-t-transparent rounded-full"></div>
              </div>
            ) : matchDetails.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                {t('admin.matchdetail.empty')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-neutral-400 uppercase bg-neutral-900/50 border-b border-neutral-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('admin.matchdetail.match')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('admin.matchdetail.home')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('admin.matchdetail.draw')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('admin.matchdetail.away')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('admin.matchdetail.pool')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('admin.matchdetail.bettors')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {matchDetails.map((m) => {
                      const maxAmount = Math.max(m.homeAmount, m.drawAmount, m.awayAmount, 1);
                      return (
                        <tr key={m.matchId} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white text-xs">{m.matchName}</div>
                            <div className="text-[10px] text-neutral-500 font-mono">#{m.matchId}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 max-w-[60px] h-1.5 rounded-full overflow-hidden bg-neutral-800">
                                <div className="h-full bg-[#9945FF] rounded-full transition-all" style={{ width: `${(m.homeAmount / maxAmount) * 100}%` }} />
                              </div>
                              <span className="text-[#9945FF] font-mono font-bold text-xs w-14 text-right">${m.homeAmount.toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 max-w-[60px] h-1.5 rounded-full overflow-hidden bg-neutral-800">
                                <div className="h-full bg-[#14F195] rounded-full transition-all" style={{ width: `${(m.drawAmount / maxAmount) * 100}%` }} />
                              </div>
                              <span className="text-[#14F195] font-mono font-bold text-xs w-14 text-right">${m.drawAmount.toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 max-w-[60px] h-1.5 rounded-full overflow-hidden bg-neutral-800">
                                <div className="h-full bg-[#F5A623] rounded-full transition-all" style={{ width: `${(m.awayAmount / maxAmount) * 100}%` }} />
                              </div>
                              <span className="text-[#F5A623] font-mono font-bold text-xs w-14 text-right">${m.awayAmount.toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-solana-green font-mono font-bold">${m.totalPool.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-neutral-300 font-mono text-xs">{m.bettorCount}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 派彩面板 */}
      <div className="mt-8">
        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-solana-green" />
              贏家派彩（Winning Payouts）
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={fetchPayouts} variant="outline" size="sm" className="h-8 text-xs bg-neutral-900 border-neutral-700">
                刷新
              </Button>
              <Button onClick={archiveOldBets} variant="outline" size="sm" className="h-8 text-xs bg-neutral-900 border-neutral-700 text-amber-400">
                🗄 封存舊測試
              </Button>
              <Button onClick={markLegacyWins} variant="outline" size="sm" className="h-8 text-xs bg-neutral-900 border-neutral-700 text-red-400">
                ⚠ 標記舊贏家
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-400 text-sm mb-4">
              顯示所有待支付的贏家。所有投注 USDT 已存放在 Admin ATA（<span className="font-mono text-xs text-primary-purple break-all">6WJGh5BtWgBWaDcq6kBoZT3zNVsjQ4aFqBadXYzAwpgw</span>），Admin 需手動發送 USDT 給以下贏家。
            </p>

            {isPayoutLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary-purple border-t-transparent rounded-full"></div>
              </div>
            ) : payoutData === null ? (
              <div className="text-center py-8">
                <Button onClick={fetchPayouts} className="bg-primary-purple hover:bg-primary-purple/80 text-white">
                  查詢待派彩注單
                </Button>
              </div>
            ) : payoutData.payouts.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-solana-green" />
                暫無待派彩注單（全部已支付）
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4 p-3 bg-solana-green/10 border border-solana-green/30 rounded-lg">
                  <span className="text-sm text-neutral-300">待支付總額</span>
                  <span className="text-xl font-bold text-solana-green">${payoutData.totalOwed.toFixed(4)} USDT</span>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {payoutData.payouts.map((p: any, i: number) => (
                    <div key={p.betId} className={`p-3 rounded-lg border flex justify-between items-center ${p.type === "refund" ? "border-yellow-500/30 bg-yellow-500/5" : "border-neutral-700 bg-neutral-900/50"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-sm text-white truncate">{p.matchName}</div>
                          {p.type === "refund" && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold">↩ 退款</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${p.outcome === "home" ? "bg-purple-500/20 text-purple-400" : p.outcome === "draw" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                            {p.outcome === "home" ? "主勝" : p.outcome === "draw" ? "和" : "客勝"}
                          </span>
                          {p.type !== "refund" && <span className="text-xs text-neutral-500">賠率 {p.odds.toFixed(2)}x</span>}
                          <span className="text-xs text-neutral-500">本金 ${p.betAmount.toFixed(4)}</span>
                        </div>
                        <div className="font-mono text-xs text-neutral-500 mt-0.5 truncate">{p.userAddress}</div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className={`text-sm font-bold ${p.type === "refund" ? "text-yellow-400" : "text-solana-green"}`}>
                          +${p.winAmount.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={markAllPaid}
                  className="w-full mt-4 bg-solana-green hover:bg-solana-green/80 text-neutral-900 font-bold py-3 text-base"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  標記全部已付款（{payoutData.count} 筆）
                </Button>
                <p className="text-xs text-neutral-500 text-center mt-2">
                  ⚠ 此操作僅標記 DB 狀態。請手動從 Admin ATA 發送 USDT 給每位贏家地址。
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ATA 初始化區塊 */}
      <div className="mt-8">
        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-primary-purple" />
              收款 ATA 初始化（一次性）
            </CardTitle>
            {ataInitStatus === 'idle' ? (
              <Button onClick={checkAtas} variant="outline" size="sm" className="h-8 text-xs bg-neutral-900 border-neutral-700">
                檢查 ATA 狀態
              </Button>
            ) : ataInitStatus === 'checking' ? (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <div className="animate-spin w-4 h-4 border-2 border-primary-purple border-t-transparent rounded-full"></div>
                檢查中...
              </div>
            ) : ataInitStatus === 'creating' ? (
              <div className="flex items-center gap-2 text-sm text-yellow-400">
                <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                請在 Phantom 確認交易...
              </div>
            ) : ataInitStatus === 'done' ? (
              <span className="text-sm text-solana-green font-bold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> 全部已初始化
              </span>
            ) : (
              <span className="text-sm text-red-400">發生錯誤，請重試</span>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-neutral-400 text-sm mb-4">
              為 Admin 地址建立 USDT 收款帳戶（Associated Token Account）。只需執行一次（約 ~0.002 SOL），之後所有用戶投注都無需再付 ATA 創建費。所有資金（獎池 + 手續費 + 佣金）統一發到這個地址。
            </p>

            {ataCheckResult && (
              <div className="space-y-3">
                {DESTINATION_ATAS.map(({ label, ata }) => {
                  const exists = ataCheckResult.existing.includes(label);
                  const isNeeded = ataCheckResult.needed.includes(label);
                  return (
                    <div key={label} className={`p-3 rounded-lg border flex justify-between items-center ${exists ? 'border-solana-green/30 bg-solana-green/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
                      <div>
                        <div className="font-bold text-sm">{label}</div>
                        <div className="font-mono text-xs text-neutral-500 mt-0.5">{ata.toBase58()}</div>
                      </div>
                      <div>
                        {exists ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-solana-green/10 text-solana-green font-bold">✅ 已存在</span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 font-bold">⚠ 需建立</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {ataCheckResult.needed.length > 0 && ataInitStatus === 'idle' && (
                  <Button
                    onClick={createAtas}
                    className="w-full mt-4 bg-primary-purple hover:bg-primary-purple/80 text-white font-bold py-3 text-base"
                  >
                    <PiggyBank className="w-4 h-4 mr-2" />
                    建立 {ataCheckResult.needed.length} 個 ATA（約 {(ataCheckResult.needed.length * 0.00204).toFixed(4)} SOL）
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 新增：推薦人排行榜 */}
      <div className="mt-8">
        <Card className="bg-neutral-800/30 border border-neutral-800 rounded-3xl backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {t('admin.leaderboard.title')}
            </CardTitle>
            <Button onClick={fetchLeaderboard} variant="outline" size="sm" className="h-8 text-xs bg-neutral-900 border-neutral-700">
              {t('admin.leaderboard.refresh')}
            </Button>
          </CardHeader>
          <CardContent>
            {isLeaderboardLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary-purple border-t-transparent rounded-full"></div>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">{t('admin.leaderboard.empty')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-neutral-400 uppercase bg-neutral-900/50 border-b border-neutral-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('admin.leaderboard.rank')}</th>
                      <th className="px-4 py-3 font-medium">{t('admin.leaderboard.address')}</th>
                      <th className="px-4 py-3 font-medium text-center">{t('admin.leaderboard.friends')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('admin.leaderboard.earned')}</th>
                      <th className="px-4 py-3 font-medium text-right">{t('admin.leaderboard.rate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {leaderboard.map((entry, index) => (
                      <tr key={entry.address} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-neutral-300">
                          {index < 3 ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' : index === 1 ? 'bg-gray-300/20 text-gray-300' : 'bg-amber-600/20 text-amber-600'}`}>
                              {index + 1}
                            </span>
                          ) : (
                            <span className="pl-2">{index + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-primary-purple">{entry.address}</td>
                        <td className="px-4 py-3 text-center font-bold text-solana-green">{entry.friends}</td>
                        <td className="px-4 py-3 text-right font-mono">${entry.totalEarned.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-blue-400 font-bold">{(entry.commissionRate * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
