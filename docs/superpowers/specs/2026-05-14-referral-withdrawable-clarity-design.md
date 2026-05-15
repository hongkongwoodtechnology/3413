# Referral Withdrawable Clarity Design

## Summary

This spec improves the referral withdrawal card so users can clearly distinguish between earned commission that has already been recorded and commission that is currently withdrawable on-chain.

The chosen approach is:

- keep the existing referral API and withdrawal rules unchanged
- update the referral page withdrawal card to show both `累计佣金` and `可提现佣金`
- show a clear explanatory message when total commission is positive but withdrawable commission is zero because the commission wallet has no available reserve

This is a display and comprehension fix, not a settlement or payout logic change.

## Problem

The current referral withdrawal card only emphasizes `可提现佣金`.

When the commission wallet reserve is zero:

- historical commission records may already be present
- the user may have non-zero `累计佣金`
- but the API correctly returns `可提现佣金 = 0`

Because the UI does not prominently show both values together, users can misread the page as "佣金丢了" rather than "佣金已入账，但当前储备不足，暂时不能提现".

## Confirmed Product Decision

- Use the existing withdrawal card as the display container.
- Keep the commission rate module at the top of the card.
- Add a dual-value area inside the same card:
  - top: `累计佣金`
  - bottom: `可提现佣金`
- When `累计佣金 > 0` and `可提现佣金 = 0`, show:
  - `佣金已入账，但佣金钱包余额不足，暂不可提`
- Keep the withdrawal amount input, MAX button, receiving address, and withdraw button behavior unchanged.

## Approaches Considered

### Recommended: dual values inside the existing withdrawal card

Keep all information in one place and separate "earned" from "currently withdrawable" in the same visual block.

Why this is recommended:

- smallest layout change that fully resolves the misunderstanding
- keeps the explanation close to the withdrawal action
- does not require new backend fields
- preserves the existing page structure and user flow

### Alternative: keep one value and only add a warning line

Rejected because:

- users still focus on the single zero value first
- the warning explains the issue, but the page still hides the positive total too much
- the distinction between bookkeeping and available reserve remains visually weak

### Alternative: add a page-level banner above the withdrawal card

Rejected for now because:

- it is more visually disruptive
- it spreads one concept across two areas of the page
- the misunderstanding happens specifically at the withdrawal action, so the fix should live there

## Affected Area

Primary frontend area:

- `src/app/[locale]/referral/page.tsx`

Localization area:

- `src/lib/i18n.ts`

Potential focused tests:

- referral page rendering tests around the withdrawal card display state

## Design

### 1. Withdrawal card information hierarchy

The withdrawal card keeps its current top section for `佣金比例`.

Below that section, the card adds a two-part information block:

1. `累计佣金`
2. `可提现佣金`

Both values come from the already returned `stats` object:

- `stats.total`
- `stats.withdrawable`

No new API response fields are required.

### 2. Conditional reserve warning

Show a warning message only when all of the following are true:

- `stats.total` is greater than zero
- `stats.withdrawable` is equal to zero

The warning copy is:

- `佣金已入账，但佣金钱包余额不足，暂不可提`

Do not show this message when total commission is also zero, because that would incorrectly imply the user has already earned commission.

### 3. Layout and styling behavior

The card should remain visually consistent with the existing neutral-dark design system.

Requirements:

- the two values should be clearly separated with labels and strong numeric emphasis
- `累计佣金` should read as informational status
- `可提现佣金` should remain the primary actionable number near the withdrawal form
- the reserve warning should appear below the withdrawable number and above the amount input
- the warning should be styled as cautionary information, not a hard error state

The withdrawal form itself stays unchanged:

- amount input
- MAX button
- receiving address
- withdraw button

### 4. Logic source

The page should derive the warning condition from existing values already loaded into `referralData`.

Recommended implementation shape:

- parse `stats.total`
- parse `stats.withdrawable`
- compute a boolean like `showReserveWarning`

This logic remains local to the referral page and does not modify the server route.

## Data Flow

1. The referral page fetches data from `/api/referral`.
2. The page receives `stats.total` and `stats.withdrawable`.
3. The withdrawal card renders both values.
4. If total is positive and withdrawable is zero, the reserve warning is rendered.
5. The existing withdrawal action still uses `stats.withdrawable` for MAX and amount validation.

## Error Handling

- If referral data is still loading, keep the existing loading behavior.
- If referral data fails to load, keep the existing error state.
- If total or withdrawable strings are malformed, fail soft by suppressing the reserve warning rather than crashing the page.

## Edge Cases

### No commission earned

- `累计佣金 = 0`
- `可提现佣金 = 0`
- no reserve warning is shown

### Commission earned but reserve empty

- `累计佣金 > 0`
- `可提现佣金 = 0`
- reserve warning is shown

### Partial liquidity

- `累计佣金 > 可提现佣金 > 0`
- both values are shown
- no reserve warning is shown in the first version

This keeps the first fix narrowly focused on the confusing zero-withdrawable state.

## Localization

Add new i18n keys for the withdrawal card:

- `referral.withdraw.total_label`
- `referral.withdraw.reserve_insufficient`

Required Chinese copy:

- `累计佣金`
- `佣金已入账，但佣金钱包余额不足，暂不可提`

At minimum, update the Chinese locales used by the current page:

- `zh-CN`
- `zh-TW`

If the project convention requires all locales to define the same keys, add safe translations or fallbacks for other locales as part of implementation.

## Testing

Recommended focused coverage:

- verify the withdrawal card renders both `累计佣金` and `可提现佣金`
- verify the reserve warning appears when total is positive and withdrawable is zero
- verify the reserve warning does not appear when both values are zero
- verify the reserve warning does not appear when withdrawable is positive

Manual verification:

- open the referral page for an address with positive total commission and zero withdrawable commission
- confirm the card shows both values
- confirm the reserve warning appears
- confirm MAX still uses the withdrawable value
- confirm the withdraw button behavior is unchanged

## Scope

In scope:

- referral withdrawal card display changes
- conditional reserve warning
- related i18n additions
- focused UI tests if practical

Out of scope:

- referral API changes
- payout reserve calculation changes
- withdrawal transaction behavior
- commission wallet funding operations
