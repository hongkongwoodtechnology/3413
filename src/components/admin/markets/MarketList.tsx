type MarketListMatch = {
  id: string;
  teamA: string;
  teamB: string;
  status: string;
  totalPool: number;
  totalBets: number;
};

type MarketListProps = {
  matches: MarketListMatch[];
};

export function MarketList({ matches }: MarketListProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {matches.map((match) => (
        <div key={match.id} className="rounded-3xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="text-lg font-bold text-white">{match.teamA} vs {match.teamB}</div>
          <div className="mt-2 text-sm text-neutral-400">狀態: {match.status}</div>
          <div className="mt-4 flex items-center justify-between text-sm text-neutral-300">
            <span>投注池 ${match.totalPool.toLocaleString()}</span>
            <span>{match.totalBets} 筆投注</span>
          </div>
        </div>
      ))}
    </div>
  );
}
