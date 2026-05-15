import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveMatches } from "@/lib/api";
import {
  shouldShowMatchesLoading,
  shouldStartMatchesLoading,
} from "@/lib/live-matches-loading";
import {
  mergeIncomingMatches,
  translateMatches,
  type MatchWithMarketData,
} from "@/hooks/homeMatchesData.helpers";
export type { MatchWithMarketData } from "@/hooks/homeMatchesData.helpers";

type UseHomeMatchesDataOptions<T extends MatchWithMarketData> = {
  language: string;
  shouldPauseMatchesFetching: boolean;
  initialMatches?: T[];
};

function computeFingerprint<T extends MatchWithMarketData>(list: T[]): string {
  const parts: string[] = [];
  for (const match of list) {
    parts.push(
      `${match.id}:${match.status}:${match.score ?? "-"}:${match.liveMinute ?? 0}:${match.home}:${match.away}`
    );
    if (match.marketData) {
      parts.push(
        `${match.marketData.realTotalPool}:${match.marketData.liabilities.home}:${match.marketData.liabilities.draw}:${match.marketData.liabilities.away}`
      );
    }
  }
  return parts.join("|");
}

export function useHomeMatchesData<T extends MatchWithMarketData>({
  language,
  shouldPauseMatchesFetching,
  initialMatches = [] as T[],
}: UseHomeMatchesDataOptions<T>) {
  const [matches, setMatches] = useState<T[]>(initialMatches);
  const [isLoading, setIsLoading] = useState(true);
  const matchesFingerprintRef = useRef<string>(computeFingerprint(initialMatches));

  const setMatchesIfChanged = useCallback(
    (next: T[] | ((prev: T[]) => T[])) => {
      setMatches((prev) => {
        const resolved =
          typeof next === "function" ? (next as (prev: T[]) => T[])(prev) : next;
        const fingerprint = computeFingerprint(resolved);
        if (fingerprint === matchesFingerprintRef.current) {
          return prev;
        }
        matchesFingerprintRef.current = fingerprint;
        return resolved;
      });
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    let initialFetchTimeoutId: ReturnType<typeof setTimeout> | undefined;

    if (shouldPauseMatchesFetching) {
      setIsLoading(false);
      return () => {
        isMounted = false;
        if (initialFetchTimeoutId) {
          clearTimeout(initialFetchTimeoutId);
        }
      };
    }

    if (matches.length > 0) {
      setMatchesIfChanged((prevMatches) => translateMatches(prevMatches, language));
    }

    let requestSeq = 0;
    const loadMatches = async (
      currentLang: string,
      isInitial: boolean = false,
      canSetState?: () => boolean
    ) => {
      if (isInitial && (!canSetState || canSetState())) {
        setIsLoading(true);
      }

      try {
        const data = (await fetchLiveMatches(currentLang)) as T[];
        if ((!canSetState || canSetState()) && data.length > 0) {
          setMatchesIfChanged((prev) => mergeIncomingMatches(prev, data));
        }
      } catch (error) {
        const errorText = String(error);
        const isAbort =
          (error as { name?: string })?.name === "AbortError" ||
          errorText.includes("AbortError") ||
          errorText.includes("ERR_ABORTED") ||
          errorText.toLowerCase().includes("aborted");

        if (!isAbort) {
          console.error("Failed to load matches", error);
        }
      } finally {
        if (isInitial && (!canSetState || canSetState())) {
          setIsLoading(false);
        }
      }
    };

    const startFetch = async () => {
      const seq = ++requestSeq;
      const isInitialFetch = shouldStartMatchesLoading(matches.length);
      return loadMatches(language, isInitialFetch, () => isMounted && seq === requestSeq);
    };

    initialFetchTimeoutId = setTimeout(() => {
      void startFetch();
    }, 0);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let inFlightSince = 0;
    let consecutiveFailures = 0;
    const pollMs = 15000;
    const maxInflightMs = 30000;
    const canPoll = () =>
      typeof document === "undefined" ? true : document.visibilityState === "visible";

    const onVisibilityChange = () => {
      if (canPoll()) {
        void startFetch();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    const poll = async () => {
      if (!isMounted) {
        return;
      }
      if (!canPoll()) {
        timeoutId = setTimeout(poll, pollMs);
        return;
      }
      if (inFlight) {
        if (Date.now() - inFlightSince > maxInflightMs) {
          inFlight = false;
          inFlightSince = 0;
        } else {
          timeoutId = setTimeout(poll, pollMs);
          return;
        }
      }

      inFlight = true;
      inFlightSince = Date.now();

      try {
        const seq = ++requestSeq;
        const data = (await fetchLiveMatches(language)) as T[];
        if (isMounted && seq === requestSeq && data.length > 0) {
          consecutiveFailures = 0;
          setMatchesIfChanged((prev) => mergeIncomingMatches(prev, data));
        } else if (isMounted && seq === requestSeq) {
          consecutiveFailures++;
        }
      } catch (error) {
        const errorText = String(error);
        const isAbort =
          (error as { name?: string })?.name === "AbortError" ||
          errorText.includes("AbortError") ||
          errorText.includes("ERR_ABORTED") ||
          errorText.toLowerCase().includes("aborted");

        if (!isAbort) {
          console.error("Background fetch failed", error);
        }

        consecutiveFailures++;
      } finally {
        inFlight = false;
        inFlightSince = 0;
        if (isMounted) {
          const backoff = Math.min(consecutiveFailures, 4) * pollMs;
          timeoutId = setTimeout(poll, pollMs + backoff);
        }
      }
    };

    timeoutId = setTimeout(poll, pollMs);

    return () => {
      isMounted = false;
      if (initialFetchTimeoutId) {
        clearTimeout(initialFetchTimeoutId);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [language, matches.length, setMatchesIfChanged, shouldPauseMatchesFetching]);

  return {
    matches,
    setMatchesIfChanged,
    showMatchesLoading: shouldShowMatchesLoading(isLoading, matches.length),
  };
}
