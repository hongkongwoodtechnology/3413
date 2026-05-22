"use client";

import React from 'react';
import { TrendingUp, Users, DollarSign, Zap } from 'lucide-react';

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

type BettingBreakdownPanelProps = {
  matches: MatchBettingStat[];
  summary: BettingStatsSummary;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  autoRefreshInterval: number;
  onIntervalChange: (seconds: number) => void;
};

const STATUS_LABELS: Record<string, string> = {
  active: '進行中',
  finished: '已結束',
  settled: '已結算',
  unknown: '未知',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  finished: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
  settled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  unknown: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function getAmountWidth(amount: number, maxAmount: number): string {
  if (maxAmount <= 0) return '0%';
  return `${Math.max((amount / maxAmount) * 100, 0).toFixed(1)}%`;
}

export function BettingBreakdownPanel({
  matches,
  summary,
  lastUpdated,
  isRefreshing,
  autoRefreshInterval,
  onIntervalChange,
}: BettingBreakdownPanelProps) {
  const maxTotal = Math.max(...matches.map((m) => m.totalPool), 1);
  const maxSingleOutcome = Math.max(
    ...matches.flatMap((m) => [m.homeAmount, m.drawAmount, m.awayAmount]),
    1
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">即時投注明細</h2>
          <p className="mt-1 text-sm text-neutral-400">
            每場賽事主客和投注金額與總池
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/60 px-3 py-2">
            <Zap size={14} className="text-primary-purple" />
            <select
              value={autoRefreshInterval}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              className="bg-transparent text-sm text-neutral-300 outline-none"
            >
              <option value={0}>手動刷新</option>
              <option value={5}>5 秒</option>
              <option value={10}>10 秒</option>
              <option value={30}>30 秒</option>
              <option value={60}>60 秒</option>
            </select>
          </div>
          {lastUpdated && (
            <span className="text-xs text-neutral-500">
              更新於 {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {isRefreshing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-purple/20 px-3 py-1 text-xs text-primary-purple">
              <TrendingUp size={12} className="animate-pulse" />
              刷新中
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <DollarSign size={16} />
            總投注額
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            ${summary.grandTotal.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <TrendingUp size={16} />
            賽事數量
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {summary.totalMatches}
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Users size={16} />
            投注人數
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {summary.totalBettors.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 text-sm text-yellow-400">
            <Zap size={16} />
            體驗金投注
          </div>
          <div className="mt-2 text-2xl font-black text-yellow-300">
            ${summary.grandBonus.toLocaleString()}
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 px-5 py-12 text-center text-neutral-400">
          尚無投注數據
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-950/80 text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">賽事</th>
                  <th className="px-4 py-3 font-medium">狀態</th>
                  <th className="px-4 py-3 text-right font-medium">主勝</th>
                  <th className="px-4 py-3 text-right font-medium">和局</th>
                  <th className="px-4 py-3 text-right font-medium">客勝</th>
                  <th className="px-4 py-3 text-right font-medium">總投注額</th>
                  <th className="px-4 py-3 text-right font-medium">投注人數</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr
                    key={match.matchId}
                    className="border-t border-neutral-800 transition-colors hover:bg-neutral-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {match.homeTeam} vs {match.awayTeam}
                      </div>
                      {match.league ? (
                        <div className="mt-0.5 text-xs text-neutral-500">{match.league}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[match.status] || STATUS_STYLES.unknown
                        }`}
                      >
                        {STATUS_LABELS[match.status] || match.status}
                      </span>
                      {match.score && (
                        <span className="ml-2 text-xs text-neutral-300">{match.score}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <div
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-green-500/30"
                          style={{
                            width: getAmountWidth(match.homeAmount, maxSingleOutcome),
                          }}
                        />
                        <span
                          className={`font-mono text-sm tabular-nums ${
                            match.homeAmount > 0 ? 'text-green-400' : 'text-neutral-500'
                          }`}
                        >
                          ${match.homeAmount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <div
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500/30"
                          style={{
                            width: getAmountWidth(match.drawAmount, maxSingleOutcome),
                          }}
                        />
                        <span
                          className={`font-mono text-sm tabular-nums ${
                            match.drawAmount > 0 ? 'text-blue-400' : 'text-neutral-500'
                          }`}
                        >
                          ${match.drawAmount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <div
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-orange-500/30"
                          style={{
                            width: getAmountWidth(match.awayAmount, maxSingleOutcome),
                          }}
                        />
                        <span
                          className={`font-mono text-sm tabular-nums ${
                            match.awayAmount > 0 ? 'text-orange-400' : 'text-neutral-500'
                          }`}
                        >
                          ${match.awayAmount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <div
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary-purple/30"
                          style={{
                            width: getAmountWidth(match.totalPool, maxTotal),
                          }}
                        />
                        <span className="font-mono text-sm font-bold tabular-nums text-white">
                          ${match.totalPool.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-neutral-300">
                        {match.bettorCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
