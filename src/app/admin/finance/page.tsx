"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DangerActionsPanel } from '@/components/admin/finance/DangerActionsPanel';
import { PayoutPanel } from '@/components/admin/finance/PayoutPanel';
import { RevenuePanel } from '@/components/admin/finance/RevenuePanel';

type PayoutResponse = {
  success: boolean;
  payouts?: Array<{
    betId: string;
    matchName: string;
    userAddress: string;
    winAmount: number;
    type: 'win' | 'refund';
  }>;
  totalOwed?: number;
};

type ReserveResponse = {
  success?: boolean;
  balance?: number;
};

export default function AdminFinancePage() {
  const [payouts, setPayouts] = useState<PayoutResponse['payouts']>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [reserveBalance, setReserveBalance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFinance = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const [payoutRes, reserveRes] = await Promise.all([
        fetch('/api/admin/payout'),
        fetch('/api/admin/reserve'),
      ]);

      if (!payoutRes.ok || !reserveRes.ok) {
        throw new Error('無法載入財務資料');
      }

      const payoutJson = (await payoutRes.json()) as PayoutResponse;
      const reserveJson = (await reserveRes.json()) as ReserveResponse;

      setPayouts(payoutJson.payouts ?? []);
      setTotalOwed(payoutJson.totalOwed ?? 0);
      setReserveBalance(reserveJson.balance ?? 0);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '無法載入財務資料');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFinance();
  }, [fetchFinance]);

  const runPayoutAction = useCallback(async (action: 'mark_paid' | 'archive_old_bets' | 'mark_legacy_wins') => {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '財務操作失敗');
      }

      const messages: Record<typeof action, string> = {
        mark_paid: `已標記 ${data.marked ?? 0} 筆為已付款`,
        archive_old_bets: data.message || `已封存 ${data.archived ?? 0} 筆舊注單`,
        mark_legacy_wins: data.message || `已標記 ${data.marked ?? 0} 筆舊架構贏家`,
      };

      setMessage(messages[action]);
      await fetchFinance();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '財務操作失敗');
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchFinance]);

  const alertToneClass = useMemo(() => {
    if (error) return 'border-red-500/30 bg-red-500/10 text-red-200';
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }, [error]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="財務與派彩"
        description="集中處理平台資金摘要、待派彩清單與高風險財務操作"
        actions={
          <button
            onClick={fetchFinance}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        }
      />

      {error || message ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${alertToneClass}`}>
          {error || message}
        </div>
      ) : null}

      <RevenuePanel reserveBalance={reserveBalance} totalOwed={totalOwed} />
      <PayoutPanel
        payouts={payouts ?? []}
        onMarkAllPaid={() => runPayoutAction('mark_paid')}
        isSubmitting={isSubmitting}
      />
      <DangerActionsPanel
        onArchive={() => runPayoutAction('archive_old_bets')}
        onMarkLegacyWins={() => runPayoutAction('mark_legacy_wins')}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
