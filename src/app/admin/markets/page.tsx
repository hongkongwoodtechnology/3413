"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MarketHealthPanel } from '@/components/admin/markets/MarketHealthPanel';
import { MarketList } from '@/components/admin/markets/MarketList';
import { MatchDetailTable } from '@/components/admin/markets/MatchDetailTable';

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

export default function AdminMarketsPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

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
            onClick={fetchMarkets}
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
    </div>
  );
}
