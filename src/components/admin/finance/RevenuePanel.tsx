type RevenuePanelProps = {
  reserveBalance: number;
  totalOwed: number;
};

export function RevenuePanel({ reserveBalance, totalOwed }: RevenuePanelProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
        <div className="text-sm text-neutral-400">平台儲備池</div>
        <div className="mt-3 text-3xl font-black text-white">${reserveBalance.toLocaleString()}</div>
      </div>
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
        <div className="text-sm text-neutral-400">待派彩金額</div>
        <div className="mt-3 text-3xl font-black text-white">${totalOwed.toLocaleString()}</div>
      </div>
    </div>
  );
}
