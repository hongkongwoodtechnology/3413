type MatchDetail = {
  id: string;
  teamA: string;
  teamB: string;
  totalPool: number;
  totalBets: number;
  oddsA: string;
  oddsB: string;
};

type MatchDetailTableProps = {
  matches: MatchDetail[];
};

export function MatchDetailTable({ matches }: MatchDetailTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/70">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-950/80 text-neutral-400">
          <tr>
            <th className="px-4 py-3">對戰</th>
            <th className="px-4 py-3">投注池</th>
            <th className="px-4 py-3">投注筆數</th>
            <th className="px-4 py-3">主隊賠率</th>
            <th className="px-4 py-3">客隊賠率</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr key={match.id} className="border-t border-neutral-800 text-neutral-200">
              <td className="px-4 py-3">{match.teamA} vs {match.teamB}</td>
              <td className="px-4 py-3">${match.totalPool.toLocaleString()}</td>
              <td className="px-4 py-3">{match.totalBets}</td>
              <td className="px-4 py-3">{match.oddsA}</td>
              <td className="px-4 py-3">{match.oddsB}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
