
export interface MatchPools {
  home: number;
  draw: number;
  away: number;
}

export interface Match {
  id: number;
  league: string;
  category: 'elite' | 'asian' | 'european' | 'americas' | 'women';
  home: string;
  away: string;
  homeOriginal?: string;
  awayOriginal?: string;
  leagueOriginal?: string;
  homeLogo?: string;
  awayLogo?: string;
  date: string;
  timestamp?: number;
  liveMinute?: number;
  pools: MatchPools;
  status: "upcoming" | "live" | "finished";
  score: string | null;
}
