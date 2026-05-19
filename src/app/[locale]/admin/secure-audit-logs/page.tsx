"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ComputeBudgetProgram, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { ShieldAlert } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AtaInitializationPanel } from '@/components/admin/system/AtaInitializationPanel';
import { USDT_MINT, getDestinationAtaTargets } from '@/lib/wallets';

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
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [ataInitStatus, setAtaInitStatus] = useState<'idle' | 'checking' | 'creating' | 'done' | 'error'>('idle');
  const [ataCheckResult, setAtaCheckResult] = useState<{ existing: string[]; needed: string[] } | null>(null);

  const destinationAtas = useMemo(
    () => getDestinationAtaTargets().map((target) => ({ ...target, ata: findAta(USDT_MINT, target.owner) })),
    []
  );

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
    </div>
  );
}
