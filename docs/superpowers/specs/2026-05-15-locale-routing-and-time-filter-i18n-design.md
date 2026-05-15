# Locale Routing And Time Filter I18n Design

## Summary

This spec fixes two user-visible localization issues on the main betting pages:

- the time filter buttons render raw translation keys such as `filter.time.live`
- switching language does not consistently change the rendered page language

The chosen approach is:

- add the missing `filter.time.*` translation keys
- treat the URL locale as the source of truth for rendered language
- make the language switcher navigate to `/${locale}` while preserving the current sub-path
- keep `localStorage` only as a memory aid, not the authority on `[locale]` pages

This is a focused consistency fix for routing and translations, not a redesign of the whole i18n system.

## Problem

The current implementation mixes two language sources:

- route locale via `src/app/[locale]/*`
- client state via `LanguageProvider`

At the same time, the time filter UI requests these keys:

- `filter.time.live`
- `filter.time.1day`
- `filter.time.3days`
- `filter.time.7days`
- `filter.time.all`

Those keys are not currently defined in the translation dictionary, so `t()` falls back to the raw key string.

For language switching, `LanguageSwitcher` currently updates the in-memory language state and `localStorage`, but it does not navigate to the matching locale route. Because the app is already structured around `[locale]` pages and locale-aware metadata, the visible result is inconsistent:

1. the URL can stay on the old locale
2. SSR output can be generated for one locale
3. the client state can switch to another locale
4. hydration warnings and partial language mismatches can appear

## Confirmed Product Decision

- Route locale is the source of truth.
- Switching language should navigate to `/${locale}`.
- The current page path should be preserved when possible.
- The five time filter labels should render translated text instead of raw keys.
- This change should improve SEO and SSR consistency rather than rely on client-only state.

## Approaches Considered

### Recommended: URL-driven locale with provider aligned to route

Use the locale segment in the pathname as the single authoritative language for rendered UI. The switcher updates the URL, and the provider derives its initial rendered language from `initialLocale`.

Why this is recommended:

- matches the current `[locale]` app structure
- aligns SSR, metadata, and client rendering
- removes the main cause of hydration mismatch
- preserves deep links such as `/zh-CN/faq` -> `/ja/faq`

### Alternative: client-only language switching

Rejected because:

- it fights the existing route-based locale structure
- SSR and SEO metadata remain tied to the old URL
- refreshes can restore a different locale than the rendered client state

### Alternative: dual-write route and context

Rejected for now because:

- it creates two active sources of truth
- it is easier to reintroduce hydration mismatches
- the route already provides the stronger architectural boundary

## Affected Areas

Primary frontend files:

- `src/lib/i18n.ts`
- `src/components/LanguageProvider.tsx`
- `src/components/LanguageSwitcher.tsx`
- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`

Supporting areas:

- `src/components/LocalizedLink.tsx`
- `src/app/layout.tsx`
- `src/app/[locale]/layout.tsx`
- `src/middleware.ts`

Recommended focused tests:

- `LanguageProvider` route-priority behavior
- `LanguageSwitcher` locale navigation behavior
- translation key existence for `filter.time.*`

## Design

### 1. Time filter translation keys

Add these keys to the translation dictionary:

- `filter.time.live`
- `filter.time.1day`
- `filter.time.3days`
- `filter.time.7days`
- `filter.time.all`

The current usage in both betting pages should stay unchanged:

- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`

This is the smallest and clearest fix because the UI already calls `t()` correctly. The data is missing, not the component logic.

For the first implementation:

- add proper values for `en`
- add proper values for `zh-TW`
- add proper values for `zh-CN`
- allow other locales to fall back to English if localized copy is not ready yet

If complete coverage already exists or can be added cheaply, extending all supported locales in the same change is acceptable.

### 2. Route-first language source

`LanguageProvider` should use this priority order:

1. `initialLocale` from the route
2. saved locale from `localStorage` when no route locale exists
3. browser-detected locale when neither of the above exists
4. `en` fallback

When `initialLocale` is present:

- it should initialize the provider state
- it should remain authoritative for that page render
- client effects should not override it with `localStorage` or browser language

This preserves consistency between:

- `html lang`
- route segment
- provider state
- rendered translations

### 3. Language switcher navigation

`LanguageSwitcher` should stop acting like a purely local state toggle.

Instead, on selection it should:

1. persist the chosen locale in `localStorage`
2. compute the destination route by replacing or inserting the locale segment
3. navigate to the new path
4. close the switcher menu

Expected examples:

- `/zh-CN` -> `/ja`
- `/zh-CN/faq` -> `/ja/faq`
- `/en/referral` -> `/fr/referral`
- `/` -> `/de`

The implementation should preserve query strings and hashes if they are present.

### 4. Root and non-locale routes

The project currently contains both:

- locale-prefixed routes under `src/app/[locale]`
- non-prefixed routes under `src/app`

The middleware already redirects missing-locale paths to a locale-prefixed path. Because of that, the route-first design should not attempt to keep non-prefixed paths as a steady-state mode.

For this fix:

- treat locale-prefixed paths as the normal final destination
- keep middleware behavior unchanged unless a blocker is discovered during implementation
- let root `/` switches resolve to `/${locale}`

### 5. Localized links and page transitions

`LocalizedLink` already prefixes links with the current provider language. That behavior is compatible with this design as long as the provider language stays aligned to the route locale.

This means the route-first provider fix is sufficient for link generation. No separate link abstraction redesign is needed in this scope.

## Data Flow

### Before

1. User opens a locale route such as `/zh-CN`.
2. SSR renders content for the route locale.
3. The client provider may later switch based on `localStorage` or browser language.
4. The visible page language can drift from the URL.
5. Time filter buttons request keys that do not exist and display raw key names.

### After

1. User opens a locale route such as `/zh-CN`.
2. SSR renders content for the route locale.
3. `LanguageProvider` initializes from `initialLocale` and keeps it authoritative.
4. The page renders translated time filter labels.
5. User switches language.
6. `LanguageSwitcher` navigates to the equivalent `/${locale}` route.
7. SSR and client both render the new locale consistently.

## Error Handling

- If a locale code is not recognized, fall back to `en`.
- If path parsing cannot confidently identify an existing locale segment, prefix the current pathname with `/${locale}`.
- If `localStorage` is unavailable, route navigation should still work.
- If a translation key is missing in a non-core locale, fall back to English.

## Edge Cases

### Switching from a nested locale route

Expected result:

- preserve the nested path
- only replace the locale segment

Example:

- `/pt/whitepaper` -> `/en/whitepaper`

### Switching from a legacy non-locale URL

Expected result:

- navigate to the locale-prefixed version
- keep the pathname content if possible

Example:

- `/faq` -> `/ja/faq`

### Query string and hash present

Expected result:

- preserve both during locale switching

Example:

- `/zh-TW/referral?page=2#history` -> `/en/referral?page=2#history`

### Saved locale differs from current route

Expected result:

- current route wins
- saved locale may be updated after explicit user switching

## Testing

Recommended focused automated coverage:

- verify `t('filter.time.live')` and related keys resolve to real strings
- verify provider keeps `initialLocale` authoritative when present
- verify language switcher produces the expected route for root and nested paths
- verify query strings remain attached after switching

Manual verification:

1. open `/zh-CN`
2. confirm the five time filter buttons render translated labels
3. switch to `/ja`
4. confirm the URL changes to `/ja`
5. confirm the page text changes consistently
6. refresh the page
7. confirm the same locale remains active
8. repeat on a nested page such as `/zh-CN/faq`

## Scope

In scope:

- add the missing `filter.time.*` translation keys
- align `LanguageProvider` with route-first locale behavior
- make `LanguageSwitcher` navigate by locale route
- add focused tests for translation keys and route-based switching

Out of scope:

- rewriting the entire translation dataset
- redesigning middleware locale negotiation
- replacing all non-locale route files
- adding a new i18n library
