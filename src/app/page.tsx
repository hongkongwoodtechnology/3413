
"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletButton } from "@/components/WalletButton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { Trophy, TrendingUp, ShieldCheck, Clock, Search, Filter, AlertTriangle, Menu, X, Globe, Star, ChevronDown, Gift, Newspaper } from "lucide-react"
import { DynamicOddsEngine, type RiskLevel } from "@/lib/odds-engine"
import { LiquidityAnalyzer } from "@/lib/analytics"
import { fetchLiveMatches } from "@/lib/api"
import { Match as BaseMatch } from "@/lib/types"
import Link from "next/link"

// 更新 Match 介面以支援新的 Market Data
type Match = BaseMatch & {
  marketData?: {
    realTotalPool: number
    liabilities: { home: number, draw: number, away: number }
    pools: { home: number, draw: number, away: number }
    seedPools?: { home: number, draw: number, away: number }
    initialOdds: { home: number, draw: number, away: number }
    initialProbs?: { home: number, draw: number, away: number }
  }
}
import { useLanguage } from "@/components/LanguageProvider"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { ReferralModal } from "@/components/ReferralModal"
import { ReferralHandler } from "@/components/ReferralHandler"
import { ReferralLandingPage } from "@/components/ReferralLandingPage"
import { Suspense } from "react"
import { PublicKey, Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js"
import { getUSDTBalance, getTrialUSDTBalance, findAta as findAtaClient } from "@/lib/solana"
import { HOUSE_WALLET, COMMISSION_WALLET, USDT_MINT, USDT_DECIMALS, PLATFORM_FEE_RATE, DEFAULT_COMMISSION_RATE, splitBetAmount } from "@/lib/wallets"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { BonusEventPage } from "@/components/BonusEventPage"
import { NewsSection } from "@/components/NewsSection"
import { NewsDetailPage } from "@/components/NewsDetailPage"
import { NewsCenterPage } from "@/components/NewsCenterPage"

import { TEAM_NAMES, LEAGUES } from "@/lib/dictionaries"

// --- CATEGORY DEFINITIONS ---
const CATEGORIES = [
  { id: 'worldcup', icon: Star },   // 世界盃特區 (優先顯示)
  { id: 'all', icon: Globe },
  { id: 'europe', icon: Trophy },   // 歐洲聯賽冠軍盃, 歐霸盃, 歐洲協會聯賽, 挪威超級聯賽, 俄羅斯盃
  { id: 'england', icon: Trophy },  // 英格蘭冠軍聯賽, 英格蘭甲組聯賽, 英格蘭乙組聯賽
  { id: 'asia', icon: Trophy },     // 亞冠盃2, 卡塔爾超級聯賽, 沙特職業聯賽, 澳洲盃, 日乙, 日丙, 百年構想聯賽, U20女子亞洲盃
  { id: 'americas', icon: Trophy }, // 南美自由盃, 南美球會盃, 中北美洲冠軍盃, 墨西哥超級聯賽, 墨西哥甲組聯賽, 阿根廷盃
];

const INITIAL_MATCHES: Match[] = []

type BetRecord = {
  id: string;
  matchId: number;
  matchName: string;
  outcome: string;
  amount: number;
  odds?: number;
  status?: string;
  useBonus: boolean;
  timestamp: number;
};

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOC_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

function splTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0);
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM,
    data,
  });
}

function createAtaInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    ],
    programId: ASSOC_TOKEN_PROGRAM,
    data: Buffer.alloc(0),
  });
}

const BLOCKHASH_RPCS = [
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.solana.com",
];

const RPC_REQ_BODY = {
  jsonrpc: "2.0",
  id: 1,
  method: "getLatestBlockhash",
  params: [{ commitment: "finalized" }],
};

function parseBlockhash(raw: any): string {
  if (raw?.result?.value?.blockhash) return raw.result.value.blockhash;
  if (raw?.value?.blockhash) return raw.value.blockhash;
  throw new Error("Invalid blockhash response");
}

async function fetchBlockhashDirect(): Promise<string> {
  const body = JSON.stringify(RPC_REQ_BODY);
  const controllers: AbortController[] = [];
  const race = Promise.race(
    BLOCKHASH_RPCS.map((url, i) => {
      const ctrl = new AbortController();
      controllers.push(ctrl);
      const timer = setTimeout(() => ctrl.abort(), 8000);
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      })
        .then(async (res) => {
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return parseBlockhash(await res.json());
        })
        .catch((err) => {
          clearTimeout(timer);
          console.warn(`[Blockhash] Direct RPC ${i} failed:`, err?.message || err);
          throw err;
        });
    })
  );
  try { return await race; }
  finally { controllers.forEach((c) => c.abort()); }
}

async function fetchBlockhashViaProxy(): Promise<string> {
  console.log("[Blockhash] Falling back to server proxy...");
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(RPC_REQ_BODY),
  });
  if (!res.ok) {
    let errMsg = `Proxy HTTP ${res.status}`;
    try { const e = await res.json(); errMsg = e?.error?.message || errMsg; } catch {}
    throw new Error(errMsg);
  }
  return parseBlockhash(await res.json());
}

async function fetchBlockhash(): Promise<string> {
  try {
    console.log("[Blockhash] Trying direct RPC fetch (browser)...");
    return await fetchBlockhashDirect();
  } catch {
    return await fetchBlockhashViaProxy();
  }
}

async function checkAtaExistsViaProxy(ata: PublicKey): Promise<boolean> {
  try {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [ata.toBase58(), { commitment: "confirmed", encoding: "base64" }],
    });
    const res = await fetch("/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) return false;
    const raw = await res.json();
    const dataArr = raw?.result?.value?.data;
    if (!dataArr) return false;
    const base64Str = Array.isArray(dataArr) ? dataArr[0] : dataArr;
    if (!base64Str || typeof base64Str !== "string") return false;
    const bytes = Buffer.from(base64Str, "base64");
    return bytes.length >= 72;
  } catch {
    return false;
  }
}

async function checkAtasNeeded(
  atas: { ata: PublicKey; owner: PublicKey }[]
): Promise<{ ata: PublicKey; owner: PublicKey }[]> {
  const needed: { ata: PublicKey; owner: PublicKey }[] = [];
  for (const { ata, owner } of atas) {
    try {
      if (!(await checkAtaExistsViaProxy(ata))) {
        needed.push({ ata, owner });
      }
    } catch {
      needed.push({ ata, owner });
    }
  }
  return needed;
}

async function getSolBalanceViaProxy(address: string): Promise<number> {
  try {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    });
    const res = await fetch("/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return (raw?.result?.value ?? 0) as number;
  } catch {
    return 0;
  }
}

const ATA_RENT_LAMPORTS = 2039280;
const TX_BASE_FEE = 10000;
const PER_SIG_FEE = 5000;

function estimateAtaCost(numAtas: number): number {
  return numAtas * ATA_RENT_LAMPORTS;
}

function estimateGasCost(numSigs: number): number {
  return TX_BASE_FEE + numSigs * PER_SIG_FEE;
}

export default function Home() {
  const { connected, publicKey } = useWallet()
  const { t, language } = useLanguage()
  const dateLocale = language === 'zh-TW' ? 'zh-TW' : language === 'zh-CN' ? 'zh-CN' : 'en-US'
  const [amount, setAmount] = useState<string>("")
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [txStatus, setTxStatus] = useState<"idle" | "submitting" | "confirming" | "success" | "error">("idle")
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [activeLeague, setActiveLeague] = useState<string | null>(null)
  const [isLeagueMenuOpen, setIsLeagueMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [balance, setBalance] = useState<number>(0)
  const [trialBalance, setTrialBalance] = useState<number>(0)
  const [currentView, setCurrentView] = useState<'matches' | 'bonus_event' | 'news_detail' | 'news_center'>('matches')
  const [counterpartyOffer, setCounterpartyOffer] = useState<{ odds: number } | null>(null)
  
  // State for dynamic pools
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES)
  const [myBets, setMyBets] = useState<BetRecord[]>([])
  const [dateFilter, setDateFilter] = useState<'today' | '3days' | '7days' | '30days' | '3months'>('3months')

  // 檢查是否使用體驗金投注
  const [useBonus, setUseBonus] = useState(false);

  // 管理面板顯示狀態（管理員可切換回使用者介面）
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // 用戶返佣率（由推薦人等級決定：30%/50%/70%）
  const [userCommissionRate, setUserCommissionRate] = useState<number>(DEFAULT_COMMISSION_RATE);

  // 有效返佣率：體驗金投注無佣金（commissionRate=0），真實資金用 userCommissionRate
  const effectiveCommissionRate = useMemo(() => {
    return useBonus ? 0 : userCommissionRate;
  }, [useBonus, userCommissionRate]);

  // Referral Landing Page State
  const [showReferralLanding, setShowReferralLanding] = useState(false);
  const [urlReferrer, setUrlReferrer] = useState<string | null>(null);

  // Parse URL for 'ref' parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('ref');
      if (refParam && !connected) {
        setUrlReferrer(refParam);
        setShowReferralLanding(true);
      }
    }
  }, [connected]);

  // Initialize Engines (0% 利潤率 — 抽水已透過鏈上拆分轉帳實現)
  const oddsEngine = useMemo(() => new DynamicOddsEngine(PLATFORM_FEE_RATE, 200), [])
  const liquidityAnalyzer = useMemo(() => new LiquidityAnalyzer(), [])

  // Admin Check
  const isAdmin = useMemo(() => {
    return connected && publicKey?.toBase58() === '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K';
  }, [connected, publicKey]);

  // Helper to get actual address for Phantom multi-account edge case
  const getActualAddress = () => {
    if (!publicKey) return null;
    let address = publicKey.toBase58();
    if (typeof window !== 'undefined') {
        const provider = (window as any)?.solana;
        if (provider && provider.isPhantom && provider.publicKey) {
            const phantomAddress = provider.publicKey.toBase58();
            if (phantomAddress !== address) {
                return phantomAddress;
            }
        }
    }
    return address;
  };

  // --- BETS FETCHING ---
  useEffect(() => {
    let isMounted = true;
    const fetchBets = async () => {
      const address = getActualAddress();
      if (connected && address) {
        try {
          const res = await fetch(`/api/bets?address=${address}`);
          if (res.ok) {
            const result = await res.json();
            if (isMounted && result.success) {
              setMyBets(result.data);
            }
          }
        } catch (error) {
          console.error('Failed to fetch bets', error);
        }
      } else {
        if (isMounted) {
          setMyBets([]);
        }
      }
    };
    
    fetchBets();
  }, [connected, publicKey]);

  // 用戶返佣率：錢包連接後從 localStorage 讀取推薦人資訊
  useEffect(() => {
    const fetchCommissionRate = async () => {
      const address = getActualAddress();
      if (!connected || !address) {
        setUserCommissionRate(DEFAULT_COMMISSION_RATE);
        return;
      }
      try {
        const storedReferrer = localStorage.getItem(`bound_referrer_${address}`);
        if (storedReferrer) {
          const refRes = await fetch(`/api/referral?address=${storedReferrer}`);
          if (refRes.ok) {
            const refData = await refRes.json();
            const rate = refData.data?.commissionRate;
            if (typeof rate === 'number' && rate >= 0.3 && rate <= 0.7) {
              setUserCommissionRate(rate);
              return;
            }
          }
        }
        setUserCommissionRate(DEFAULT_COMMISSION_RATE);
      } catch {
        setUserCommissionRate(DEFAULT_COMMISSION_RATE);
      }
    };
    fetchCommissionRate();
  }, [connected, publicKey]);

  // --- BALANCE FETCHING ---
  useEffect(() => {
    let isMounted = true;
    const fetchBalance = async () => {
        const address = getActualAddress();
        if (connected && address) {
            try {
                const balRes = await fetch(`/api/balance?address=${address}`);
                const balData = await balRes.json();
                const bal = balData.success ? balData.balance : 0;
                
                const trialBal = await getTrialUSDTBalance(address);
                
                if (isMounted) {
                    setBalance(bal);
                    setTrialBalance(trialBal);
                }
            } catch (error) {
                console.error("Error fetching balances in UI:", error);
                if (isMounted) {
                    setBalance(0);
                    setTrialBalance(0);
                }
            }
        } else {
            if (isMounted) {
                setBalance(0);
                setTrialBalance(0);
            }
        }
    };

    fetchBalance();
    
    // Refresh balance periodically
    const interval = setInterval(fetchBalance, 10000);
    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [connected, publicKey]);


  // --- REAL DATA FETCHING ---
  const loadMatches = async (
    currentLang: string,
    isInitial: boolean = false,
    canSetState?: () => boolean
  ) => {
      if (isInitial) {
          if (!canSetState || canSetState()) {
              setIsLoading(true);
          }
      }
      try {
          const data = await fetchLiveMatches(currentLang);
          if (!canSetState || canSetState()) {
              if (data.length > 0) {
                  setMatches(data);
              } else {
                  setMatches([]);
              }
          }
      } catch (error) {
          const err: any = error;
          const errStr = String(error);
          const isAbort =
            err?.name === 'AbortError' ||
            errStr.includes('AbortError') ||
            errStr.includes('ERR_ABORTED') ||
            errStr.toLowerCase().includes('aborted');
          if (!isAbort) {
              console.error("Failed to load matches", error);
          }
      } finally {
          if (!canSetState || canSetState()) {
              setIsLoading(false);
          }
      }
  };

  useEffect(() => {
    let isMounted = true;

    // Instant optimistic translation of existing matches!
    if (matches.length > 0) {
        setMatches(prevMatches => prevMatches.map(m => {
            const newMatch = { ...m };
            
            // Translate Teams
            const getTeamTrans = (orig: string | undefined) => {
                if (!orig) return null;
                const exact = TEAM_NAMES[orig]?.[language];
                if (exact) return exact;
                const lowerOrig = orig.toLowerCase();
                for (const [key, translations] of Object.entries(TEAM_NAMES)) {
                    if (lowerOrig.includes(key.toLowerCase()) && (translations as any)[language]) {
                        return (translations as any)[language];
                    }
                }
                return orig; // Fallback to original
            };
            
            if (m.homeOriginal) {
                const trans = getTeamTrans(m.homeOriginal);
                if (trans) newMatch.home = trans;
            }
            if (m.awayOriginal) {
                const trans = getTeamTrans(m.awayOriginal);
                if (trans) newMatch.away = trans;
            }
            
            // Translate League
            if (m.leagueOriginal) {
                const leagueMatch = LEAGUES.find(l => {
                    const ln = l.name.toLowerCase();
                    const sn = m.leagueOriginal!.toLowerCase();
                    let matches = ln === sn || ln.includes(sn) || sn.includes(ln);
                    if (!matches && (l as any).aliases) {
                        matches = (l as any).aliases.some((alias: string) => {
                            const aln = alias.toLowerCase();
                            return aln === sn || aln.includes(sn) || sn.includes(aln);
                        });
                    }
                    return matches;
                });
                if (leagueMatch && leagueMatch.names && (leagueMatch.names as any)[language]) {
                    newMatch.league = (leagueMatch.names as any)[language];
                }
            }
            
            return newMatch;
        }));
    }

    // Load matches on language change without always resetting to full loading screen
    let requestSeq = 0;
    const startFetch = async () => {
        const seq = ++requestSeq;
        return loadMatches(language, matches.length === 0, () => isMounted && seq === requestSeq);
    };

    void startFetch();

    // Poll every 15 seconds for live scores
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const pollMs = 15000;
    const canPoll = () => (typeof document === 'undefined' ? true : document.visibilityState === 'visible');
    const onVisibilityChange = () => {
        if (canPoll()) {
            void startFetch();
        }
    };
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
    }

    const poll = async () => {
        if (!isMounted) return;
        if (!canPoll()) {
            timeoutId = setTimeout(poll, pollMs);
            return;
        }
        if (inFlight) {
            timeoutId = setTimeout(poll, pollMs);
            return;
        }

        inFlight = true;
        try {
            const seq = ++requestSeq;
            const data = await fetchLiveMatches(language);
            if (isMounted && seq === requestSeq && data.length > 0) {
                setMatches(data);
            }
        } catch (e) {
            const err: any = e;
            const errStr = String(e);
            const isAbort =
              err?.name === 'AbortError' ||
              errStr.includes('AbortError') ||
              errStr.includes('ERR_ABORTED') ||
              errStr.toLowerCase().includes('aborted');
            if (!isAbort) {
                console.error("Background fetch failed", e);
            }
        } finally {
            inFlight = false;
            if (isMounted) {
                timeoutId = setTimeout(poll, pollMs);
            }
        }
    };

    timeoutId = setTimeout(poll, pollMs);

    return () => {
        isMounted = false;
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        }
        if (timeoutId) clearTimeout(timeoutId);
    };
  }, [language]);

  // Derived state for the currently selected match
  const currentMatch = matches.find(m => m.id === selectedMatchId)

  const visibleMatches = useMemo(() => {
    return matches.filter(m => m.status !== 'finished');
  }, [matches]);

  // Filter matches based on category, league, and search
  const filteredMatches = useMemo(() => {
    const filtered = visibleMatches.filter(match => {
      const matchesCategory = activeCategory === 'all' || match.category === activeCategory;
      const matchesLeague = !activeLeague || match.league === activeLeague;
      const matchesSearch = match.home.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            match.away.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            match.league.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesLeague && matchesSearch;
    });

    return filtered.sort((a, b) => {
        // 1. Live matches first
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;

        // 2. Sort by timestamp (ascending - earliest first)
        const t1 = a.timestamp || Infinity;
        const t2 = b.timestamp || Infinity;
        
        return t1 - t2;
    });
  }, [visibleMatches, activeCategory, activeLeague, searchQuery]);

  // Group matches by league for display
  const groupedMatches = useMemo(() => {
    // 當前選擇為「全部賽事」時，不分聯賽，直接返回一個扁平的列表群組
    if (activeCategory === 'all' && !activeLeague) {
        return [{
            league: t('label.all_matches'),
            matches: [...filteredMatches]
        }];
    }

    // 當有指定分類或聯賽時，保留按聯賽分組邏輯
    const groups: { league: string; matches: Match[] }[] = [];
    const leagueMap = new Map<string, Match[]>();
    
    filteredMatches.forEach(match => {
        if (!leagueMap.has(match.league)) {
            const newGroup: Match[] = [];
            leagueMap.set(match.league, newGroup);
            groups.push({ league: match.league, matches: newGroup });
        }
        leagueMap.get(match.league)!.push(match);
    });
    
    return groups;
  }, [filteredMatches, activeCategory, activeLeague]);

  // Calculate Odds dynamically based on current pools
  const currentOdds = useMemo(() => {
    if (!currentMatch) return { home: 0, draw: 0, away: 0 }
    
    if (currentMatch.marketData) {
        const md = currentMatch.marketData;
        if (md.realTotalPool === 0) {
            return md.initialOdds;
        }
        return oddsEngine.calculateAllDisplayOdds(
            md.pools,
            undefined,
            undefined,
            currentMatch.score,
            currentMatch.liveMinute,
            currentMatch.status
        );
    }

    // Fallback to legacy mock logic
    const pFallback = currentMatch.marketData?.pools || currentMatch.pools;
    const poolDict = {
      home: pFallback.home,
      draw: pFallback.draw,
      away: pFallback.away
    }

    return {
      home: oddsEngine.calculateOdds(poolDict, 'home'),
      draw: oddsEngine.calculateOdds(poolDict, 'draw'),
      away: oddsEngine.calculateOdds(poolDict, 'away')
    }
  }, [currentMatch, oddsEngine])

  // Calculate counts for sidebar badges and organize leagues
  const { categoryCounts, leaguesByCategory, leagueCounts } = useMemo(() => {
    const catCounts: Record<string, number> = { all: visibleMatches.length };
    const leagueCounts: Record<string, number> = {};
    const leaguesByCat: Record<string, string[]> = {};

    // Initialize leaguesByCat
    CATEGORIES.forEach(c => {
        if (c.id !== 'all') leaguesByCat[c.id] = [];
    });

    visibleMatches.forEach(m => {
        // Category Counts
        if (!catCounts[m.category]) catCounts[m.category] = 0;
        catCounts[m.category]++;

        // League Counts
        if (!leagueCounts[m.league]) {
            leagueCounts[m.league] = 0;
            // Add to leaguesByCat if not present
            if (leaguesByCat[m.category] && !leaguesByCat[m.category].includes(m.league)) {
                leaguesByCat[m.category].push(m.league);
            }
        }
        leagueCounts[m.league]++;
    });

    // Sort leagues alphabetically
    Object.keys(leaguesByCat).forEach(key => {
        leaguesByCat[key].sort();
    });

    return { categoryCounts: catCounts, leaguesByCategory: leaguesByCat, leagueCounts };
  }, [visibleMatches]);

  const handleCategorySelect = (categoryId: string) => {
      setActiveCategory(categoryId);
      setActiveLeague(null);
  };

  // Calculate Liquidity Health
  const liquidityHealth = useMemo(() => {
    if (!currentMatch) return null;
    const p = currentMatch.marketData?.pools || currentMatch.pools;
    return liquidityAnalyzer.analyzeMarketHealth({
        home: p.home,
        draw: p.draw,
        away: p.away
    });
  }, [currentMatch, liquidityAnalyzer]);

  // Calculate potential return & slippage
  const betAmountNum = parseFloat(amount) || 0
  
  // Slippage / Ideal Odds Calculation
  const projectedOdds = useMemo((): { odds: number; riskLevel: RiskLevel } | null => {
      if (!currentMatch || !selectedOutcome || betAmountNum <= 0) return null;
      
      if (currentMatch.marketData) {
          const md = currentMatch.marketData;
          if (md.realTotalPool === 0) {
              const initOdds = md.initialOdds[selectedOutcome as keyof typeof md.initialOdds] || 1.01;
              return { odds: parseFloat(initOdds.toFixed(2)), riskLevel: 'normal' as const };
          }
          const totalReal = md.realTotalPool;
          return oddsEngine.calculateDynamicOdds(
              md.pools,
              selectedOutcome,
              betAmountNum,
              md.liabilities,
              undefined,
              undefined,
              undefined,
              currentMatch.score,
              currentMatch.liveMinute,
              currentMatch.status,
              undefined,
              totalReal < 0.50 || undefined,
              effectiveCommissionRate
          );
      }
      
      const pLegacy = currentMatch.marketData?.pools || currentMatch.pools;
      const poolDict = {
        home: pLegacy.home,
        draw: pLegacy.draw,
        away: pLegacy.away
      }
      const totalReal = poolDict.home + poolDict.draw + poolDict.away;
      return oddsEngine.calculateDynamicOdds(
          poolDict,
          selectedOutcome,
          betAmountNum,
          undefined, undefined, undefined, undefined, undefined, undefined, undefined,
          undefined,
          totalReal < 0.50 || undefined,
          effectiveCommissionRate
      );
  }, [currentMatch, selectedOutcome, betAmountNum, oddsEngine, effectiveCommissionRate]);

  const selectedOdds = projectedOdds ? projectedOdds.odds : (selectedOutcome ? currentOdds[selectedOutcome as keyof typeof currentOdds] : 0)
  
  const potentialReturn = (betAmountNum * selectedOdds).toFixed(2)
  const fee = (betAmountNum * 0.005).toFixed(2)

  const handlePrediction = async () => {
    if (!connected || !amount || !selectedMatchId || !selectedOutcome || !publicKey) return
    
    if (!projectedOdds) {
        alert(t('error.insufficient_counterparty') || "The bet is rejected: insufficient counterparty funds.");
        return;
    }

    if (projectedOdds.riskLevel === 'position_limit') {
        const maxPct = (oddsEngine.getMaxPositionRatio() * 100).toFixed(0);
        alert(t('error.position_limit')?.replace('{max}', maxPct) || `投注被拒絕：該選項已達到持倉上限 ${maxPct}%，請等待更多資金注入其他選項。`);
        return;
    }

    if (projectedOdds.riskLevel === 'refund_single_side') {
        const confirmed = window.confirm(
            t('confirm.refund_single_side') ||
            '目前只有此選項有投注，如比賽前仍無人投注其他選項，所有投注將全額退款（不扣手續費）。確定要繼續投注嗎？'
        );
        if (!confirmed) return;
        await executePrediction(projectedOdds.odds);
        return;
    }

    if (projectedOdds.riskLevel === 'counterparty') {
        setCounterpartyOffer({ odds: projectedOdds.odds });
        return;
    }

    await executePrediction(projectedOdds.odds);
  };

  const confirmCounterpartyBet = async () => {
      if (!counterpartyOffer) return;
      const odds = counterpartyOffer.odds;
      setCounterpartyOffer(null);
      await executePrediction(odds);
  };

  const cancelCounterpartyBet = () => {
      setCounterpartyOffer(null);
  };

  const cancelControllerRef = useRef<AbortController | null>(null);
  const txTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCancelBet = useCallback(() => {
    if (txTimeoutRef.current) {
      clearTimeout(txTimeoutRef.current);
      txTimeoutRef.current = null;
    }
    if (cancelControllerRef.current) {
      cancelControllerRef.current.abort();
      cancelControllerRef.current = null;
    }
    setTxStatus("idle");
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (txTimeoutRef.current) clearTimeout(txTimeoutRef.current);
      if (cancelControllerRef.current) cancelControllerRef.current.abort();
    };
  }, []);

  const executePrediction = async (lockedOdds: number) => {
    if (!publicKey) return;
    if (!selectedOutcome) return;
    const outcome = selectedOutcome;
    let txSignature: string | null = null;

    const clearTimeoutIfExists = () => {
      if (txTimeoutRef.current) {
        clearTimeout(txTimeoutRef.current);
        txTimeoutRef.current = null;
      }
    };
    
    try {
      // 計算抽水分成 (真實資金 vs 體驗金)
      let poolAmountForDisplay = betAmountNum;
      let houseAmountForDisplay = 0;
      let commissionAmountForDisplay = 0;
      
      // 1. 如果是真實資金投注，發送 USDT SPL Token 轉帳到資金池 + 抽水 + 佣金地址
      if (!useBonus) {
        // 查看是否有推薦人，決定佣金分成
        const currentAddressForReferral = publicKey?.toBase58() || getActualAddress();
        let commissionRate = 0;
        if (currentAddressForReferral) {
          const storedReferrer = localStorage.getItem(`bound_referrer_${currentAddressForReferral}`);
          if (storedReferrer) {
            try {
              const refRes = await fetch(`/api/referral?address=${storedReferrer}`);
              if (refRes.ok) {
                const refData = await refRes.json();
                commissionRate = refData.data?.commissionRate || DEFAULT_COMMISSION_RATE;
              } else {
                commissionRate = DEFAULT_COMMISSION_RATE;
              }
            } catch {
              commissionRate = DEFAULT_COMMISSION_RATE;
            }
          }
        }
        
        const { pool: poolAmount, house: houseAmount, commission: commissionAmount } = splitBetAmount(betAmountNum, commissionRate);
        
        poolAmountForDisplay = poolAmount;
        houseAmountForDisplay = houseAmount;
        commissionAmountForDisplay = commissionAmount;

        const rawPoolAmount = BigInt(Math.floor(poolAmount * Math.pow(10, USDT_DECIMALS)));
        const rawHouseAmount = BigInt(Math.floor(houseAmount * Math.pow(10, USDT_DECIMALS)));
        const rawCommissionAmount = BigInt(Math.floor(commissionAmount * Math.pow(10, USDT_DECIMALS)));
        
        let actualPublicKey = publicKey;
        if (!actualPublicKey) {
            throw new Error("Wallet public key is not available");
        }

        // 1) Derive ATAs — all funds go to ADMIN wallet (admin controls key for payouts)
        const ADMIN_ADDRESS = HOUSE_WALLET; // admin wallet = house = commission
        const userATA = findAtaClient(USDT_MINT, actualPublicKey);
        const adminATA = findAtaClient(USDT_MINT, ADMIN_ADDRESS);

        const totalRawAmount = rawPoolAmount + rawHouseAmount + rawCommissionAmount;

        // 2) Fetch blockhash
        console.log("[Bet] Fetching blockhash...");
        const blockhash = await fetchBlockhash();
        console.log("[Bet] Blockhash:", blockhash);

        // 3) Check admin ATA exists (single destination)
        console.log("[Bet] Checking admin ATA...");
        const atasNeeded = await checkAtasNeeded([{ ata: adminATA, owner: ADMIN_ADDRESS }]);
        const numAtas = atasNeeded.length;

        if (numAtas > 0) {
          const ataCostLamports = estimateAtaCost(numAtas);
          const gasEstLamports = estimateGasCost(3 + numAtas);
          const totalSolNeeded = (ataCostLamports + gasEstLamports) / 1e9;

          const isAdminUser = actualPublicKey.toBase58() === COMMISSION_WALLET.toBase58();
          if (!isAdminUser) {
            throw new Error(
              `平台尚未初始化收款帳戶。\n\n請聯絡管理員到 Admin 面板點擊「收款 ATA 初始化」按鈕（一次性操作，約 ~${(ataCostLamports / 1e9).toFixed(4)} SOL）。\n\n初始化後即可正常投注，無需額外 SOL。`
            );
          }

          const solBalance = await getSolBalanceViaProxy(actualPublicKey.toBase58());
          const solBalanceNum = solBalance / 1e9;
          if (solBalance < ataCostLamports + gasEstLamports) {
            const short = ((ataCostLamports + gasEstLamports - solBalance) / 1e9).toFixed(4);
            throw new Error(
              `SOL 不足。需建立收款帳戶（一次性，~${(ataCostLamports / 1e9).toFixed(4)} SOL）+ Gas ~${(gasEstLamports / 1e9).toFixed(6)} SOL。\n目前錢包只有 ${solBalanceNum.toFixed(4)} SOL，尚缺 ~${short} SOL。`
            );
          }
          console.log(`[Bet] ✅ Admin SOL balance sufficient (${solBalanceNum.toFixed(4)} SOL)`);
        }

        // 4) Build transaction (simple: 1 createATA + 1 memo + 1 transfer)
        let transaction = new Transaction();
        transaction.feePayer = actualPublicKey;
        transaction.recentBlockhash = blockhash;
        transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));

        for (const { ata, owner } of atasNeeded) {
          transaction.add(createAtaInstruction(actualPublicKey, ata, owner, USDT_MINT));
        }

        const memoText = "BET";
        transaction.add(new TransactionInstruction({
            keys: [{ pubkey: actualPublicKey, isSigner: true, isWritable: false }],
            data: Buffer.from(memoText, "utf-8"),
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        }));

        transaction.add(splTransferInstruction(userATA, adminATA, actualPublicKey, totalRawAmount));

        // 5) Sign & send via Phantom's own RPC (with 90s timeout)
        setTxStatus("submitting");
        console.log("[Bet] Calling Phantom signAndSendTransaction...");
        
        const provider = (window as any)?.solana;
        if (!provider?.signAndSendTransaction) {
          throw new Error("Phantom 錢包未偵測到，請確認錢包已解鎖。");
        }
        
        const SIGN_TIMEOUT_MS = 90_000;
        const cancelController = new AbortController();
        cancelControllerRef.current = cancelController;
        
        let signature: string;
        try {
          const signPromise = provider.signAndSendTransaction(transaction, { skipPreflight: false });
          const timeoutPromise = new Promise<never>((_, reject) => {
            txTimeoutRef.current = setTimeout(() => {
              cancelController.abort();
              reject(new Error("簽名請求超時：Phantom 錢包未在 90 秒內回應。請確認錢包已解鎖且彈窗未被瀏覽器阻擋。"));
            }, SIGN_TIMEOUT_MS);
          });
          
          const result = await Promise.race([signPromise, timeoutPromise]);
          signature = result.signature;
        } catch (walletErr: any) {
          clearTimeoutIfExists();
          if (cancelController.signal.aborted) {
            throw walletErr;
          }
          if (walletErr?.message?.includes?.("User rejected") || walletErr?.message?.includes?.("user rejected") || walletErr?.code === 4001) {
            throw walletErr;
          }
          console.log("[Bet] Retry with skipPreflight");
          const retryCancelController = new AbortController();
          cancelControllerRef.current = retryCancelController;
          const retryPromise = provider.signAndSendTransaction(transaction, { skipPreflight: true });
          const retryTimeoutPromise = new Promise<never>((_, reject) => {
            txTimeoutRef.current = setTimeout(() => {
              retryCancelController.abort();
              reject(new Error("簽名請求超時：Phantom 錢包未在 90 秒內回應。請確認錢包已解鎖且彈窗未被瀏覽器阻擋。"));
            }, SIGN_TIMEOUT_MS);
          });
          const result = await Promise.race([retryPromise, retryTimeoutPromise]);
          signature = result.signature;
        }
        clearTimeoutIfExists();
        cancelControllerRef.current = null;
        txSignature = signature;
        console.log("[Bet] Sent, signature:", signature);

        setTxStatus("confirming");

        // 6) Brief confirmation delay (Phantom already confirmed internally)
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log("[Bet] Done!");
      } else {
        // 如果是體驗金，只在前端模擬延遲 (因為體驗金存在我們後端資料庫)
        setTxStatus("submitting");
        await new Promise(resolve => setTimeout(resolve, 1500));
        setTxStatus("confirming");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 交易成功後，更新前端的狀態與資料庫
      setMatches(prevMatches => prevMatches.map(m => {
          if (m.id === selectedMatchId) {
              const updatedMatch = { ...m };
              
              // Update new MarketData if available
              if (updatedMatch.marketData && projectedOdds) {
                  const md = updatedMatch.marketData;
                  const effectivePool = !useBonus ? poolAmountForDisplay : betAmountNum;
                  updatedMatch.marketData = {
                      ...md,
                      // 真實資金僅 poolAmount 進獎池，體驗金全額
                      realTotalPool: md.realTotalPool + effectivePool,
                      liabilities: {
                          ...md.liabilities,
                          [outcome as string]: md.liabilities[outcome as keyof typeof md.liabilities] + (effectivePool * lockedOdds)
                      },
                      pools: {
                          ...md.pools,
                          [outcome]: md.pools[outcome as keyof typeof md.pools] + effectivePool
                      }
                  };
              }
              
              // Update legacy pools for UI compatibility
              const effectivePoolLegacy = !useBonus ? poolAmountForDisplay : betAmountNum;
              updatedMatch.pools = {
                  ...m.pools,
                  [outcome]: m.pools[outcome as keyof typeof m.pools] + effectivePoolLegacy
              };
              
              return updatedMatch;
          }
          return m
      }))

      // Record bet
      const matchInfo = matches.find(m => m.id === selectedMatchId);
      if (matchInfo) {
          const newBet = {
              id: Math.random().toString(36).substring(7),
              matchId: matchInfo.id,
              matchName: `${matchInfo.home} vs ${matchInfo.away}`,
              outcome: outcome,
              amount: betAmountNum,
              odds: lockedOdds || 1.0,
              status: 'pending',
              useBonus: useBonus,
              timestamp: Date.now()
          };
          
          setMyBets(prev => [newBet, ...prev]);

          // 取得目前有效的帳號 (防錯處理)
          const currentAddress = publicKey?.toBase58() || getActualAddress();
          if (!currentAddress) {
              console.error("Cannot determine wallet address for recording bet.");
              return;
          }

          // Save to backend persistent storage
          fetch('/api/bets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  ...newBet,
                  odds: lockedOdds,
                  userAddress: currentAddress,
                  signature: txSignature,
                  liveMinute: matchInfo.liveMinute
              })
          }).catch(err => console.error('Failed to save bet to backend:', err));

          // Notify Referral API to process potential bonus (Only for real money bets)
          if (!useBonus) {
              const storedReferrer = localStorage.getItem(`bound_referrer_${currentAddress}`);
              fetch('/api/referral', {
                  method: 'POST',
                  body: JSON.stringify({
                      action: 'place_bet',
                      userAddress: currentAddress,
                      referrerAddress: storedReferrer,
                      betAmount: betAmountNum,
                      poolAmount: poolAmountForDisplay,
                      houseAmount: houseAmountForDisplay,
                      commissionAmount: commissionAmountForDisplay,
                      signature: txSignature
                  })
              })
              .then(res => res.json())
              .then(data => {
                  if (data.success) {
                      getTrialUSDTBalance(currentAddress).then(newBal => {
                          if (newBal > trialBalance) {
                              setTrialBalance(newBal);
                          }
                      });
                  }
              })
              .catch(err => console.error('Failed to process referral bet:', err));
          }

          // Deduct local balance
          if (useBonus) {
              setTrialBalance(prev => prev - betAmountNum);
          } else {
              // 實際應用中這裡應該重新 fetchBalance，此處為了 UI 流暢先樂觀扣除
              setBalance(prev => prev - betAmountNum);
          }
      }

      setTxStatus("success")
      
      // Reset after showing success
      setTimeout(() => {
        setTxStatus("idle")
        setSelectedMatchId(null)
        setSelectedOutcome(null)
        setAmount("")
      }, 3000)

    } catch (error: any) {
      clearTimeoutIfExists();
      cancelControllerRef.current = null;
      console.error("Transaction failed detailed error:", error);
      
      let errorMessage = "Transaction failed or rejected by user.";
      if (error.message) {
          if (error.message.includes("User rejected the request")) {
              errorMessage = t('error.user_rejected');
          } else if (error.message.includes("insufficient funds")) {
              errorMessage = t('error.insufficient_sol');
          } else {
              errorMessage = `${t('error.failed_with_msg')}${error.message}`;
          }
      }
      
      alert(errorMessage);
      setTxStatus("idle");
    } finally {
      clearTimeoutIfExists();
      cancelControllerRef.current = null;
      setIsProcessing(false);
    }
  }

  const filteredMyBets = useMemo(() => {
      const now = Date.now();
      const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
      
      // 永久過濾：超過3個月的不用顯示
      let validBets = myBets.filter(bet => now - bet.timestamp <= threeMonthsMs);
      
      // 根據 dateFilter 進行二次過濾
      if (dateFilter === 'today') {
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          validBets = validBets.filter(bet => bet.timestamp >= startOfToday);
      } else if (dateFilter === '3days') {
          const startOf3Days = new Date().setHours(0, 0, 0, 0) - 2 * 24 * 60 * 60 * 1000;
          validBets = validBets.filter(bet => bet.timestamp >= startOf3Days);
      } else if (dateFilter === '7days') {
          const startOf7Days = new Date().setHours(0, 0, 0, 0) - 6 * 24 * 60 * 60 * 1000;
          validBets = validBets.filter(bet => bet.timestamp >= startOf7Days);
      } else if (dateFilter === '30days') {
          const startOf30Days = new Date().setHours(0, 0, 0, 0) - 29 * 24 * 60 * 60 * 1000;
          validBets = validBets.filter(bet => bet.timestamp >= startOf30Days);
      }
      // '3months' 的過濾條件已經包含在最初的 validBets 過濾中了

      return validBets;
  }, [myBets, dateFilter]);

  // 1. 若有推薦參數且尚未連線，顯示邀請落地頁
  if (showReferralLanding && urlReferrer && !connected) {
      return (
          <ReferralLandingPage 
              referrerId={urlReferrer} 
              onSkip={() => setShowReferralLanding(false)} 
          />
      );
  }

  // 2. 主應用程式視圖
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans selection:bg-primary-purple/30 flex flex-col">
      {/* Shared Header for both User and Admin */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="font-bold text-xl flex items-center gap-2 tracking-tight cursor-pointer" onClick={() => { setCurrentView('matches'); setShowAdminPanel(false); }}>
              <div className="bg-gradient-to-br from-primary-purple to-primary-blue p-1.5 rounded-lg">
                 <Trophy className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent hidden sm:inline-block">PolyBall</span>
            </div>
            <button 
                onClick={() => { setCurrentView('news_center'); setShowAdminPanel(false); }}
                className={`flex items-center gap-2 px-4 py-2 ml-2 rounded-xl text-sm font-bold transition-all ${currentView === 'news_center' ? 'bg-primary-blue/20 text-primary-blue border border-primary-blue/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-neutral-800/50 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700/50'}`}
            >
                <Newspaper className={`w-4 h-4 ${currentView === 'news_center' ? 'text-primary-blue' : 'text-primary-blue/70'}`} />
                {t('nav.news')}
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
             {isAdmin && (
                <button
                  onClick={() => setShowAdminPanel(!showAdminPanel)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    showAdminPanel
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'bg-neutral-800/50 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 border border-transparent hover:border-amber-700/50'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 ${showAdminPanel ? 'text-amber-400' : 'text-amber-500/70'}`} />
                  <span className="hidden sm:inline">{t('admin.title')}</span>
                </button>
             )}
             {connected && !isAdmin && (
                <div className="hidden md:flex items-center gap-3 mr-2 bg-neutral-800/50 p-1.5 rounded-xl border border-neutral-700/50">
                  {/* Trial Balance Badge - 只有大於 0 時才顯示 */}
                  {trialBalance > 0 && (
                    <div className="flex flex-col items-end px-3 py-1 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-orange-500/80">{t('label.trial_funds')}</span>
                      <span className="text-sm font-bold text-orange-400">{trialBalance.toFixed(2)} tUSDT</span>
                    </div>
                  )}
                </div>
             )}
             <ReferralModal />
             <LanguageSwitcher />
             <WalletButton />
          </div>
        </div>
      </header>

      {(isAdmin && showAdminPanel) ? (
        <main className="flex-1 w-full max-w-[1400px] mx-auto z-10 relative">
          <AdminDashboard />
        </main>
      ) : currentView === 'bonus_event' ? (
        <main className="flex-1 w-full z-10 relative">
          <BonusEventPage />
        </main>
      ) : currentView === 'news_detail' ? (
        <main className="flex-1 w-full z-10 relative">
          <NewsDetailPage 
            onBack={() => setCurrentView('matches')} 
            onGoToBonus={() => setCurrentView('bonus_event')} 
          />
        </main>
      ) : currentView === 'news_center' ? (
        <main className="flex-1 w-full z-10 relative bg-neutral-950">
          <NewsCenterPage 
            onBack={() => setCurrentView('matches')} 
            onGoToBonus={() => setCurrentView('bonus_event')} 
          />
        </main>
      ) : (
        <>
          <Suspense fallback={null}>
             <ReferralHandler />
          </Suspense>

          <div className="flex flex-1 container mx-auto px-4 lg:px-8 pt-6 gap-8">
            
            {/* Main Content Area */}
            <main className="flex-1 space-y-6 pb-20 max-w-5xl mx-auto w-full relative z-10">
          {/* News Section (Replaces old Hero Section) */}
            <NewsSection 
                onBonusClick={() => setCurrentView('bonus_event')} 
                onNewsDetailClick={() => setCurrentView('news_detail')}
            />

          {/* Navigation & Filters Container - Replaces Sidebar and Mobile Drawer */}
          <div className="sticky top-[4rem] z-[85] bg-neutral-900/95 backdrop-blur-md py-3 -mx-4 px-4 md:relative md:z-[85] md:bg-transparent md:p-0 md:mx-0 mt-[-3rem] mb-6">
             
             {/* League Selector Header */}
             <button 
                onClick={() => setIsLeagueMenuOpen(!isLeagueMenuOpen)}
                className="w-full flex items-center justify-between p-4 bg-neutral-800/50 rounded-2xl border border-neutral-700/50 hover:bg-neutral-800 transition-colors group relative z-[90]"
             >
                <div className="flex items-center gap-4">
                   <div className="p-2.5 bg-primary-purple/10 rounded-xl text-primary-purple group-hover:bg-primary-purple group-hover:text-white transition-colors">
                      {(() => {
                          const cat = CATEGORIES.find(c => c.id === activeCategory);
                          const Icon = cat?.icon || Globe;
                          return <Icon className="h-5 w-5" />;
                      })()}
                   </div>
                   <div className="text-left">
                      <div className="text-xs text-neutral-400 font-medium mb-0.5">{t('selection.current')}</div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                         {activeLeague || t(`cat.${activeCategory}`) || t('cat.all')}
                         {!activeLeague && activeCategory !== 'all' && (
                             <span className="text-xs bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-300 font-normal">{t('selection.category')}</span>
                         )}
                         {activeLeague && (
                             <span className="text-xs bg-primary-blue/10 text-primary-blue px-1.5 py-0.5 rounded font-normal">{t('selection.league')}</span>
                         )}
                      </div>
                   </div>
                </div>
                <div className={`p-2 rounded-full bg-neutral-900 transition-all duration-300 ${isLeagueMenuOpen ? 'rotate-180 bg-neutral-800' : ''}`}>
                    <ChevronDown className="h-5 w-5 text-neutral-400" />
                </div>
             </button>

             {/* Collapsible Menu Overlay */}
             {isLeagueMenuOpen && (
                <>
                   {/* Backdrop to close menu when clicking outside */}
                   <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]" 
                        onClick={() => setIsLeagueMenuOpen(false)}
                   />
                   
                   {/* The Menu Itself - FIXED POSITIONING TO AVOID CLIPPING */}
                   <div className="absolute left-4 right-4 top-[calc(100%+8px)] z-[90] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 ring-1 ring-white/10 origin-top flex flex-col max-h-[60vh]">
                      <div className="overflow-y-auto custom-scrollbar p-2">
                          {CATEGORIES.map((category) => {
                              const isActiveCat = activeCategory === category.id;
                              const hasLeagues = leaguesByCategory[category.id]?.length > 0;
                              
                              return (
                                  <div key={category.id} className="mb-2 last:mb-0">
                                      <button
                                          onClick={() => {
                                              handleCategorySelect(category.id);
                                              setIsLeagueMenuOpen(false);
                                          }}
                                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                                              isActiveCat && !activeLeague 
                                                  ? 'bg-primary-purple/10 text-primary-purple' 
                                                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                                          }`}
                                      >
                                          <div className="flex items-center gap-3">
                                              <category.icon className="h-4 w-4" />
                                              <span className="font-semibold text-sm">{t(`cat.${category.id}`)}</span>
                                          </div>
                                          <span className="text-xs opacity-50 bg-neutral-950 px-2 py-1 rounded-md">{categoryCounts[category.id] || 0}</span>
                                      </button>
                                      
                                      {/* Sub-leagues Grid */}
                                      {hasLeagues && (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-4 mt-1 border-l-2 border-neutral-800 ml-4 py-1">
                                              {leaguesByCategory[category.id].map(league => (
                                                  <button
                                                      key={league}
                                                      onClick={() => {
                                                          setActiveCategory(category.id);
                                                          setActiveLeague(league);
                                                          setIsLeagueMenuOpen(false);
                                                      }}
                                                      className={`text-left text-xs p-2 rounded-lg transition-colors truncate ${
                                                          activeLeague === league 
                                                              ? 'text-primary-blue bg-primary-blue/5 font-medium' 
                                                              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                                                      }`}
                                                  >
                                                      {league}
                                                  </button>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              )
                          })}
                      </div>
                   </div>
                </>
             )}
             
          </div>

          {/* Match Grid */}
          <div className="space-y-6 mt-16 pt-4">
            {isLoading ? (
                <div className="col-span-full text-center py-32 text-neutral-500 animate-pulse">
                    <div className="h-12 w-12 mx-auto mb-4 rounded-full border-4 border-primary-purple/30 border-t-primary-purple animate-spin" />
                    <p className="text-lg font-medium text-neutral-400">{t('status.loading')}</p>
                </div>
            ) : groupedMatches.length === 0 ? (
              <div className="col-span-full text-center py-20 text-neutral-500">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>{t('status.no_matches')}</p>
                <button onClick={() => window.location.reload()} className="mt-4 text-primary-blue hover:underline">{t('action.refresh')}</button>
              </div>
            ) : (
              groupedMatches.map(({ league, matches }) => (
                <section key={league} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   {league !== t('label.all_matches') && (
                       <div className="flex items-center gap-3 border-b border-neutral-800 pb-2">
                           <div className="h-6 w-1 bg-primary-purple rounded-full"></div>
                           <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                               {league}
                           </h2>
                           <span className="text-xs font-medium bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full border border-neutral-700">
                               {matches.length} {t('label.matches')}
                           </span>
                       </div>
                   )}
                   
                   <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2">
                       {matches.map((match) => {
                        const isFocused = selectedMatchId === match.id && betAmountNum > 0;

                        let matchOdds = { home: 1.01, draw: 1.01, away: 1.01 };

                        if (match.marketData) {
                            const md = match.marketData;
                            if (md.realTotalPool === 0) {
                                matchOdds = { home: md.initialOdds.home, draw: md.initialOdds.draw, away: md.initialOdds.away };
                            } else if (isFocused) {
                                matchOdds = {
                                    home: oddsEngine.calculateDynamicOdds(md.pools, 'home', betAmountNum, md.liabilities, undefined, undefined, undefined, match.score, match.liveMinute, match.status)?.odds || 1.01,
                                    draw: oddsEngine.calculateDynamicOdds(md.pools, 'draw', betAmountNum, md.liabilities, undefined, undefined, undefined, match.score, match.liveMinute, match.status)?.odds || 1.01,
                                    away: oddsEngine.calculateDynamicOdds(md.pools, 'away', betAmountNum, md.liabilities, undefined, undefined, undefined, match.score, match.liveMinute, match.status)?.odds || 1.01,
                                };
                            } else {
                                const result = oddsEngine.calculateAllDisplayOdds(
                                    md.pools, undefined, undefined,
                                    match.score, match.liveMinute, match.status
                                );
                                matchOdds = { home: result.home, draw: result.draw, away: result.away };
                            }
                        } else {
                            const result = oddsEngine.calculateAllDisplayOdds(
                                { home: match.pools.home, draw: match.pools.draw, away: match.pools.away },
                                undefined, undefined, match.score, match.liveMinute, match.status
                            );
                            matchOdds = { home: result.home, draw: result.draw, away: result.away };
                        }
                        const totalPool = (() => {
                            if (match.marketData?.pools) {
                                return match.marketData.pools.home + match.marketData.pools.draw + match.marketData.pools.away;
                            }
                            return match.pools.home + match.pools.draw + match.pools.away;
                        })();

                        return (
                      <Card key={match.id} className="overflow-hidden hover:border-primary-purple/50 transition-all duration-300 group bg-neutral-800/50 backdrop-blur-sm border-neutral-700/50">
                        <CardHeader className="border-b border-neutral-700/50 pb-4 bg-neutral-800/30 relative">
                          {/* 顯示標準�?(測試用，正式上線可隱藏或僅供內部參�? */}
                          {(match as any).stdDevData && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-neutral-600 font-mono hidden sm:flex gap-2 bg-neutral-900/50 px-2 py-0.5 rounded-full">
                                <span title="Home StdDev">H:{(match as any).stdDevData.home}</span>
                                <span title="Draw StdDev">D:{(match as any).stdDevData.draw}</span>
                                <span title="Away StdDev">A:{(match as any).stdDevData.away}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs font-semibold tracking-wider text-neutral-400 uppercase relative z-10">
                            <span className="flex items-center gap-1.5 truncate max-w-[70%]">
                              <Trophy className="h-3.5 w-3.5 text-primary-purple flex-shrink-0" /> {match.league}
                            </span>
                            {match.status === 'live' ? (
                              <span className="text-error flex items-center gap-1.5 animate-pulse bg-error/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                <span className="w-1.5 h-1.5 bg-error rounded-full"></span>
                                {t('label.live')}
                                {(() => {
                                  const raw = (match.date || '').toString();
                                  if (raw.includes('HT') || raw.includes('半場')) return ` ${t('label.half_time')}`;
                                  if (typeof match.liveMinute === 'number' && match.liveMinute > 0) return ` ${match.liveMinute}'`;
                                  const m = raw.match(/(\d{1,3})\s*'?/);
                                  if (m?.[1]) return ` ${m[1]}'`;
                                  return '';
                                })()}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 bg-neutral-700/50 px-2 py-0.5 rounded-full flex-shrink-0">
                                 <Clock className="h-3.5 w-3.5" /> {new Date(match.date).toLocaleString(dateLocale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex justify-between items-start mt-6 mb-2">
                            {/* Home Team */}
                            <div className="flex flex-col items-center gap-3 w-[40%] text-center">
                                {match.homeLogo ? (
                                    <div className="w-16 h-16 relative bg-neutral-800/30 rounded-full flex items-center justify-center p-2">
                                        <img 
                                            src={match.homeLogo} 
                                            alt={match.home} 
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-contain drop-shadow-lg transition-opacity duration-300"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.onerror = null; // 防止無限迴圈
                                                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9H4.5a2.5 2.5 0 0 1 0-5H6'/%3E%3Cpath d='M18 9h1.5a2.5 2.5 0 0 0 0-5H18'/%3E%3Cpath d='M4 22h16'/%3E%3Cpath d='M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22'/%3E%3Cpath d='M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22'/%3E%3Cpath d='M18 2H6v7a6 6 0 0 0 12 0V2Z'/%3E%3C/svg%3E";
                                                target.className = "w-8 h-8 opacity-50";
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-neutral-800/30 rounded-full flex items-center justify-center border border-neutral-700/50">
                                        <Trophy className="w-8 h-8 text-neutral-600" />
                                    </div>
                                )}
                                <div className="font-bold text-lg text-white group-hover:text-primary-purple transition-colors leading-tight min-h-[1.5rem]">{match.home || t('label.unknown')}</div>
                            </div>

                            {/* VS / Score */}
                            <div className="flex flex-col items-center gap-2 pt-4 w-[20%]">
                                <div className="text-neutral-500 text-xs font-bold bg-neutral-900 px-2.5 py-1 rounded-full border border-neutral-700 shadow-inner">{t('label.vs')}</div>
                                {match.score && (
                                    <div className="text-center text-xl font-black text-white tracking-widest bg-neutral-900/80 py-1 px-3 rounded-lg border border-neutral-700 shadow-lg min-w-[80px]">
                                        {match.score}
                                    </div>
                                )}
                            </div>

                            {/* Away Team */}
                            <div className="flex flex-col items-center gap-3 w-[40%] text-center">
                                {match.awayLogo ? (
                                    <div className="w-16 h-16 relative bg-neutral-800/30 rounded-full flex items-center justify-center p-2">
                                        <img 
                                            src={match.awayLogo} 
                                            alt={match.away} 
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-contain drop-shadow-lg transition-opacity duration-300"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.onerror = null; // 防止無限迴圈
                                                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9H4.5a2.5 2.5 0 0 1 0-5H6'/%3E%3Cpath d='M18 9h1.5a2.5 2.5 0 0 0 0-5H18'/%3E%3Cpath d='M4 22h16'/%3E%3Cpath d='M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22'/%3E%3Cpath d='M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22'/%3E%3Cpath d='M18 2H6v7a6 6 0 0 0 12 0V2Z'/%3E%3C/svg%3E";
                                                target.className = "w-8 h-8 opacity-50";
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-neutral-800/30 rounded-full flex items-center justify-center border border-neutral-700/50">
                                        <Trophy className="w-8 h-8 text-neutral-600" />
                                    </div>
                                )}
                                <div className="font-bold text-lg text-white group-hover:text-primary-purple transition-colors leading-tight min-h-[1.5rem]">{match.away || t('label.unknown')}</div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-6 space-y-6">
                          {/* Odds Selection */}
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(matchOdds).map(([outcome, odd]) => {
                              const isSelected = selectedMatchId === match.id && selectedOutcome === outcome;
                              return (
                                <button
                                  key={outcome}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedMatchId(null);
                                      setSelectedOutcome(null);
                                    } else {
                                      setSelectedMatchId(match.id);
                                      setSelectedOutcome(outcome);
                                      setAmount(""); // Reset amount on new selection
                                    }
                                  }}
                                  className={`
                                    flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 relative overflow-hidden
                                    ${isSelected 
                                      ? "bg-primary-purple/20 border-primary-purple text-primary-purple shadow-[0_0_15px_-5px_rgba(153,69,255,0.4)]" 
                                      : "bg-neutral-900/50 border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"}
                                  `}
                                >
                                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">{t(`outcome.${outcome}`)}</span>
                                  <span className="text-lg font-bold">{isNaN(odd) ? '-' : odd}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* 集中度分布條 */}
                          {totalPool > 0 && (() => {
                            const poolsForBar = match.marketData?.pools || match.pools;
                            const hPct = poolsForBar.home / totalPool * 100;
                            const dPct = poolsForBar.draw / totalPool * 100;
                            const aPct = poolsForBar.away / totalPool * 100;
                            const maxPct = Math.max(hPct, dPct, aPct);
                            const maxThreshold = oddsEngine.getMaxPositionRatio() * 100;
                            return (
                              <div className="space-y-1 mt-2">
                                <div className="flex h-1.5 rounded-full overflow-hidden bg-neutral-700/50">
                                  <div style={{ width: hPct + '%' }} className="bg-blue-500/70 transition-all duration-500" title={'Home: ' + hPct.toFixed(1) + '%'} />
                                  <div style={{ width: dPct + '%' }} className="bg-amber-500/70 transition-all duration-500" title={'Draw: ' + dPct.toFixed(1) + '%'} />
                                  <div style={{ width: aPct + '%' }} className="bg-red-500/70 transition-all duration-500" title={'Away: ' + aPct.toFixed(1) + '%'} />
                                </div>
                                <div className="flex justify-between text-[10px] text-neutral-500">
                                  <span>H: {hPct.toFixed(1)}%</span>
                                  <span>D: {dPct.toFixed(1)}%</span>
                                  <span>A: {aPct.toFixed(1)}%</span>
                                </div>
                                {maxPct >= 60 && (
                                  <div className={'text-[10px] px-2 py-0.5 rounded-full inline-block ' + (maxPct >= maxThreshold ? 'bg-error/20 text-error' : maxPct >= 75 ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-600/30 text-neutral-400')}>
                                    {maxPct >= maxThreshold ? '⚠ 持倉達上限' : maxPct >= 75 ? '⚡ 高集中度' : '📊 關注中'}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Betting Input Area (Progressive Disclosure) */}
                          {selectedMatchId === match.id && (
                            <div className="space-y-4 pt-4 border-t border-neutral-700/50 animate-in slide-in-from-top-2 fade-in duration-300">
                              
                              {match.liveMinute && match.liveMinute >= 80 ? (
                                  <div className="bg-error/10 border border-error/20 p-4 rounded-xl text-center">
                                      <AlertTriangle className="h-6 w-6 text-error mx-auto mb-2" />
                                      <p className="text-error font-bold">{t('status.match_reached')} {match.liveMinute} {t('status.minute')}，{t('status.betting_stopped')}</p>
                                      <p className="text-neutral-400 text-sm mt-1">{t('status.fairness_notice')}，{t('status.fairness_desc')}</p>
                                  </div>
                              ) : (
                                  <>
                                      <div className="space-y-3">
                                        {/* Fund Type Selector - 只有 Trial Balance > 0 時才顯示 */}
                                {trialBalance > 0 && (
                                  <div className="flex bg-neutral-900 rounded-xl p-1 border border-neutral-800 relative z-10 overflow-hidden">
                                    <button 
                                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 z-10 ${!useBonus ? 'text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                                      onClick={() => setUseBonus(false)}
                                    >
                                      {t('label.real_money')}
                                    </button>
                                    <button 
                                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 z-10 ${useBonus ? 'text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                                      onClick={() => setUseBonus(true)}
                                    >
                                      {t('label.trial_funds')}
                                    </button>
                                    {/* Animated Sliding Background */}
                                    <div 
                                      className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-spring ${
                                        !useBonus 
                                          ? 'left-1 bg-gradient-to-r from-primary-purple to-primary-blue opacity-90' 
                                          : 'left-[calc(50%+2px)] bg-gradient-to-r from-orange-500 to-amber-500 opacity-90'
                                      }`}
                                    />
                                  </div>
                                )}

                                <div className="flex justify-between text-sm mt-4">
                                   <label className="font-medium text-neutral-300">{t('label.wager_amount')}</label>
                                   <span className="text-neutral-500 text-xs flex items-center">
                                      {t('label.max')}: 
                                      <span 
                                        className={`ml-1 cursor-pointer hover:underline font-bold ${useBonus && trialBalance > 0 ? 'text-orange-400' : 'text-primary-blue'}`} 
                                        onClick={() => {
                                          const maxVal = Math.floor(useBonus && trialBalance > 0 ? trialBalance : balance);
                                          setAmount(maxVal > 0 ? maxVal.toString() : "");
                                        }}
                                      >
                                        {Math.floor(useBonus && trialBalance > 0 ? trialBalance : balance).toString()} {useBonus && trialBalance > 0 ? 'tUSDT' : 'USDT'}
                                      </span>
                                   </span>
                                </div>
                                
                                <div className="relative group/input">
                                  <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    className={`pr-16 text-lg font-medium bg-neutral-900 h-12 transition-colors ${useBonus && trialBalance > 0 ? 'border-orange-500/30 focus:border-orange-500' : 'border-neutral-700 focus:border-primary-purple'}`}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    autoFocus
                                  />
                                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold transition-colors ${useBonus && trialBalance > 0 ? 'text-orange-500/50 group-focus-within/input:text-orange-500' : 'text-neutral-500 group-focus-within/input:text-primary-purple'}`}>
                                    {useBonus && trialBalance > 0 ? 'tUSDT' : 'USDT'}
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-2">
                                  {[10, 100, 1000].map((val) => (
                                    <button 
                                      type="button"
                                      key={val}
                                      onClick={() => setAmount(val.toString())}
                                      className="px-2 py-1.5 text-xs font-medium bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 hover:text-white text-neutral-400 rounded-md transition-colors"
                                    >
                                      {val}
                                    </button>
                                  ))}
                                  <button 
                                     type="button"
                                     onClick={() => {
                                        const maxVal = Math.floor(useBonus && trialBalance > 0 ? trialBalance : balance);
                                        setAmount(maxVal > 0 ? maxVal.toString() : "");
                                     }}
                                     className={`px-2 py-1.5 text-xs font-medium border rounded-md transition-colors ${
                                       useBonus && trialBalance > 0
                                        ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-500' 
                                        : 'bg-primary-purple/10 border-primary-purple/30 hover:bg-primary-purple/20 text-primary-purple'
                                     }`}
                                   >
                                    {t('label.max')}
                                  </button>
                                </div>
                              </div>

                              <div className={`p-4 rounded-lg space-y-2 border ${useBonus && trialBalance > 0 ? 'bg-orange-500/5 border-orange-500/20' : 'bg-neutral-900/50 border-neutral-800'}`}>
                                {projectedOdds && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-neutral-500">{t('bets.odds') || '鎖定賠率'}</span>
                                    <span className={`font-bold ${projectedOdds.riskLevel === 'counterparty' ? 'text-amber-400' : projectedOdds.riskLevel === 'refund_single_side' ? 'text-neutral-400' : 'text-primary-blue'}`}>
                                      ×{projectedOdds.odds.toFixed(2)}
                                      {projectedOdds.riskLevel === 'refund_single_side' && <span className="text-[10px] text-neutral-500 ml-1">({t('bets.status.refunded') || '可退款'})</span>}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm text-neutral-500">
                                  <span>{t('label.fee')}</span>
                                  <span>-{fee} {useBonus && trialBalance > 0 ? 'tUSDT' : 'USDT'}</span>
                                </div>
                                <div className={`flex justify-between items-end pt-2 border-t ${useBonus && trialBalance > 0 ? 'border-orange-500/20' : 'border-neutral-800'}`}>
                                  <span className="text-sm font-medium text-neutral-300">{t('label.potential_payout')}</span>
                                  <span className={`text-xl font-bold ${useBonus && trialBalance > 0 ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]' : 'text-primary-blue drop-shadow-[0_0_8px_rgba(20,241,149,0.3)]'}`}>
                                    {projectedOdds ? (betAmountNum * projectedOdds.odds).toFixed(2) : "0.00"} {useBonus && trialBalance > 0 ? 'tUSDT' : 'USDT'}
                                  </span>
                                </div>
                              </div>

                              {counterpartyOffer ? (
                                  <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                      <div className="flex items-start gap-3">
                                          <span className="text-2xl">⚡</span>
                                          <div>
                                              <p className="text-sm font-bold text-amber-400">{t('counterparty.title') || '對手盤資金保障模式'}</p>
                                              <p className="text-xs text-amber-300/80 mt-1">
                                                  {t('counterparty.desc')?.replace('{odds}', counterpartyOffer.odds.toFixed(2)) || `該選項對手盤資金不足，賠率已強制下調至 ${counterpartyOffer.odds.toFixed(2)}（潛在賠付 = 對手盤總資金）。`}
                                              </p>
                                              <p className="text-xs text-neutral-400 mt-2">
                                                  {t('counterparty.hint') || '接受新賠率則成交，否則取消。平台不承擔任何超額賠付風險。'}
                                              </p>
                                          </div>
                                      </div>
                                      <div className="flex gap-3">
                                          <Button
                                              className="flex-1 bg-success/80 hover:bg-success text-neutral-900 font-bold"
                                              size="lg"
                                              onClick={confirmCounterpartyBet}
                                          >
                                              {t('counterparty.accept')?.replace('{odds}', counterpartyOffer.odds.toFixed(2)) || `接受 ${counterpartyOffer.odds.toFixed(2)}`}
                                          </Button>
                                          <Button
                                              className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
                                              size="lg"
                                              onClick={cancelCounterpartyBet}
                                          >
                                              {t('counterparty.cancel') || '取消'}
                                          </Button>
                                      </div>
                                  </div>
                              ) : (
                              <>
                              {projectedOdds?.riskLevel === 'position_limit' ? (
                                  <div className="space-y-3 p-4 bg-error/10 border border-error/30 rounded-xl">
                                      <div className="flex items-start gap-3">
                                          <span className="text-2xl">🚫</span>
                                          <div>
                                              <p className="text-sm font-bold text-error">{t('error.position_limit_title') || '持倉上限已達'}</p>
                                              <p className="text-xs text-error/80 mt-1">
                                                  {t('error.position_limit_desc')?.replace('{max}', (oddsEngine.getMaxPositionRatio() * 100).toFixed(0)) || `該選項已達到平台設定的持倉上限 (${(oddsEngine.getMaxPositionRatio() * 100).toFixed(0)}%)，為保護平台償付能力，暫時不接受此選項的投注。`}
                                              </p>
                                              <p className="text-xs text-neutral-400 mt-2">
                                                  {t('error.position_limit_hint') || '請選擇其他選項，或等待其他用戶注入資金後再試。'}
                                              </p>
                                          </div>
                                      </div>
                                  </div>
                              ) : projectedOdds === null && amount ? (
                                  <Button 
                                      className="w-full bg-error/20 text-error hover:bg-error/30 font-bold tracking-wide"
                                      size="lg"
                                      disabled
                                  >
                                      {t('error.low_odds')}
                                  </Button>
                              ) : (
                                  <Button 
                                    className={`w-full text-white shadow-lg transition-all duration-300 font-bold tracking-wide ${
                                      txStatus === "success" ? "bg-success hover:bg-success/90 text-neutral-900" :
                                      txStatus === "confirming" ? "bg-warning/80 hover:bg-warning/90 text-neutral-900" :
                                      useBonus && trialBalance > 0 ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:shadow-orange-500/25 hover:scale-[1.02]" :
                                      "bg-gradient-to-r from-primary-purple to-primary-blue hover:shadow-primary-purple/25 hover:scale-[1.02]"
                                    }`} 
                                    size="lg"
                                    disabled={isProcessing || (!connected ? true : !amount) || txStatus === "success"}
                                    onClick={handlePrediction}
                                  >
                                    {!connected ? t('wallet.connect') : 
                                     txStatus === "idle" ? t('btn.confirm') :
                                     txStatus === "submitting" ? t('btn.submitting') :
                                     txStatus === "confirming" ? t('btn.confirming') :
                                     t('btn.success')}
                                  </Button>
                              )}
                              </>
                              )}
                              </>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )})
                  }
                   </div>
                </section>
              ))
            )}
          </div>
          
          {/* Transaction History / My Bets */}
          {connected && myBets.some(bet => Date.now() - bet.timestamp <= 90 * 24 * 60 * 60 * 1000) && (
             <div className="mt-16 space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-1 bg-primary-blue rounded-full"></div>
                        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            {t('bets.title')}
                        </h2>
                        <span className="text-xs font-medium bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full border border-neutral-700 hidden sm:inline-block">
                            {filteredMyBets.length} {t('label.matches')}
                        </span>
                    </div>
                    
                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                        <select 
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value as any)}
                            className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary-purple transition-colors cursor-pointer"
                        >
                            <option value="today">{t('filter.date.today')}</option>
                            <option value="3days">{t('filter.date.3days')}</option>
                            <option value="7days">{t('filter.date.7days')}</option>
                            <option value="30days">{t('filter.date.30days')}</option>
                            <option value="3months">{t('filter.date.3months')}</option>
                        </select>
                    </div>
                </div>
                <div className="bg-neutral-800/30 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm">
                    <div className="grid grid-cols-5 text-xs font-bold text-neutral-500 uppercase tracking-wider p-4 border-b border-neutral-800 bg-neutral-900/50">
                        <div className="col-span-2">{t('bets.match')}</div>
                        <div>{t('bets.outcome')}</div>
                        <div className="text-right">{t('bets.amount')}</div>
                        <div className="text-right">{t('bets.odds')}</div>
                    </div>
                    <div className="divide-y divide-neutral-800/50 max-h-[600px] overflow-y-auto">
                        {filteredMyBets.length === 0 ? (
                            <div className="p-8 text-center text-neutral-500 text-sm">
                                {language === 'zh-TW' ? '此期間沒有投注記錄' : 
                                 language === 'zh-CN' ? '此期间没有投注记录' : 
                                 language === 'ja' ? 'この期間の賭けはありません' :
                                 language === 'ar' ? 'لا توجد رهانات لهذه الفترة' :
                                 language === 'th' ? 'ไม่พบการเดิมพันสำหรับช่วงเวลานี้' :
                                 'No bets found for this period'}
                            </div>
                        ) : filteredMyBets.map((bet) => {
                            const parts = bet.matchName.split(' vs ');
                            let displayMatchName = bet.matchName;
                            if (parts.length === 2) {
                                const getTeamTrans = (orig: string) => {
                                    const exact = TEAM_NAMES[orig]?.[language];
                                    if (exact) return exact;
                                    const lowerOrig = orig.toLowerCase();
                                    for (const [key, translations] of Object.entries(TEAM_NAMES)) {
                                        if (lowerOrig.includes(key.toLowerCase()) && (translations as any)[language]) {
                                            return (translations as any)[language];
                                        }
                                    }
                                    return orig;
                                };
                                displayMatchName = `${getTeamTrans(parts[0])} vs ${getTeamTrans(parts[1])}`;
                            }
                            return (
                            <div key={bet.id} className="grid grid-cols-5 gap-4 p-4 items-center hover:bg-neutral-800/50 transition-colors text-sm">
                                <div className="col-span-2 font-medium text-neutral-300 truncate">
                                    {displayMatchName}
                                </div>
                                <div className="uppercase font-bold text-primary-purple flex flex-col gap-1">
                                    <span>{t(`outcome.${bet.outcome}`)}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md inline-block w-fit ${
                                        bet.status === 'win' ? 'bg-success/20 text-success' :
                                        bet.status === 'loss' ? 'bg-error/20 text-error' :
                                        bet.status === 'refunded' ? 'bg-neutral-700 text-neutral-300' :
                                        'bg-warning/20 text-warning'
                                    }`}>
                                        {bet.status === 'win' ? t('bets.status.win') : bet.status === 'loss' ? t('bets.status.loss') : bet.status === 'refunded' ? t('bets.status.refunded') : t('bets.status.pending')}
                                    </span>
                                </div>
                                <div className="text-right font-mono font-bold text-white">
                                    {typeof bet.amount === 'number' ? bet.amount.toFixed(2) : '0.00'}
                                    {bet.useBonus && <span className="ml-1 text-[10px] text-orange-400 font-sans">{t('bets.trial')}</span>}
                                </div>
                                <div className="text-right font-mono text-primary-blue font-bold">
                                    {bet.odds ? bet.odds.toFixed(2) : '-'}
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
             </div>
          )}
        </main>
      </div>

      <footer className="mt-auto w-full border-t border-neutral-800 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
        <div className="container mx-auto flex items-center justify-end px-4 lg:px-8 py-4">
          <Link
            href="/faq"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("footer.faq")}
          </Link>
        </div>
      </footer>

      {/* Transaction Overlay */}
      {(txStatus === 'submitting' || txStatus === 'confirming' || txStatus === 'success') && (
         <div className="fixed inset-0 z-[100] bg-neutral-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
               {/* Background Effects */}
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-purple via-primary-blue to-primary-purple animate-gradient-x"></div>
               
               <div className="text-center space-y-6 relative z-10">
                  <div className="flex justify-center">
                     {txStatus === 'success' ? (
                        <div className="h-20 w-20 bg-success/20 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                           <ShieldCheck className="h-10 w-10 text-success" />
                        </div>
                     ) : (
                        <div className="h-20 w-20 bg-neutral-900 rounded-full flex items-center justify-center relative">
                           <div className="absolute inset-0 rounded-full border-2 border-primary-purple/30 border-t-primary-purple animate-spin"></div>
                           <Trophy className="h-8 w-8 text-primary-purple animate-pulse" />
                        </div>
                     )}
                  </div>
                  
                  <div className="space-y-2">
                     <h3 className="text-2xl font-bold text-white">
                        {txStatus === 'submitting' && t('modal.sign_request')}
                        {txStatus === 'confirming' && t('modal.confirming_tx')}
                        {txStatus === 'success' && t('modal.prediction_placed')}
                     </h3>
                     <p className="text-neutral-400">
                        {txStatus === 'submitting' && t('modal.desc.sign')}
                        {txStatus === 'confirming' && t('modal.desc.confirming')}
                        {txStatus === 'success' && t('modal.desc.success')}
                     </p>
                  </div>

                  {/* Transaction Steps */}
                  <div className="flex justify-between items-center relative px-8 pt-4">
                     <div className="absolute left-10 right-10 top-1/2 h-0.5 bg-neutral-700 -z-10"></div>
                     <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors bg-primary-purple text-white`}>1</div>
                     <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${txStatus === 'confirming' || txStatus === 'success' ? 'bg-primary-purple text-white' : 'bg-neutral-700 text-neutral-400'}`}>2</div>
                     <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${txStatus === 'success' ? 'bg-success text-neutral-900' : 'bg-neutral-700 text-neutral-400'}`}>3</div>
                  </div>

                  {txStatus !== 'success' && (
                     <div className="pt-4">
                        <Button
                          variant="outline"
                          className="w-full border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-500"
                          onClick={handleCancelBet}
                        >
                          {t('referral.bind.btn_cancel') || '取消'}
                        </Button>
                     </div>
                  )}

                  {txStatus === 'success' && (
                     <div className="pt-4 animate-in slide-in-from-bottom-4 fade-in duration-500">
                        <Button className="w-full bg-neutral-700 hover:bg-neutral-600 text-white" onClick={() => setTxStatus('idle')}>
                           {t('btn.close')}
                        </Button>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}
      </>
      )}
    </div>
  )
}
