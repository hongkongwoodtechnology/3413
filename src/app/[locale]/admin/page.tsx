"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { OverviewAlerts } from '@/components/admin/overview/OverviewAlerts';
import { OverviewKpiGrid } from '@/components/admin/overview/OverviewKpiGrid';
import { OverviewShortcuts } from '@/components/admin/overview/OverviewShortcuts';

type StatsResponse = {
  success: boolean;
  data?: {
    totalVolume: number;
    totalBets: number;
    totalBettors: number;
    totalPoolFromMarket: number;
  };
};

type PayoutResponse = {
  success: boolean;
  count?: number;
  totalOwed?: number;
};

type ReserveResponse = {
  success?: boolean;
  balance?: number;
  totalAccumulated?: number;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<StatsResponse['data'] | null>(null);
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const [totalOwed, setTotalOwed] = useState(0);
  const [reserveBalance, setReserveBalance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const [statsRes, payoutRes, reserveRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/payout'),
        fetch('/api/admin/reserve'),
      ]);

      if (!statsRes.ok || !payoutRes.ok || !reserveRes.ok) {
        throw new Error('無法載入後台總覽資料');
      }

      const statsJson = (await statsRes.json()) as StatsResponse;
      const payoutJson = (await payoutRes.json()) as PayoutResponse;
      const reserveJson = (await reserveRes.json()) as ReserveResponse;

      setStats(statsJson.data ?? null);
      setPendingPayouts(payoutJson.count ?? 0);
      setTotalOwed(payoutJson.totalOwed ?? 0);
      setReserveBalance(reserveJson.balance ?? 0);
      setLastUpdated(new Date());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '無法載入後台總覽資料');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const kpiItems = useMemo(
    () => [
      { label: '總投注額', value: `$${(stats?.totalVolume ?? 0).toLocaleString()}` },
      { label: '投注筆數', value: `${(stats?.totalBets ?? 0).toLocaleString()}` },
      { label: '投注人數', value: `${(stats?.totalBettors ?? 0).toLocaleString()}` },
      { label: '平台儲備池', value: `$${reserveBalance.toLocaleString()}`, tone: 'success' as const },
    ],
    [reserveBalance, stats]
  );

  const alerts = useMemo(
    () => [
      {
        title: '待派彩提醒',
        description:
          pendingPayouts > 0
            ? `目前有 ${pendingPayouts} 筆待派彩，合計應付 $${totalOwed.toLocaleString()}，請前往財務與派彩模組處理。`
            : '目前沒有待派彩注單，財務結算狀態正常。',
        tone: pendingPayouts > 0 ? ('warning' as const) : ('success' as const),
      },
      {
        title: '收益摘要',
        description:
          stats && stats.totalPoolFromMarket > 0
            ? `目前市場總池約 $${stats.totalPoolFromMarket.toLocaleString()}，可用於快速判斷平台整體運行規模。`
            : '尚未累積足夠市場資料，建議前往市場與賽事模組檢查即時池況。',
        tone: 'default' as const,
      },
    ],
    [pendingPayouts, stats, totalOwed]
  );

  const shortcuts = [
    { label: '市場與賽事', href: '/admin/markets' },
    { label: '財務與派彩', href: '/admin/finance' },
    { label: '用戶與推薦', href: '/admin/users' },
    { label: '安全與系統', href: '/admin/secure-audit-logs' },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="總覽"
        description={`營運摘要、風險提醒與快捷入口${lastUpdated ? `，最後更新 ${lastUpdated.toLocaleTimeString()}` : ''}`}
        actions={
          <button
            onClick={fetchOverview}
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

      <OverviewKpiGrid items={kpiItems} />
      <OverviewAlerts alerts={alerts} />
      <OverviewShortcuts items={shortcuts} />
    </div>
  );
}
