type MarketHealthPanelProps = {
  totalPool: number;
  liveMatches: number;
  topMatchShare: number;
};

export function MarketHealthPanel({ totalPool, liveMatches, topMatchShare }: MarketHealthPanelProps) {
  const cards = [
    { label: '總市場池', value: `$${totalPool.toLocaleString()}` },
    { label: '即時賽事', value: `${liveMatches}` },
    { label: '集中度', value: `${topMatchShare.toFixed(1)}%` },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="text-sm text-neutral-400">{card.label}</div>
          <div className="mt-3 text-3xl font-black text-white">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
