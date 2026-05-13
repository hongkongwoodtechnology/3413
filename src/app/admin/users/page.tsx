"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Activity, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ReferralTools } from '@/components/admin/users/ReferralTools';

type AdminUser = {
  id: string;
  address: string;
  refCode?: string;
  totalAmount: number;
  joinedAt: string;
  type: string;
  commission: number;
  downlines: number;
};

type UsersResponse = {
  success: boolean;
  data?: AdminUser[];
};

export default function AdminUsersPage() {
  const { publicKey } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all'); // all, user, referrer
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [airdropAddress, setAirdropAddress] = useState('');
  const [airdropAmount, setAirdropAmount] = useState('');
  const [rateAddress, setRateAddress] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?type=${searchType}&search=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error('資料載入失敗');
      }
      const json = (await response.json()) as UsersResponse;
      if (!json.success) throw new Error('資料載入失敗');
      setUsers(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生未知錯誤');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, searchType]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = useCallback(() => {
    fetchUsers();
  }, [fetchUsers]);

  const callReferralAction = useCallback(async (payload: Record<string, unknown>) => {
    if (!publicKey) {
      setError('請先連接管理員錢包');
      return null;
    }

    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminAddress: publicKey.toBase58(),
        ...payload,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || '操作失敗');
    }
    return json;
  }, [publicKey]);

  const handleAirdrop = useCallback(async () => {
    setIsAirdropping(true);
    setError(null);
    setStatusMessage(null);
    try {
      await callReferralAction({
        action: 'airdrop_bonus',
        targetAddress: airdropAddress,
        amount: parseFloat(airdropAmount),
      });
      setStatusMessage(`已發送 ${airdropAmount} tUSDT`);
      setAirdropAddress('');
      setAirdropAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '發送失敗');
    } finally {
      setIsAirdropping(false);
    }
  }, [airdropAddress, airdropAmount, callReferralAction]);

  const handleUpdateRate = useCallback(async () => {
    setIsUpdatingRate(true);
    setError(null);
    setStatusMessage(null);
    try {
      await callReferralAction({
        action: 'update_commission_rate',
        targetAddress: rateAddress,
        rate: parseFloat(commissionRate) / 100,
      });
      setStatusMessage('佣金比例已更新');
      setRateAddress('');
      setCommissionRate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失敗');
    } finally {
      setIsUpdatingRate(false);
    }
  }, [callReferralAction, commissionRate, rateAddress]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="用戶與推薦"
        description="搜尋用戶、查看推薦關係，並集中管理體驗金與佣金比例"
        actions={
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        }
      />

      {error || statusMessage ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          {error || statusMessage}
        </div>
      ) : null}

      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="搜尋用戶 ID、錢包地址或推薦碼"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950/80 py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-primary-purple/40"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="flex gap-3">
            <select
              className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary-purple/40"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
            >
              <option value="all">所有身份</option>
              <option value="user">一般用戶</option>
              <option value="referrer">介紹人</option>
            </select>
            <button
              onClick={handleSearch}
              className="rounded-xl border border-primary-blue/30 bg-primary-blue/10 px-5 py-3 text-sm font-bold text-primary-blue transition-colors hover:bg-primary-blue hover:text-white"
            >
              搜尋
            </button>
          </div>
        </div>
      </div>

      <ReferralTools
        airdropAddress={airdropAddress}
        airdropAmount={airdropAmount}
        rateAddress={rateAddress}
        commissionRate={commissionRate}
        onAirdropAddressChange={setAirdropAddress}
        onAirdropAmountChange={setAirdropAmount}
        onRateAddressChange={setRateAddress}
        onCommissionRateChange={setCommissionRate}
        onAirdrop={handleAirdrop}
        onUpdateRate={handleUpdateRate}
        isAirdropping={isAirdropping}
        isUpdatingRate={isUpdatingRate}
      />

      <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/70">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <div className="text-lg font-bold text-white">查詢結果</div>
            <div className="mt-1 text-sm text-neutral-400">已套用脫敏處理，避免後台直接暴露完整敏感資料。</div>
          </div>
        </div>
        <div className="overflow-x-auto relative">
          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[1px]">
              <Activity className="h-8 w-8 animate-spin text-primary-purple" />
            </div>
          ) : null}
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-950/80 text-neutral-400">
              <tr>
                <th className="px-6 py-4 font-semibold">用戶 / 錢包</th>
                <th className="px-6 py-4 font-semibold">身份</th>
                <th className="px-6 py-4 font-semibold">推薦碼</th>
                <th className="px-6 py-4 font-semibold">總投注額</th>
                <th className="px-6 py-4 font-semibold">下線 / 佣金</th>
                <th className="px-6 py-4 font-semibold">加入時間</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                    找不到符合條件的資料
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-neutral-800 text-neutral-200">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{user.id}</div>
                      <div className="mt-1 font-mono text-xs text-neutral-500">{user.address}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${user.type === 'Referrer' ? 'border-primary-purple/30 bg-primary-purple/10 text-primary-purple' : 'border-neutral-700 bg-neutral-800 text-neutral-300'}`}>
                        {user.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-300">{user.refCode || '-'}</td>
                    <td className="px-6 py-4 font-bold text-white">${user.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-neutral-300">
                      {user.type === 'Referrer' ? `${user.downlines} 人 / $${user.commission}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-neutral-400">{user.joinedAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
