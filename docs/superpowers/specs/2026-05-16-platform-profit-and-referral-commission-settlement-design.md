# Platform Profit And Referral Commission Settlement Design

## Summary

This spec defines the platform revenue and referral commission rules for real-money bets under the confirmed product decisions below:

- all confirmed platform fee funds are collected into `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2`
- referral commission is no longer treated as earned at bet placement time
- a bet earns referral commission if and only if its final status is `win` or `loss`
- a bet earns no referral commission if its final status is `refunded`
- refunded bets return the full original stake, including the fee portion
- refunded bets leave the platform with zero final profit for that bet

The recommended design keeps the current placement-time split transfer model, but changes the meaning of the fee destination:

- `pool` still funds the payout pool
- `house + commission` are both temporarily collected by the platform wallet
- settlement later determines which part is true platform profit and which part becomes a referrer entitlement

## Problem

The current system mixes three different concepts:

- on-chain fee collection
- platform profit recognition
- referrer commission entitlement

Current behavior records referral commission too early in `src/app/api/referral/route.ts`, while refund and settlement decisions happen later in other routes.

That creates product and accounting mismatches:

1. a referred bet can appear to have earned commission before the match is finally settled
2. refunded bets require reversal logic to undo already-recorded commission
3. the separate `COMMISSION_WALLET` suggests a dedicated referral destination, but the business rule now says all temporary platform fee collection should first land in `3ve...`

The new product rule is simpler:

- only final non-refunded bets generate fee revenue
- only final non-refunded bets generate referral commission
- refunded bets behave as if no fee revenue was retained

## Confirmed Product Decisions

- Real-money bets still split at placement time.
- `pool` continues going to the payout pool wallet.
- `house` and `commission` both go to `3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2` at placement time.
- Referral commission is recognized only after final settlement.
- `win` and `loss` both qualify for referral commission.
- `refunded` does not qualify for referral commission.
- Refunded bets return the full original gross stake, including the fee portion.
- For refunded bets, final platform profit is zero.
- If a bet has no referrer, the commission portion remains platform income after final non-refund settlement.

## Approaches Considered

### Recommended: temporary platform custody, final settlement recognition

At placement time, send `house + commission` to the platform wallet. Later, when the bet reaches a final outcome:

- `win` or `loss`: commission becomes referrer-claimable, house remains platform profit
- `refunded`: both house and commission are economically reversed through full refund logic

Why this is recommended:

- matches the confirmed business rule exactly
- avoids premature referral earnings
- keeps the on-chain fee destination simple
- makes refund behavior consistent with "refund includes fee"

### Alternative: immediate on-chain transfer to referrer

At placement time, send commission directly to the referrer ATA.

Rejected because:

- refunds would require clawback or platform-funded replacement
- many referred bets would create ATA and payout complexity during placement
- settlement state would no longer be the source of truth for commission eligibility

### Alternative: keep a separate commission wallet

Continue sending commission to `COMMISSION_WALLET`, then later decide whether to release it.

Rejected for now because:

- it adds another wallet without improving the core business rule
- the confirmed goal is that temporary platform fee custody should be centralized in `3ve...`

## Affected Areas

Primary logic:

- `src/lib/wallets.ts`
- `src/app/[locale]/page.tsx`
- `src/app/page.tsx`
- `src/app/api/referral/route.ts`
- `src/app/api/bets/route.ts`
- `src/app/api/cron/settle/route.ts`

Likely supporting logic and tests:

- `src/lib/referral-stats.ts`
- `src/app/api/referral/route.test.ts`
- `src/app/api/bets/route.test.ts`
- `src/app/api/cron/settle/route.test.ts`

## Design

### 1. Placement-time transfer model

The placement transaction should continue splitting the stake, but with only two effective destinations:

- `poolAmount` -> pool ATA
- `houseAmount + commissionAmount` -> `3ve...` ATA

This means placement no longer requires a distinct commission destination for new bets.

Recommended interpretation:

- `pool`: temporary payout funding
- `house`: platform fee component that always belongs to the platform if the bet is not refunded
- `commission`: platform-custodied referral allocation candidate, not yet earned by the referrer

Implementation note:

- `COMMISSION_WALLET` may remain in config for backward compatibility, but new placement flow should not require a separate commission transfer instruction

### 2. Referral ledger timing

`/api/referral` should no longer treat bet placement as the moment commission is earned.

At placement time, the system should only record enough information to evaluate commission later. The recommended minimum is:

- bettor address
- referrer address if any
- bet signature
- bet amount
- computed commission amount
- initial referral status such as `pending`

Important meaning change:

- `pending` = final outcome not yet recognized for commission eligibility
- `approved` = bet finished as `win` or `loss`, commission now counts toward withdrawable
- `settled` = already withdrawn or paid out

No positive withdrawable commission should appear before final settlement.

### 3. Final settlement rule

A bet is commission-eligible if and only if its final status is:

- `win`
- `loss`

A bet is not commission-eligible if its final status is:

- `refunded`

When a referred bet becomes finally settled as `win` or `loss`:

- the corresponding pending referral record becomes `approved`
- the referrer aggregate totals increase
- the bet's commission amount becomes withdrawable according to the existing referral flow

When a referred bet becomes `refunded`:

- the corresponding pending referral record must not become withdrawable
- if a pending record exists, it should be marked as cancelled or removed from earning calculations
- no positive commission should remain for that bet

This rule deliberately ignores who won the bet. The only distinction is:

- non-refund final outcome -> commission exists
- refund -> commission does not exist

### 4. Platform profit recognition

Final platform profit must be recognized only after settlement:

- `win` or `loss` with no referrer:
  - platform keeps `house + commission`
- `win` or `loss` with referrer:
  - platform keeps `house`
  - referrer earns `commission`
- `refunded`:
  - platform keeps neither `house` nor `commission`

This is an accounting rule, not necessarily an immediate on-chain movement rule.

For the recommended first implementation:

- keep platform custody in `3ve...`
- represent referrer earnings in the internal referral ledger
- preserve the current withdraw flow for actual payout to the referrer

That avoids introducing automatic on-chain commission sends during settlement.

### 5. Refund semantics

Refunded bets must return the player's full original stake.

That includes:

- the portion that originally went to the pool
- the portion that originally went to temporary platform fee custody

Economically, the bet should end with:

- player net stake cost = `0`
- platform profit = `0`
- referrer commission = `0`

If the implementation already refunds principal from the pool side only, it must be extended so the fee portion is also returned or otherwise offset.

The core requirement is outcome correctness:

- the player receives the full gross amount back

### 6. Verification and reconciliation

The existing referral verification flow currently checks three destinations:

- pool ATA
- house ATA
- commission ATA

For the new design, verification should accept the new shape:

- pool ATA receives exactly `poolAmount`
- house ATA receives exactly `houseAmount + commissionAmount`
- commission ATA is not required for new bets

Backward compatibility rule:

- old bets that were created under the three-destination model should still verify under their historical structure

Recommended implementation strategy:

- version the verification expectation based on whether a bet record explicitly stores a combined-fee destination model
- or infer legacy behavior from the presence of separate commission transfer metadata

### 7. Referral stats semantics

`src/lib/referral-stats.ts` should continue treating only `approved` commission as withdrawable.

But the design now requires stronger semantics:

- `pending` records do not count as withdrawable
- `approved` records count as withdrawable
- refunded or cancelled referral candidates must contribute zero to totals intended to represent earned value

Confirmed stats interpretation:

- `stats.total` means total earned commission from final non-refund bets only
- `stats.month` means same-period earned commission from final non-refund bets only
- `stats.withdrawable` remains approved and not yet withdrawn commission

Pending referral candidates are operational state, not earned value, and must not inflate earned totals.

### 8. Data model recommendations

The first implementation may stay within the current file-based schema, but the following fields are recommended for clarity:

On bet records:

- `poolAmount`
- `houseAmount`
- `commissionAmount`
- `feeCollectionModel: 'combined_platform_fee' | 'legacy_split_fee'`

On referral commission records:

- `betSignature`
- `betStatusSnapshot`
- `status: 'pending' | 'approved' | 'settled' | 'cancelled'`
- optional `approvedAt`
- optional `cancelledAt`
- optional `cancellationReason`

These fields reduce ambiguity during reconciliation and make historical audits easier.

### 9. Migration and backward compatibility

Historical bets may already exist in two patterns:

- legacy split transfer to separate house and commission wallets
- new combined transfer model after this change

Historical referral records may also already contain positive entries created too early.

This spec does not require a full destructive migration. The safer path is:

1. keep old records readable
2. apply new rules only to newly placed bets unless targeted repair is added
3. if repair is added, convert pending historical referral entries according to the final bet status

Important safety rule:

- do not reinterpret already settled withdrawals in a way that changes past user-visible balances without an explicit repair plan

## Data Flow

1. User places a real-money bet.
2. Frontend builds a transfer with:
   - net pool amount to pool ATA
   - total fee amount to `3ve...` ATA
3. Backend stores the bet and the computed split amounts.
4. Referral API stores a pending referral candidate only if the bettor has a valid referrer.
5. Match reaches final state.
6. Settlement logic classifies the bet as:
   - `win`
   - `loss`
   - `refunded`
7. Referral reconciliation applies:
   - `win/loss` -> approve commission
   - `refunded` -> cancel commission
8. Refund logic ensures refunded bets return the full gross stake.
9. Platform accounting interprets final retained house and commission according to the final status and whether a referrer exists.

## Error Handling

- If the placement transfer does not match the expected combined-fee model, reject referral approval for that bet until reconciled.
- If a bet is missing split metadata, prefer conservative behavior and do not approve referral commission automatically.
- If a pending referral record cannot be matched to a final bet deterministically, leave it pending and log for admin review.
- If a refund is detected after commission was already approved, the system must cancel or reverse that commission before it remains withdrawable.
- If rounding leaves a dust difference of a few raw units, reconciliation should compare against persisted raw split amounts, not recomputed floating-point values.

## Scope

In scope:

- combined temporary platform fee custody in `3ve...`
- settlement-based referral commission recognition
- `win/loss` eligible, `refunded` ineligible rule
- full-gross refund semantics including fee
- verification updates for the new transfer shape
- focused regression tests

Out of scope:

- automatic on-chain payout to referrers at settlement time
- replacing the existing manual or requested withdraw flow
- changing fee percentages
- redesigning non-referral admin payout tools
- removing legacy fee-transfer compatibility for historical bets

## Testing

Recommended focused automated coverage:

- placement sends `poolAmount` to pool ATA and `houseAmount + commissionAmount` to `3ve...`
- referral `place_bet` creates pending commission candidate, not approved earnings
- final `loss` approves commission for referred bet
- final `win` approves commission for referred bet
- final `refunded` cancels commission and leaves withdrawable unchanged
- refunded bet returns full original gross amount
- non-referred final bet leaves commission as platform income
- legacy three-destination bets continue validating correctly where backward compatibility is required

Manual verification:

1. Place a referred real-money bet.
2. Confirm the chain transfer sends fee custody to `3ve...`.
3. Open referral page and confirm the entry is pending, not withdrawable.
4. Finalize the match as `loss`.
5. Confirm the referrer now sees approved withdrawable commission.
6. Repeat with a final `win` and confirm the same eligibility behavior.
7. Repeat with a refunded outcome and confirm:
   - player receives full original stake
   - referrer receives no commission
   - platform keeps no final profit from that bet

## Expected Outcome

After this change:

- all temporary platform fee custody for new bets lands in `3ve...`
- referrers no longer earn commission prematurely at placement
- both `win` and `loss` produce referral commission when the bet is finally valid
- refunded bets produce neither platform profit nor referral commission
- refund behavior matches the promise that fee is also returned
- the platform accounting model becomes easier to explain and audit
