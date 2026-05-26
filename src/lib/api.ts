
import { Match } from "@/lib/types";

type FetchLiveMatchesOptions = { signal?: AbortSignal };

const inFlightByLang = new Map<string, Promise<Match[]>>();

export async function fetchLiveMatches(
  lang: string = 'en',
  options?: FetchLiveMatchesOptions
): Promise<Match[]> {
  const normalizedLang = lang || 'en';
  const existing = inFlightByLang.get(normalizedLang);
  if (existing) return existing;

  const run = (async () => {
  try {
    // In client component, relative URL works
    const cacheBuster = Date.now();
    const res = await fetch(`/api/matches?lang=${encodeURIComponent(lang)}&_=${cacheBuster}`, {
      cache: 'no-store',
      signal: options?.signal,
      headers: {
        'Accept-Language': lang,
        'X-App-Language': lang,
      },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch matches');
    }
    return res.json();
  } catch (error) {
    // Suppress network errors from polluting the console if they are just connection resets 
    // due to React Strict Mode double-invocations or browser aborting during navigation.
    const err: any = error;
    const errStr = String(error);
    const isAbort =
      err?.name === 'AbortError' ||
      errStr.includes('AbortError') ||
      errStr.includes('ERR_ABORTED') ||
      errStr.toLowerCase().includes('aborted');

    if (
      !isAbort &&
      !errStr.includes("Failed to fetch") &&
      !errStr.includes("ERR_CONNECTION_RESET") &&
      !errStr.includes("ERR_CONNECTION_REFUSED")
    ) {
        console.error("Error fetching matches:", error);
    }
    return [];
  }
  })();

  inFlightByLang.set(normalizedLang, run);
  try {
    return await run;
  } finally {
    inFlightByLang.delete(normalizedLang);
  }
}
