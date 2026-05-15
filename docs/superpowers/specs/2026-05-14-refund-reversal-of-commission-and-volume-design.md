# Refund Reversal Of Commission And Volume Design

## Summary

This spec defines how refunded bets must reverse previously recorded referral economics.

Confirmed business rule:

- any bet that ends in `refunded` is treated as not established
- refunded bets must not retain platform fee
- refunded bets must not retain referral commission
- refunded bets must not retain referral volume
- if commission and referral volume were already recorded before the refund, the system must automatically reverse them

The recommended design uses explicit negative reversal records rather than mutating the original positive commission record in place.

## Problem

The current system records referral commission at bet placement time in `src/app/api/referral/route.ts`.

That creates a mismatch with the current settlement flow:

- placement can record positive referral commission and referee volume immediately
- later, the bet may become `refunded` in `src/app/api/matches/route.ts` or `src/app/api/bets/route.ts`
- the settlement cron refunds principal in `src/app/api/cron/settle/route.ts`
- but referral accounting is not automatically reversed

As a result, refunded bets can incorrectly leave behind:

- positive referral commission
- positive referee volume
- inflated referral totals and withdrawable amount

This violates the product rule that refunded bets should behave as if they never became effective fee-generating bets.

## Confirmed Product Decision

- Apply the rule to all refunded bets, not only single-side refunds.
- Reverse both:
  - referral commission
  - referral volume (`totalVolumeValue`)
- Keep a full audit trail instead of overwriting original positive commission entries.
- Handle both:
  - future refunds
  - historical refunded bets that were already recorded without reversal

## Approaches Considered

### Recommended: append explicit negative reversal records

When a refunded bet has a matching positive commission entry, create a negative reversal entry in the same referral commission ledger.

Why this is recommended:

- preserves audit history
- allows deterministic one-time reversal
- avoids destroying the original placement record
- keeps financial narratives explainable in admin tools and future reports

### Alternative: mutate original positive commission entry to zero

Rejected because:

- it removes traceability
- it makes it hard to understand what happened historically
- repeated repair logic becomes error-prone

### Alternative: leave database untouched and exclude refunded bets only at query time

Rejected because:

- it leaves corrupted historical data in storage
- different reporting paths can drift from each other
- admin views and future tooling would need duplicated filtering logic

## Scope

In scope:

- reverse already-recorded commission for refunded bets
- reverse already-recorded referee volume for refunded bets
- support automatic repair for old refunded bets missing reversal
- update referral API totals to use net amounts after reversal

Out of scope:

- refunding on-chain platform funds already moved at bet placement
- redesigning payout wallet architecture
- changing the meaning of non-refund settlement outcomes

## Existing Flow

### Placement

At bet placement:

- frontend calculates `poolAmount`, `houseAmount`, `commissionAmount`, `supportAmount`
- `/api/referral` `place_bet` records:
  - positive commission ledger entry
  - positive referee `earnedCommissionValue`
  - positive referee `totalVolumeValue`

### Refund

Later refund classification happens in two places:

- `src/app/api/matches/route.ts`
- `src/app/api/bets/route.ts`

Those paths change bet status to `refunded`, but they do not currently reverse referral accounting.

### Refund payout

`src/app/api/cron/settle/route.ts` already refunds full principal for refunded real-money bets and explicitly treats them as no-fee refunds.

The missing part is referral accounting reversal.

## Design

### 1. Ledger model

Keep the existing `commissions[]` ledger, but extend its meaning to support two event kinds:

- positive bet commission event
- negative refund reversal event

Recommended additional field:

- `kind: 'bet_commission' | 'refund_reversal'`

Recommended reversal-link field:

- `refundOfCommissionId?: string`

The original positive entry remains unchanged.
The refund creates a new negative entry linked back to the original positive entry.

### 2. Reversal record shape

When a refunded bet must be reversed, create a new commission ledger entry with negative values:

- `betAmount = -originalBetAmount`
- `fee = -originalFee`
- `support = -originalSupport`
- `commission = -originalCommission`

Other recommended fields:

- `referee = original.referee`
- `timestamp = reversal creation time`
- `status = 'settled'`
- `signature = original.signature`
- `kind = 'refund_reversal'`
- `refundOfCommissionId = original.id`

Why `support` also reverses:

- it keeps fee decomposition internally balanced
- it supports future reporting consistency for fee/support/commission analytics

### 3. Referee aggregate reversal

When creating a refund reversal event, also update the corresponding referee aggregate:

- `ref.totalVolumeValue -= originalBetAmount`
- `ref.earnedCommissionValue -= originalCommission`

Bounds:

- clamp values at zero if historical drift would otherwise push them slightly negative

This reflects the product rule that refunded bets are treated as never-established betting volume.

### 4. One-time reversal rule

Each positive commission event may be reversed at most once.

The recommended detection rule:

- positive record is a candidate if `kind !== 'refund_reversal'`
- a reversal already exists if any commission entry has:
  - `kind === 'refund_reversal'`
  - `refundOfCommissionId === positiveRecord.id`

If such an entry exists, do not create another reversal.

This makes the repair flow idempotent.

### 5. Trigger point for future refunds

The preferred trigger is the referral API repair/reconciliation path rather than embedding reversal logic in every refund setter.

Reason:

- refund status is set in more than one place
- centralizing reversal logic avoids duplicated business rules
- the reconciliation path can cover both future and historical records

Recommended behavior:

- whenever `/api/referral` reads or mutates referral data, run a conservative refund-reversal reconciliation pass first

That reconciliation pass should:

1. load bets DB
2. find bets with `status === 'refunded'`
3. find matching positive referral commission entries
4. create reversal entries if missing
5. update referee aggregates once
6. persist DB if changes were made

### 6. Historical repair

Historical repair uses the same reconciliation pass.

Eligible repair case:

- bet exists in bets DB
- bet status is `refunded`
- referral DB contains a matching positive commission entry
- no linked refund reversal exists yet

This allows old refunded bets that already leaked commission to be corrected automatically the next time referral data is read.

### 7. Matching strategy

Recommended primary match fields:

- `signature`
- `referee`

Recommended fallback fields when necessary:

- `betAmount`
- nearby timestamp

If multiple positive entries could match the same refunded bet, prefer the exact-signature match and skip ambiguous cases rather than guessing.

### 8. Referral API totals

After reversal records exist, referral API totals should use net values naturally by summing positive and negative commission events together.

This affects:

- `stats.total`
- `stats.month`
- `stats.withdrawable`
- referee `earnedCommissionValue`
- referee `totalVolumeValue`

No special query-time exclusion is needed if reversal entries are stored correctly.

### 9. History display

The commission history list should continue to show both event types.

Recommended rendering:

- positive commission entries display normally
- reversal entries display as refund reversals with negative amount

Example:

- `退款沖銷 -0.000480 USDT`

This keeps the user-facing history and the stored ledger aligned.

## Error Handling

- If a refunded bet has no matching positive commission entry, skip it.
- If matching is ambiguous, skip reversal and log for admin review.
- If referee aggregate record is missing, do not invent unrelated users; only reverse when the referrer/referee relation is known from the original positive commission entry.
- If historical drift exists, clamp aggregate totals at zero after subtraction.

## Data Consistency Rules

- Positive commission entries remain immutable after creation.
- Refund reversal entries are append-only.
- Reversal generation must be idempotent.
- Aggregates must reflect the net of all applied ledger events.

## Testing

### Automated tests

Add focused tests for:

- refunded bet with existing positive commission creates exactly one negative reversal
- running reconciliation twice does not double-reverse
- historical refunded bet without reversal is auto-corrected on referral API read
- referee `earnedCommissionValue` is reduced correctly
- referee `totalVolumeValue` is reduced correctly
- net `stats.total` and `withdrawable` reflect the reversal

### Manual verification

1. Place a referred bet that creates positive commission.
2. Mark the bet as refunded.
3. Open referral API/page.
4. Confirm:
   - original positive entry still exists
   - negative refund reversal entry appears once
   - total commission drops
   - withdrawable drops
   - referee volume drops

## Expected Outcome

After this change:

- refunded bets no longer contribute fee, commission, or referral volume in net accounting
- already-recorded refunded commissions are automatically reversed
- the referral ledger remains auditable
- repeated settlement or repair runs remain safe and deterministic
