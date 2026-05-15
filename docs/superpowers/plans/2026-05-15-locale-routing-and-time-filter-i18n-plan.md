# Locale Routing And Time Filter I18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `filter.time.*` buttons so they render translated labels and make language switching navigate to the correct `/${locale}` route while keeping SSR, SEO, and client rendering aligned.

**Architecture:** Keep the existing route-based locale architecture and make it authoritative. Add the missing time-filter translation keys in `src/lib/i18n.ts`, keep `LanguageProvider` route-first when `initialLocale` exists, and update `LanguageSwitcher` to replace or prepend the locale segment in the current pathname while preserving search params.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Jest, Testing Library

---

## File Structure

### Files to modify

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`
  - Add the five `filter.time.*` translation keys to the dictionary.
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageProvider.tsx`
  - Keep `initialLocale` authoritative and avoid client-side overrides when route locale exists.
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageSwitcher.tsx`
  - Convert the switcher from local state only into route navigation based on the chosen locale.
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageProvider.test.tsx`
  - Add route-priority tests and time-filter key assertions.

### Files to create

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageSwitcher.test.tsx`
  - Focused route-navigation tests for nested routes and root routes.

### Files to reference only

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\layout.tsx`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\[locale]\page.tsx`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\middleware.ts`

These files establish the route-first locale model and should not be changed unless implementation reveals a concrete blocker.

## Task 1: Lock In Missing Time Filter Keys With Tests

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageProvider.test.tsx`
- Reference: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`

- [ ] **Step 1: Add a failing translation-keys test**

Append this test block near the end of `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageProvider.test.tsx`:

```tsx
test('should resolve time filter labels instead of returning raw i18n keys', () => {
  render(
    <LanguageProvider initialLocale="en">
      <TestComponent />
    </LanguageProvider>
  );

  const { t } = (() => {
    let captured: ReturnType<typeof useLanguage> | null = null;

    function Capture() {
      captured = useLanguage();
      return null;
    }

    render(
      <LanguageProvider initialLocale="en">
        <Capture />
      </LanguageProvider>
    );

    if (!captured) {
      throw new Error('language context not captured');
    }

    return captured;
  })();

  expect(t('filter.time.live')).not.toBe('filter.time.live');
  expect(t('filter.time.1day')).not.toBe('filter.time.1day');
  expect(t('filter.time.3days')).not.toBe('filter.time.3days');
  expect(t('filter.time.7days')).not.toBe('filter.time.7days');
  expect(t('filter.time.all')).not.toBe('filter.time.all');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- src/components/__tests__/LanguageProvider.test.tsx --runInBand
```

Expected:

```text
FAIL ... should resolve time filter labels instead of returning raw i18n keys
Expected: not "filter.time.live"
Received: "filter.time.live"
```

- [ ] **Step 3: Add the missing translation keys in `i18n.ts`**

Insert these keys into the existing base dictionaries for `en`, `zh-TW`, and `zh-CN` in `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`:

```ts
// en
'filter.time.live': 'Live',
'filter.time.1day': '24 Hours',
'filter.time.3days': '3 Days',
'filter.time.7days': '7 Days',
'filter.time.all': 'All',

// zh-TW
'filter.time.live': '即時',
'filter.time.1day': '1 天內',
'filter.time.3days': '3 天內',
'filter.time.7days': '7 天內',
'filter.time.all': '全部',

// zh-CN
'filter.time.live': '即时',
'filter.time.1day': '1 天内',
'filter.time.3days': '3 天内',
'filter.time.7days': '7 天内',
'filter.time.all': '全部',
```

- [ ] **Step 4: Re-run the focused test**

Run:

```bash
npm test -- src/components/__tests__/LanguageProvider.test.tsx --runInBand
```

Expected:

```text
PASS ... should resolve time filter labels instead of returning raw i18n keys
```

- [ ] **Step 5: Commit the translation-key fix**

```bash
git add src/lib/i18n.ts src/components/__tests__/LanguageProvider.test.tsx
git commit -m "fix: add time filter translation keys"
```

## Task 2: Lock In Route-First Provider Behavior

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageProvider.test.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageProvider.tsx`

- [ ] **Step 1: Add a failing test that proves route locale wins over saved locale**

Add this test to `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageProvider.test.tsx`:

```tsx
test('should keep initialLocale authoritative even when localStorage contains another locale', () => {
  localStorage.setItem('app-language', 'ja');
  mockNavigatorLanguage('en');

  render(
    <LanguageProvider initialLocale="zh-CN">
      <TestComponent />
    </LanguageProvider>
  );

  expect(screen.getByTestId('lang-display')).toHaveTextContent('zh-CN');
  expect(screen.getByTestId('text-display')).toHaveTextContent('常见问题');
});
```

- [ ] **Step 2: Run the focused provider test**

Run:

```bash
npm test -- src/components/__tests__/LanguageProvider.test.tsx --runInBand
```

Expected:

```text
FAIL ... should keep initialLocale authoritative even when localStorage contains another locale
```

- [ ] **Step 3: Keep `initialLocale` authoritative in the provider**

Update `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageProvider.tsx` so the effect exits immediately when `initialLocale` exists and only reads `localStorage` and `navigator.language` for non-route pages:

```tsx
useEffect(() => {
  if (initialLocale) {
    setLanguageState(initialLocale);
    return;
  }

  const savedLang = localStorage.getItem('app-language') as Language | null;
  if (savedLang && LANGUAGES.some((l) => l.code === savedLang)) {
    setLanguageState(savedLang);
    return;
  }

  const browserLang = navigator.language;
  setLanguageState(detectLanguage(browserLang));
}, [initialLocale]);

const setLanguage = (lang: Language) => {
  setLanguageState(lang);
  localStorage.setItem('app-language', lang);
};
```

Also remove the old `?lang=` branch inside the provider. Route switching will own locale changes now.

- [ ] **Step 4: Re-run the provider test suite**

Run:

```bash
npm test -- src/components/__tests__/LanguageProvider.test.tsx --runInBand
```

Expected:

```text
PASS src/components/__tests__/LanguageProvider.test.tsx
```

- [ ] **Step 5: Commit the provider-priority fix**

```bash
git add src/components/LanguageProvider.tsx src/components/__tests__/LanguageProvider.test.tsx
git commit -m "fix: prioritize route locale in language provider"
```

## Task 3: Add Failing Route Navigation Tests For The Language Switcher

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageSwitcher.test.tsx`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageSwitcher.tsx`

- [ ] **Step 1: Create a focused switcher test file**

Create `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageSwitcher.test.tsx` with this content:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../LanguageProvider';
import { LanguageSwitcher } from '../LanguageSwitcher';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/zh-CN/faq',
  useSearchParams: () => new URLSearchParams('page=2'),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
  });

  test('should navigate to the same sub-path under the selected locale', () => {
    render(
      <LanguageProvider initialLocale="zh-CN">
        <LanguageSwitcher />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('日本語'));

    expect(localStorage.getItem('app-language')).toBe('ja');
    expect(push).toHaveBeenCalledWith('/ja/faq?page=2');
  });
});
```

- [ ] **Step 2: Add a root-path test to the same file**

Add this second test and override the pathname mock inside the test:

```tsx
test('should navigate from root to the selected locale root', async () => {
  jest.resetModules();
  const rootPush = jest.fn();

  jest.doMock('next/navigation', () => ({
    useRouter: () => ({ push: rootPush }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  }));

  const { LanguageSwitcher: RootLanguageSwitcher } = await import('../LanguageSwitcher');
  const { LanguageProvider: RootLanguageProvider } = await import('../LanguageProvider');

  render(
    <RootLanguageProvider initialLocale="en">
      <RootLanguageSwitcher />
    </RootLanguageProvider>
  );

  fireEvent.click(screen.getByRole('button'));
  fireEvent.click(screen.getByText('Deutsch'));

  expect(rootPush).toHaveBeenCalledWith('/de');
});
```

- [ ] **Step 3: Run the new switcher test file to verify it fails**

Run:

```bash
npm test -- src/components/__tests__/LanguageSwitcher.test.tsx --runInBand
```

Expected:

```text
FAIL ... Expected push to have been called with "/ja/faq?page=2"
Received: no calls
```

- [ ] **Step 4: Commit the failing tests**

```bash
git add src/components/__tests__/LanguageSwitcher.test.tsx
git commit -m "test: cover locale route switching behavior"
```

## Task 4: Make The Language Switcher Navigate By Locale Route

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageSwitcher.tsx`

- [ ] **Step 1: Add the App Router hooks**

Replace the imports at the top of `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageSwitcher.tsx` with:

```tsx
"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { LANGUAGES, Language } from "@/lib/i18n";
import { ChevronDown, Check } from "lucide-react";
```

- [ ] **Step 2: Add a locale-aware destination builder**

Inside `LanguageSwitcher`, add this helper before `return`:

```tsx
const router = useRouter();
const pathname = usePathname() || "/";
const searchParams = useSearchParams();

const localeSet = useMemo(() => new Set(LANGUAGES.map((lang) => lang.code)), []);

function buildLocalePath(nextLocale: Language) {
  const segments = pathname.split("/").filter(Boolean);
  const hasLocalePrefix = segments.length > 0 && localeSet.has(segments[0] as Language);

  const nextSegments = hasLocalePrefix
    ? [nextLocale, ...segments.slice(1)]
    : [nextLocale, ...segments];

  const nextPath = `/${nextSegments.join("/")}`;
  const query = searchParams?.toString();

  return query ? `${nextPath}?${query}` : nextPath;
}
```

- [ ] **Step 3: Replace the old `setLanguage()` click behavior**

Update the language option `onClick` to:

```tsx
onClick={() => {
  localStorage.setItem('app-language', lang.code);
  setLanguage(lang.code);
  router.push(buildLocalePath(lang.code));
  setIsOpen(false);
}}
```

This keeps the context responsive but makes the URL change the real source of truth.

- [ ] **Step 4: Run the switcher tests**

Run:

```bash
npm test -- src/components/__tests__/LanguageSwitcher.test.tsx --runInBand
```

Expected:

```text
PASS src/components/__tests__/LanguageSwitcher.test.tsx
```

- [ ] **Step 5: Commit the routing implementation**

```bash
git add src/components/LanguageSwitcher.tsx src/components/__tests__/LanguageSwitcher.test.tsx
git commit -m "fix: navigate by locale when switching language"
```

## Task 5: Run Integration Checks And Fix Any Diagnostics

**Files:**
- Modify if needed: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageSwitcher.tsx`
- Modify if needed: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageProvider.tsx`
- Modify if needed: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`

- [ ] **Step 1: Run the focused localization tests together**

Run:

```bash
npm test -- src/components/__tests__/LanguageProvider.test.tsx src/components/__tests__/LanguageSwitcher.test.tsx --runInBand
```

Expected:

```text
PASS src/components/__tests__/LanguageProvider.test.tsx
PASS src/components/__tests__/LanguageSwitcher.test.tsx
```

- [ ] **Step 2: Run the i18n validation suite**

Run:

```bash
npm test -- __tests__/i18n-validation.test.ts --runInBand
```

Expected:

```text
PASS __tests__/i18n-validation.test.ts
```

- [ ] **Step 3: Check IDE diagnostics on edited files**

Inspect diagnostics for:

- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageProvider.tsx`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\LanguageSwitcher.tsx`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageProvider.test.tsx`
- `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageSwitcher.test.tsx`

Expected:

```text
No new TypeScript or lint errors introduced by the change set
```

- [ ] **Step 4: Manually verify the browser behavior**

Open the app and verify:

```text
1. /zh-CN shows translated time filter buttons
2. switching to 日本語 changes the URL to /ja
3. /zh-CN/faq switches to /en/faq or /ja/faq while staying on the same page type
4. refresh keeps the locale route language instead of drifting
```

- [ ] **Step 5: Commit the final verified change set**

```bash
git add src/lib/i18n.ts src/components/LanguageProvider.tsx src/components/LanguageSwitcher.tsx src/components/__tests__/LanguageProvider.test.tsx src/components/__tests__/LanguageSwitcher.test.tsx
git commit -m "fix: align locale routing with translated time filters"
```

## Self-Review

Spec coverage check:

- Missing time filter translations: covered by Task 1.
- Route-first provider behavior: covered by Task 2.
- Switcher navigation preserving sub-paths: covered by Task 3 and Task 4.
- Validation and diagnostics: covered by Task 5.

Placeholder scan:

- No `TODO`, `TBD`, or “handle appropriately” placeholders remain.
- Every task includes exact file paths, commands, and code snippets.

Type consistency:

- `Language` type is used consistently for locale values.
- `buildLocalePath(nextLocale: Language)` matches the route-switching logic used later in Task 4.
- Tests refer only to files and symbols introduced or already present in the codebase.
