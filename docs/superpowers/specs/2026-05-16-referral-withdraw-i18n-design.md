# Referral Withdraw I18n Design

## Goal

Fix the referral page so these withdrawal-card labels follow the current user language instead of rendering raw i18n keys:

- `referral.withdraw.rate_label`
- `referral.withdraw.rate_desc`
- `referral.withdraw.total_label`

## Current State

- The referral page already calls `t(...)` for these labels in `src/app/[locale]/referral/page.tsx`.
- The translation source in `src/lib/i18n.ts` does not currently define these keys.
- When a key is missing, the UI falls back to showing the key string itself.

## Scope

Keep the fix intentionally narrow.

- Do not change referral page layout or business logic.
- Do not rename existing keys.
- Do not change API responses.
- Do not alter withdrawal calculations or reserve-warning behavior.

## Recommended Approach

Add the missing translation entries to `src/lib/i18n.ts` for the three keys above.

### Why this approach

- It matches the page's existing i18n pattern.
- It keeps risk low because rendering logic is already correct.
- It fixes the bug for all supported languages in one place.

## Translation Strategy

- Add explicit translations for `en`, `zh-CN`, and `zh-TW`.
- Add entries for the remaining supported locales so the UI never falls back to raw keys.
- If a precise product-approved translation is not already available, use a safe English fallback for that locale in this pass rather than leaving the key missing.

## Files

- Modify: `src/lib/i18n.ts`
- Modify: `src/app/[locale]/referral/page.test.tsx`

## Testing

Update the referral page test to verify:

- the withdrawal card renders translated text for the three keys
- the page does not display raw i18n key names for those labels

## Risks

- Low risk: the change is limited to translation data plus a focused UI assertion.
- Main risk is incomplete coverage if a locale block is missed, so the implementation should add the keys consistently across all locale objects.
