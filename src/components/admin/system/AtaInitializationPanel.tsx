import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type AtaInitializationPanelProps = {
  status: 'idle' | 'checking' | 'creating' | 'done' | 'error';
  ataCheckResult?: { existing: string[]; needed: string[] } | null;
  onCheck: () => void;
  onCreate: () => void;
};

export function AtaInitializationPanel({
  status,
  ataCheckResult = null,
  onCheck,
  onCreate,
}: AtaInitializationPanelProps) {
  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
      <div className="text-lg font-bold text-white">ATA 初始化</div>
      <p className="mt-2 text-sm leading-6 text-neutral-400">
        檢查平台收款與分潤錢包的 USDT ATA 是否完整，缺少時可直接建立。
      </p>

      {status === 'checking' ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-primary-purple/20 bg-primary-purple/5 px-4 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary-purple" />
          <span className="text-sm font-medium text-primary-purple">正在檢查 RPC 節點上的 ATA 帳戶狀態…</span>
        </div>
      ) : status === 'creating' ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          <span className="text-sm font-medium text-amber-300">正在建立缺少的 ATA，請在錢包中確認交易…</span>
        </div>
      ) : status === 'done' ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-300">ATA 已全部就緒，平台收款帳戶完整。</span>
        </div>
      ) : status === 'error' ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-sm font-medium text-red-300">ATA 操作發生錯誤，請檢查錢包連線後重試。</span>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={onCheck}
            className="rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white"
          >
            檢查 ATA
          </button>
          <button
            onClick={onCreate}
            disabled={!ataCheckResult?.needed?.length}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            建立缺少的 ATA
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Existing</div>
          <div className="mt-3 space-y-2 text-sm text-neutral-300">
            {(ataCheckResult?.existing?.length ?? 0) > 0 ? (
              ataCheckResult?.existing.map((label) => <div key={label}>{label}</div>)
            ) : status === 'checking' ? (
              <div className="flex items-center gap-2 text-neutral-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                檢查中…
              </div>
            ) : (
              <div>尚未檢查</div>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Needed</div>
          <div className="mt-3 space-y-2 text-sm text-neutral-300">
            {(ataCheckResult?.needed?.length ?? 0) > 0 ? (
              ataCheckResult?.needed.map((label) => <div key={label}>{label}</div>)
            ) : status === 'checking' ? (
              <div className="flex items-center gap-2 text-neutral-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                檢查中…
              </div>
            ) : (
              <div>目前沒有待建立項目</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
