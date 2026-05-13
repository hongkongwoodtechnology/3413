type PayoutItem = {
  betId: string;
  matchName: string;
  userAddress: string;
  winAmount: number;
  type: 'win' | 'refund';
};

type PayoutPanelProps = {
  payouts: PayoutItem[];
  onMarkAllPaid?: () => void;
  isSubmitting?: boolean;
};

export function PayoutPanel({ payouts, onMarkAllPaid, isSubmitting = false }: PayoutPanelProps) {
  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-white">待派彩清單</div>
          <div className="mt-1 text-sm text-neutral-400">集中處理贏家與退款派彩，不在總覽頁混入細節。</div>
        </div>
        {onMarkAllPaid ? (
          <button
            onClick={onMarkAllPaid}
            disabled={isSubmitting || payouts.length === 0}
            className="rounded-xl border border-primary-purple/30 bg-primary-purple/10 px-4 py-2 text-sm font-bold text-primary-purple transition-colors hover:bg-primary-purple hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            全部標記已付款
          </button>
        ) : null}
      </div>

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 px-4 py-8 text-center text-sm text-neutral-400">
          目前沒有待派彩項目
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <div key={payout.betId} className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-bold text-white">{payout.matchName}</div>
                  <div className="mt-1 text-xs text-neutral-400">{payout.userAddress}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm uppercase tracking-[0.18em] text-neutral-500">{payout.type}</div>
                  <div className="mt-1 text-xl font-black text-white">${payout.winAmount.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
