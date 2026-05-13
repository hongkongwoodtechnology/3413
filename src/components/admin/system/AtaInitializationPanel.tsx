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

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={onCheck}
          disabled={status === 'checking' || status === 'creating'}
          className="rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          檢查 ATA
        </button>
        <button
          onClick={onCreate}
          disabled={status === 'checking' || status === 'creating' || !ataCheckResult?.needed?.length}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          建立缺少的 ATA
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Existing</div>
          <div className="mt-3 space-y-2 text-sm text-neutral-300">
            {(ataCheckResult?.existing?.length ?? 0) > 0 ? (
              ataCheckResult?.existing.map((label) => <div key={label}>{label}</div>)
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
            ) : (
              <div>目前沒有待建立項目</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
