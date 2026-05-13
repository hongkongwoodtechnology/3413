type DangerActionsPanelProps = {
  onArchive: () => void;
  onMarkLegacyWins: () => void;
  isSubmitting: boolean;
};

export function DangerActionsPanel({ onArchive, onMarkLegacyWins, isSubmitting }: DangerActionsPanelProps) {
  return (
    <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5">
      <div className="text-lg font-bold text-white">高風險操作</div>
      <p className="mt-2 text-sm leading-6 text-neutral-300">
        將舊架構資料整理與不可逆流程集中在同一區，避免出現在總覽與首頁摘要中。
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={onArchive}
          disabled={isSubmitting}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          封存舊注單
        </button>
        <button
          onClick={onMarkLegacyWins}
          disabled={isSubmitting}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          標記舊架構贏家
        </button>
      </div>
    </div>
  );
}
