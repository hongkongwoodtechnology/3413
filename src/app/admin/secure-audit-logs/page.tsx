"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Activity, AlertCircle, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AtaInitializationPanel } from '@/components/admin/system/AtaInitializationPanel';
import { USDT_MINT, getDestinationAtaTargets } from '@/lib/wallets';

type AuditLog = {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  target: string;
  details: string;
  ip: string;
  status: string;
};

type LogsResponse = {
  success: boolean;
  data?: AuditLog[];
};

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOC_TOKEN_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ASSOC_TOKEN_PROGRAM
  );
  return ata;
}

function hasValidAtaAccountData(raw: any): boolean {
  const dataArr = raw?.result?.value?.data;
  if (!dataArr) return false;

  const b64 = Array.isArray(dataArr) ? dataArr[0] : dataArr;
  if (!b64 || typeof b64 !== 'string') return false;

  try {
    return Buffer.from(b64, 'base64').length >= 72;
  } catch {
    return false;
  }
}

export default function AdminAuditLogsPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [ataInitStatus, setAtaInitStatus] = useState<'idle' | 'checking' | 'creating' | 'done' | 'error'>('idle');
  const [ataCheckResult, setAtaCheckResult] = useState<{ existing: string[]; needed: string[] } | null>(null);

  const destinationAtas = useMemo(
    () => getDestinationAtaTargets().map((target) => ({ ...target, ata: findAta(USDT_MINT, target.owner) })),
    []
  );

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/logs?search=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('資料載入失敗');
      const json = (await response.json()) as LogsResponse;
      if (!json.success) throw new Error('資料載入失敗');
      setLogs(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生未知錯誤');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  const checkAtas = useCallback(async () => {
    setAtaInitStatus('checking');
    setStatusMessage(null);
    setError(null);

    const existing: string[] = [];
    const needed: string[] = [];

    for (const { label, ata } of destinationAtas) {
      try {
        const body = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [ata.toBase58(), { commitment: 'confirmed', encoding: 'base64' }],
        });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch('/api/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          needed.push(label);
          continue;
        }
        const raw = await res.json();
        if (hasValidAtaAccountData(raw)) {
          existing.push(label);
        } else {
          needed.push(label);
        }
      } catch {
        needed.push(label);
      }
    }

    setAtaCheckResult({ existing, needed });
    setAtaInitStatus('idle');
  }, [destinationAtas]);

  const createAtas = useCallback(async () => {
    if (!sendTransaction || !publicKey || !ataCheckResult?.needed?.length) {
      setError('請先連接管理員錢包並完成 ATA 檢查');
      return;
    }

    setAtaInitStatus('creating');
    setError(null);
    setStatusMessage(null);

    try {
      const bhRes = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getLatestBlockhash',
          params: [{ commitment: 'finalized' }],
        }),
      });
      if (!bhRes.ok) throw new Error('無法取得最新區塊雜湊');
      const bhJson = await bhRes.json();
      const blockhash = bhJson?.result?.value?.blockhash;
      const lastValidBlockHeight = bhJson?.result?.value?.lastValidBlockHeight;
      if (!blockhash) throw new Error('無法取得最新區塊雜湊');

      const tx = new Transaction();
      tx.feePayer = publicKey;
      tx.recentBlockhash = blockhash;
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));

      const neededEntries = ataCheckResult.needed
        .map((label) => destinationAtas.find((entry) => entry.label === label))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      for (const { ata, owner } of neededEntries) {
        tx.add(new TransactionInstruction({
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
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

      const signature = await sendTransaction(tx, connection, { skipPreflight: false });
      if (typeof lastValidBlockHeight === 'number') {
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      } else {
        await connection.confirmTransaction(signature, 'confirmed');
      }
      setAtaInitStatus('done');
      setStatusMessage('ATA 建立交易已確認，正在重新檢查');
      await checkAtas();
    } catch (err) {
      setAtaInitStatus('error');
      setError(err instanceof Error ? err.message : 'ATA 建立失敗');
    }
  }, [ataCheckResult?.needed, checkAtas, connection, destinationAtas, publicKey, sendTransaction]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="安全與系統"
        description="集中查看審計日誌、ATA 初始化狀態與系統安全訊息"
        actions={
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        }
      />

      <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
          <div>
            <div className="font-semibold text-amber-200">嚴格存取控制啟用中</div>
            <p className="mt-1 text-sm leading-6 text-amber-100/85">
              此頁集中高敏感操作與審計資訊，避免分散在多個舊後台頁面中。
            </p>
          </div>
        </div>
      </div>

      {error || statusMessage ? (
        <div className={`rounded-3xl border px-5 py-4 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          {error || statusMessage}
        </div>
      ) : null}

      <AtaInitializationPanel
        status={ataInitStatus}
        ataCheckResult={ataCheckResult}
        onCheck={checkAtas}
        onCreate={createAtas}
      />

      <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/70 relative">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[1px]">
            <Activity className="h-8 w-8 animate-spin text-primary-purple" />
          </div>
        ) : null}
        <div className="flex flex-col gap-4 border-b border-neutral-800 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-lg font-bold text-white">近期操作紀錄</div>
            <div className="mt-1 text-sm text-neutral-400">查詢敏感操作、失敗嘗試與系統異常事件。</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="搜尋管理員或操作"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950/80 py-3 pl-9 pr-4 text-sm text-white outline-none transition-colors focus:border-primary-purple/40"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button
              onClick={handleSearch}
              className="rounded-xl border border-primary-blue/30 bg-primary-blue/10 px-4 py-3 text-sm font-bold text-primary-blue transition-colors hover:bg-primary-blue hover:text-white"
            >
              搜尋
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-950/80 text-neutral-400">
              <tr>
                <th className="px-6 py-4 font-semibold">時間</th>
                <th className="px-6 py-4 font-semibold">管理員</th>
                <th className="px-6 py-4 font-semibold">操作類型</th>
                <th className="px-6 py-4 font-semibold">目標</th>
                <th className="px-6 py-4 font-semibold">詳細資訊</th>
                <th className="px-6 py-4 font-semibold">IP</th>
                <th className="px-6 py-4 font-semibold">狀態</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                    找不到符合條件的日誌
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-neutral-800 text-neutral-200">
                    <td className="px-6 py-4 whitespace-nowrap text-neutral-400">{log.timestamp}</td>
                    <td className="px-6 py-4 font-medium text-white">{log.admin}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-300">{log.target}</td>
                    <td className="px-6 py-4 text-neutral-300">{log.details}</td>
                    <td className="px-6 py-4 font-mono text-xs text-neutral-500">{log.ip}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${log.status === 'SUCCESS' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        {log.status}
                      </span>
                    </td>
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
