# Referral History Refund Reversal Label Design

## Summary

This spec improves the referral commission history list so refund-reversal records are clearly distinguishable from normal positive commission events.

Confirmed scope:

- only change the frontend history presentation
- do not change backend referral reconciliation rules
- do not change ledger math
- make refund-reversal items explicitly readable as reversals, not missing or stolen commission

## Problem

The referral ledger now supports negative `refund_reversal` events.

Without explicit UI treatment, a history item like `-0.000480 USDT` can be confusing:

- users may think commission disappeared unexpectedly
- users may not understand that the negative amount is tied to a refunded bet
- normal commission and reversal events look too similar in the list

The list should explain the event type directly.

## Confirmed Product Decision

- Normal events remain labeled as commission income.
- Refund reversal events are labeled as `退款沖銷`.
- Positive items continue showing a leading `+`.
- Reversal items continue showing a leading `-`.
- This change applies only to the referral history list UI.

## Approaches Considered

### Recommended: label event type in the list row

Render a clear event label based on the ledger `kind`:

- `bet_commission` -> normal commission label
- `refund_reversal` -> `退款沖銷`

Why this is recommended:

- smallest change
- highest clarity-per-line of UI
- preserves existing layout and user scanning behavior

### Alternative: rely only on negative amount formatting

Rejected because:

- a negative number alone is ambiguous
- users may infer a bug or unexplained deduction

### Alternative: add badge plus color overhaul

Rejected for now because:

- higher UI churn than needed
- the issue can be solved with clearer text and existing amount styling

## Scope

In scope:

- referral history row label for reversal events
- preserve signed amount display
- add any minimal translation keys needed for the new label

Out of scope:

- backend event generation
- history filtering changes
- withdrawal card changes
- revenue report changes

## Existing UI Behavior

Today the referral page history list renders commission records without clearly distinguishing refund-reversal events from normal commission entries.

That means both of these can appear too similar:

- positive earned commission
- negative refund reversal

The amount sign alone is not sufficient explanation.

## Design

### 1. Event label rule

Each history row should derive a label from `commission.kind`.

Recommended mapping:

- `refund_reversal` -> `退款沖銷`
- anything else -> current normal commission wording

This keeps compatibility with older records that may not explicitly set `kind`.

### 2. Amount formatting

Preserve signed amount formatting:

- positive commission -> `+0.000480 USDT`
- refund reversal -> `-0.000480 USDT`

No normalization to absolute value should occur.

The sign is part of the explanation and should remain visible.

### 3. Visual hierarchy

Keep the existing list layout.

Only make the row more readable by:

- using the event label for the primary descriptor
- leaving the signed amount visually prominent

If the current row already includes the referee address and timestamp, keep them unchanged.

### 4. Backward compatibility

If `kind` is missing:

- treat the entry as a normal commission event

This avoids breaking existing historical data that predates explicit event typing.

### 5. i18n

Add a dedicated translation key for the reversal label.

Recommended key:

- `referral.history.refund_reversal`

If the normal commission label in the row is currently hardcoded or implicit, keep it unchanged unless a dedicated key already exists nearby.

## Data Flow

1. Referral page fetches referral history from `/api/referral`.
2. Frontend receives ledger entries including `kind`.
3. History row derives:
   - display label
   - signed amount
4. Reversal entries display `退款沖銷` and a negative amount.

## Error Handling

- If `kind` is unknown or missing, fall back to normal commission rendering.
- Do not hide negative amounts.
- Do not special-case based only on numeric sign; prefer `kind` as the primary indicator.

## Testing

Add focused UI coverage for:

- normal commission entry shows the normal label and a `+` amount
- refund reversal entry shows `退款沖銷` and a `-` amount
- missing `kind` falls back to normal commission display

Manual verification:

1. Open a referral page with at least one positive commission item.
2. Open a referral page with at least one `refund_reversal` item.
3. Confirm:
   - reversal row reads `退款沖銷`
   - amount is negative
   - normal rows remain unchanged

## Expected Outcome

After this change:

- users can immediately distinguish refunded commission reversals from earned commissions
- negative history rows are self-explanatory
- the existing backend reconciliation model remains unchanged
