const fs = require('fs');
const path = require('path');

const TRANSLATIONS_CACHE_PATH = path.join(process.cwd(), 'data', 'team_translations.json');

let translationsCache: Record<string, string> | null = null;

function loadTranslationsCache(): Record<string, string> {
  if (translationsCache) return translationsCache;
  try {
    if (fs.existsSync(TRANSLATIONS_CACHE_PATH)) {
      translationsCache = JSON.parse(fs.readFileSync(TRANSLATIONS_CACHE_PATH, 'utf-8'));
    } else {
      translationsCache = {};
    }
  } catch {
    translationsCache = {};
  }
  return translationsCache || {};
}

function saveTranslationsCache(cache: Record<string, string>) {
  try {
    fs.writeFileSync(TRANSLATIONS_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Translate] Failed to save translations cache:', e);
  }
}

function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

interface TranslateResult {
  translated: string;
  fromCache: boolean;
}

const pendingTranslations = new Map<string, Promise<string>>();

export async function translateToZhTW(text: string): Promise<TranslateResult> {
  if (!text) return { translated: text, fromCache: true };

  const cache = loadTranslationsCache();
  const cacheKey = text.trim();

  if (cache[cacheKey]) {
    return { translated: cache[cacheKey], fromCache: true };
  }

  if (containsChinese(cacheKey)) {
    cache[cacheKey] = cacheKey;
    saveTranslationsCache(cache);
    return { translated: cacheKey, fromCache: true };
  }

  if (pendingTranslations.has(cacheKey)) {
    const result = await pendingTranslations.get(cacheKey)!;
    return { translated: result, fromCache: true };
  }

  const promise = (async () => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(cacheKey)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (!res.ok) {
        return cacheKey;
      }

      const data = await res.json();
      let translated = '';

      if (Array.isArray(data) && data[0]) {
        translated = data[0]
          .map((item: any) => item[0] || '')
          .join('');
      }

      translated = translated.trim();

      if (!translated || translated === cacheKey) {
        return cacheKey;
      }

      cache[cacheKey] = translated;
      saveTranslationsCache(cache);

      return translated;
    } catch (e) {
      console.error(`[Translate] Failed to translate "${cacheKey}":`, e);
      return cacheKey;
    } finally {
      pendingTranslations.delete(cacheKey);
    }
  })();

  pendingTranslations.set(cacheKey, promise);
  const result = await promise;
  return { translated: result, fromCache: false };
}
