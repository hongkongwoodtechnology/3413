# Referral Withdraw I18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the referral withdrawal card so `rate_label`, `rate_desc`, and `total_label` never render as raw i18n keys and correctly follow the active language.

**Architecture:** Keep the page rendering unchanged. Add the missing referral translation keys in `src/lib/i18n.ts`, and change the translation merge so referral keys fall back per key from English before locale-specific overrides apply.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, Testing Library

---

### Task 1: Fix referral translation data and fallback behavior

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\i18n.ts`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\components\__tests__\LanguageProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
test('should resolve referral withdraw labels for zh-CN instead of showing raw keys', () => {
  render(
    <LanguageProvider initialLocale="zh-CN">
      <div>
        <TranslationProbe translationKey="referral.withdraw.rate_label" />
        <TranslationProbe translationKey="referral.withdraw.rate_desc" />
        <TranslationProbe translationKey="referral.withdraw.total_label" />
      </div>
    </LanguageProvider>
  );

  expect(screen.getByTestId('translation-referral.withdraw.rate_label')).toHaveTextContent('佣金比例');
  expect(screen.getByTestId('translation-referral.withdraw.rate_desc')).toHaveTextContent('这是此介绍人当前可获得的佣金百分比。');
  expect(screen.getByTestId('translation-referral.withdraw.total_label')).toHaveTextContent('累计佣金');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/LanguageProvider.test.tsx --runInBand`
Expected: FAIL because the translation provider returns raw keys for the missing referral withdrawal labels.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/lib/i18n.ts
'referral.withdraw.rate_label': 'Commission Rate',
'referral.withdraw.rate_desc': 'This is the current commission percentage this referrer can earn.',
'referral.withdraw.total_label': 'Total Commission',
```

```ts
// src/lib/i18n.ts
TRANSLATIONS[lang] = {
  ...BASE_TRANSLATIONS[lang],
  ...REFERRAL_KEYS['en'],
  ...(REFERRAL_KEYS[lang as keyof typeof REFERRAL_KEYS] || {}),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/LanguageProvider.test.tsx --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts src/components/__tests__/LanguageProvider.test.tsx
git commit -m "fix: localize referral withdraw labels"
```
