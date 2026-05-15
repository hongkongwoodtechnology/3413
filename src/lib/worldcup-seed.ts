import fs from 'fs';
import path from 'path';

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
};

type MatchWithCategory = {
  category: string;
};

const WORLD_CUP_SEED_PATH = path.join(process.cwd(), 'data', 'worldcup_schedule_2026.json');

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

export function loadWorldCupSeed(): WorldCupSeedMatch[] {
  try {
    const raw = fs.readFileSync(WORLD_CUP_SEED_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isValidSeedEntry)
      .map((entry) => ({
        id: entry.id,
        league: entry.league,
        category: 'worldcup',
        home: entry.home,
        away: entry.away,
        date: entry.date,
        timestamp: entry.timestamp,
        pools: { home: 0, draw: 0, away: 0 },
        status: entry.status,
        score: entry.score || null,
        homeLogo: entry.homeLogo || '',
        awayLogo: entry.awayLogo || '',
      }));
  } catch {
    return [];
  }
}

export function applyWorldCupSeedFallback<T extends MatchWithCategory>(
  matches: T[]
): Array<T | WorldCupSeedMatch> {
  const hasWorldCupMatch = matches.some((match) => match.category === 'worldcup');
  if (hasWorldCupMatch) return matches;

  const seedMatches = loadWorldCupSeed();
  if (seedMatches.length === 0) return matches;

  return [...matches, ...seedMatches];
}
