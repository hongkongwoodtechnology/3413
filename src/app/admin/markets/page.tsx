"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MarketHealthPanel } from '@/components/admin/markets/MarketHealthPanel';
import { MarketList } from '@/components/admin/markets/MarketList';
import { MatchDetailTable } from '@/components/admin/markets/MatchDetailTable';
import { BettingBreakdownPanel } from '@/components/admin/markets/BettingBreakdownPanel';

type LiveMatch = {
  id: string;
  teamA: string;
  teamB: string;
  totalPool: number;
  totalBets: number;
  oddsA: string;
  oddsB: string;
  status: string;
};

type DashboardResponse = {
  success: boolean;
  data?: {
    liveMatches: LiveMatch[];
  };
};

type MatchBettingStat = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  status: string;
  score: string | null;
  homeAmount: number;
  drawAmount: number;
  awayAmount: number;
  totalPool: number;
  bonusAmount: number;
  bettorCount: number;
};

type BettingStatsSummary = {
  totalMatches: number;
  grandTotal: number;
  grandBonus: number;
  totalBettors: number;
};

type BettingStatsResponse = {
  success: boolean;
  data?: {
    matches: MatchBettingStat[];
    summary: BettingStatsSummary;
  };
};

export default function AdminMarketsPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bettingStats, setBettingStats] = useState<MatchBettingStat[]>([]);
  const [bettingSummary, setBettingSummary] = useState<BettingStatsSummary>({
    totalMatches: 0,
    grandTotal: 0,
    grandBonus: 0,
    totalBettors: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(10);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  const fetchMarkets = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/dashboard');
      if (!response.ok) {
        throw new Error('無法載入市場資料');
      }

      const json = (await response.json()) as DashboardResponse;
      setMatches(json.data?.liveMatches ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '無法載入市場資料');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const fetchBettingStats = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const response = await fetch('/api/admin/betting-stats');
      if (!response.ok) {
        throw new Error('無法載入投注統計');
      }

      const json = (await response.json()) as BettingStatsResponse;
      if (json.success && json.data) {
        setBettingStats(json.data.matches);
        setBettingSummary(json.data.summary);
        setLastUpdated(new Date());
      }
    } catch {
      // Silently handle refresh errors
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    fetchBettingStats();
  }, [fetchMarkets, fetchBettingStats]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchBettingStats();
      }, autoRefreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefreshInterval, fetchBettingStats]);

  const totalPool = useMemo(() => matches.reduce((sum, match) => sum + match.totalPool, 0), [matches]);
  const topMatchShare = useMemo(() => {
    if (totalPool === 0) return 0;
    const maxPool = matches.reduce((max, match) => Math.max(max, match.totalPool), 0);
    return (maxPool / totalPool) * 100;
  }, [matches, totalPool]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="市場與賽事"
        description="監控賽事資金分布、集中度與即時投注明細"
        actions={
          <button
            onClick={() => { fetchMarkets(); fetchBettingStats(); }}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        }
      />

      {error ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <MarketHealthPanel totalPool={totalPool} liveMatches={matches.length} topMatchShare={topMatchShare} />
      <MarketList matches={matches} />
      <MatchDetailTable matches={matches} />

      <BettingBreakdownPanel
        matches={bettingStats}
        summary={bettingSummary}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        autoRefreshInterval={autoRefreshInterval}
        onIntervalChange={setAutoRefreshInterval}
      />
    </div>
  );
}
