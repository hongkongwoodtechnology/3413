import { Match as BaseMatch } from "@/lib/types";
import { TEAM_NAMES, LEAGUES } from "@/lib/dictionaries";

type MarketSideValues = {
  home: number;
  draw: number;
  away: number;
};

export type MatchWithMarketData = BaseMatch & {
  marketData?: {
    realTotalPool: number;
    liabilities: MarketSideValues;
    pools: MarketSideValues;
    attractionWindowUsed?: MarketSideValues;
    seedPools?: MarketSideValues;
    initialOdds: MarketSideValues;
    initialProbs?: MarketSideValues;
  };
};

function translateTeamName(
  originalName: string | undefined,
  language: string
): string | null {
  if (!originalName) {
    return null;
  }

  const exactMatch = TEAM_NAMES[originalName]?.[language];
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedOriginal = originalName.toLowerCase();
  for (const [key, translations] of Object.entries(TEAM_NAMES)) {
    if (
      normalizedOriginal.includes(key.toLowerCase()) &&
      (translations as Record<string, string | undefined>)[language]
    ) {
      return (translations as Record<string, string | undefined>)[language] ?? originalName;
    }
  }

  return originalName;
}

export function translateMatches<T extends MatchWithMarketData>(
  matches: T[],
  language: string
): T[] {
  return matches.map((match) => {
    const translatedMatch = { ...match };

    if (match.homeOriginal) {
      const homeTranslation = translateTeamName(match.homeOriginal, language);
      if (homeTranslation) {
        translatedMatch.home = homeTranslation;
      }
    }

    if (match.awayOriginal) {
      const awayTranslation = translateTeamName(match.awayOriginal, language);
      if (awayTranslation) {
        translatedMatch.away = awayTranslation;
      }
    }

    if (match.leagueOriginal) {
      const leagueMatch = LEAGUES.find((league) => {
        const leagueName = league.name.toLowerCase();
        const sourceName = match.leagueOriginal!.toLowerCase();
        let matchesLeague =
          leagueName === sourceName ||
          leagueName.includes(sourceName) ||
          sourceName.includes(leagueName);

        if (!matchesLeague && (league as { aliases?: string[] }).aliases) {
          matchesLeague = (league as { aliases?: string[] }).aliases!.some((alias) => {
            const normalizedAlias = alias.toLowerCase();
            return (
              normalizedAlias === sourceName ||
              normalizedAlias.includes(sourceName) ||
              sourceName.includes(normalizedAlias)
            );
          });
        }

        return matchesLeague;
      });

      if (
        leagueMatch &&
        leagueMatch.names &&
        (leagueMatch.names as Record<string, string | undefined>)[language]
      ) {
        translatedMatch.league =
          (leagueMatch.names as Record<string, string | undefined>)[language] ??
          translatedMatch.league;
      }
    }

    return translatedMatch;
  });
}

export function mergeIncomingMatches<T extends MatchWithMarketData>(
  prev: T[],
  incoming: T[]
): T[] {
  if (prev.length === 0) {
    return incoming;
  }

  const dataMap = new Map(incoming.map((match) => [String(match.id), match]));
  const merged: T[] = [];

  for (const previousMatch of prev) {
    const fresh = dataMap.get(String(previousMatch.id));
    if (!fresh) {
      merged.push(previousMatch);
      continue;
    }

    dataMap.delete(String(previousMatch.id));

    if (
      previousMatch.marketData &&
      fresh.marketData &&
      previousMatch.marketData.realTotalPool > fresh.marketData.realTotalPool
    ) {
      merged.push({
        ...fresh,
        marketData: previousMatch.marketData,
        pools: previousMatch.pools,
      });
    } else {
      merged.push(fresh);
    }
  }

  for (const [, match] of dataMap) {
    merged.push(match);
  }

  return merged;
}
