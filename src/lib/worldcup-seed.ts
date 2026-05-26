import fs from 'fs';
import path from 'path';
import { TEAM_NAMES, COUNTRY_CODES } from '@/lib/dictionaries';

type MarketSideValues = {
  home: number;
  draw: number;
  away: number;
};

type MarketData = {
  realTotalPool: number;
  liabilities: MarketSideValues;
  pools: MarketSideValues;
  seedPools: MarketSideValues;
  initialOdds: MarketSideValues;
  initialProbs: MarketSideValues;
};

type WorldCupSeedEntry = {
  id: string;
  home: string;
  away: string;
  league: string;
  category: 'worldcup';
  date: string;
  timestamp: number;
  status: 'upcoming' | 'live' | 'finished';
  score: string;
  homeLogo?: string;
  awayLogo?: string;
};

type WorldCupSeedMatch = {
  id: string;
  league: string;
  category: 'worldcup';
  home: string;
  away: string;
  date: string;
  timestamp: number;
  pools: {
    home: number;
    draw: number;
    away: number;
  };
  status: 'upcoming' | 'live' | 'finished';
  score: string | null;
  homeLogo: string;
  awayLogo: string;
  marketData: MarketData;
};

type MatchWithCategory = {
  category: string;
};

const WORLD_CUP_SEED_PATH = path.join(process.cwd(), 'data', 'worldcup_schedule_2026.json');

const LEAGUE_LABELS: Record<string, Record<string, string>> = {
  'World Cup 2026': {
    'zh-TW': '世界盃 2026',
    'zh-CN': '世界杯 2026',
    'en': 'World Cup 2026',
  },
};

function translateName(name: string, lang: string): string {
  const entry = TEAM_NAMES[name];
  if (entry && entry[lang]) {
    return entry[lang];
  }
  return name;
}

function getFlagUrl(teamName: string): string {
  const code = COUNTRY_CODES[teamName];
  if (code) {
    return `https://flagcdn.com/w160/${code}.png`;
  }
  return '';
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateInitialOdds(matchId: string): { odds: MarketSideValues; probs: MarketSideValues; seedPools: MarketSideValues } {
  const seed = simpleHash(matchId);
  const pHome = 0.40 + (seed % 20) / 100;
  const pAway = 0.30 + ((seed * 2) % 15) / 100;
  let pDraw = 1 - pHome - pAway;
  if (pDraw < 0.1) {
    pDraw = 0.2;
  }

  const profitMarginMultiplier = 1.08;
  const initialOddsHome = parseFloat((1 / (pHome * profitMarginMultiplier)).toFixed(2));
  const initialOddsDraw = parseFloat((1 / (pDraw * profitMarginMultiplier)).toFixed(2));
  const initialOddsAway = parseFloat((1 / (pAway * profitMarginMultiplier)).toFixed(2));

  const seedTotalPool = 20;
  const seedPools = {
    home: seedTotalPool * pHome,
    draw: seedTotalPool * pDraw,
    away: seedTotalPool * pAway,
  };

  return {
    odds: { home: initialOddsHome, draw: initialOddsDraw, away: initialOddsAway },
    probs: { home: pHome, draw: pDraw, away: pAway },
    seedPools,
  };
}

function isValidSeedEntry(value: unknown): value is WorldCupSeedEntry {
  if (!value || typeof value !== 'object') return false;

  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' &&
    typeof entry.home === 'string' &&
    typeof entry.away === 'string' &&
    typeof entry.league === 'string' &&
    entry.category === 'worldcup' &&
    typeof entry.date === 'string' &&
    typeof entry.timestamp === 'number' &&
    (entry.status === 'upcoming' || entry.status === 'live' || entry.status === 'finished') &&
    typeof entry.score === 'string';
}

export function loadWorldCupSeed(lang?: string): WorldCupSeedMatch[] {
  try {
    const raw = fs.readFileSync(WORLD_CUP_SEED_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const locale = lang || 'en';

    return parsed
      .filter(isValidSeedEntry)
      .map((entry) => {
        const leagueLabel = LEAGUE_LABELS[entry.league];
        const translatedLeague = leagueLabel ? (leagueLabel[locale] || leagueLabel['en']) : entry.league;
        const { odds, probs, seedPools } = generateInitialOdds(entry.id);

        return {
          id: entry.id,
          league: translatedLeague,
          category: 'worldcup' as const,
          home: translateName(entry.home, locale),
          away: translateName(entry.away, locale),
          date: entry.date,
          timestamp: entry.timestamp,
          pools: { home: 0, draw: 0, away: 0 },
          status: entry.status,
          score: entry.score || null,
          homeLogo: getFlagUrl(entry.home),
          awayLogo: getFlagUrl(entry.away),
          marketData: {
            realTotalPool: 0,
            liabilities: { home: 0, draw: 0, away: 0 },
            pools: { home: 0, draw: 0, away: 0 },
            seedPools,
            initialOdds: odds,
            initialProbs: probs,
          },
        };
      });
  } catch {
    return [];
  }
}

export function applyWorldCupSeedFallback<T extends MatchWithCategory>(
  matches: T[],
  lang?: string
): Array<T | WorldCupSeedMatch> {
  const hasWorldCupMatch = matches.some((match) => match.category === 'worldcup');
  if (hasWorldCupMatch) return matches;

  const seedMatches = loadWorldCupSeed(lang);
  if (seedMatches.length === 0) return matches;

  return [...matches, ...seedMatches];
}
