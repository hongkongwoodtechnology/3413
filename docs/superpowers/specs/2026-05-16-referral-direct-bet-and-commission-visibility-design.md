# Referral Direct Bet And Commission Visibility Design

## Summary

This spec fixes the referral page so direct-referral betting activity and commission sharing are visible instead of appearing empty or zeroed out.

The chosen approach is:

- keep withdrawal and settlement rules unchanged
- expand the frontend commission history rows to show direct bet details
- keep `withdrawable` based on settled commission only
- add display-level aggregation so pending commission and direct-referral volume are still visible on the page

This is a visibility and comprehension fix, not a change to payout policy.

## Problem

The referral page currently creates the impression that introduced users have no betting data or no commission sharing, even when raw data already exists.

The mismatch comes from two places:

- the referral API stores per-bet commission records with fields like `betAmount`, `commission`, `fee`, `timestamp`, and `status`
- the frontend history list only renders referee address, timestamp, commission amount, and fee

At the same time, summary values such as `stats.total` and `stats.withdrawable` are derived from `settled` records only.

Because most existing records are `pending`:

- the history section hides the bet amount users expect to see
- the direct-referral table can show zeroed aggregate values for some referees
- users reasonably conclude that introduced users did not bet or that revenue sharing is missing

## Confirmed Product Decision

- Show direct-referral bet details, not only aggregated totals.
- Keep the history filters `全部 / 已結算 / 待結算` and time filters unchanged.
- Keep `withdrawable` limited to settled commission.
- Do not treat pending commission as withdrawable.
- Make pending commission and direct bet volume visible in display data.
- Exclude withdrawal records from normal commission event presentation.

## Approaches Considered

### Recommended: UI expansion plus display-side aggregation fallback

Keep the backend settlement model as-is, but make the page display more of the data it already has and derive fallback aggregates from the commission ledger when referee summary fields are empty or stale.

Why this is recommended:

- fixes the user-visible problem without changing financial rules
- makes direct bet amount and commission immediately readable
- avoids inflating withdrawable values with pending records
- reduces dependence on legacy or partially updated referee aggregate fields

### Alternative: frontend-only row expansion

Show `betAmount` in the history list and leave all aggregate sections unchanged.

Rejected because:

- it only partially addresses the complaint
- referee totals can still look incorrect or empty
- users would still see a mismatch between list rows and summary modules

### Alternative: fully recompute all referral stats on the server

Rebuild referee aggregates and additional summary values on every referral GET response.

Rejected for now because:

- broader server change than needed for this fix
- higher chance of impacting existing withdrawal/stat assumptions
- the immediate issue is display clarity, not core ledger calculation

## Affected Areas

Primary frontend area:

- `src/app/[locale]/referral/page.tsx`

Primary backend area:

- `src/app/api/referral/route.ts`

Localization area:

- `src/lib/i18n.ts`

Focused tests:

- `src/app/[locale]/referral/page.test.tsx`
- `src/app/api/referral/route.test.ts`

## Existing Behavior

Today the referral page has two separate display gaps.

### 1. Commission history rows are incomplete

Each commission record already includes:

- referee address
- bet amount
- fee
- commission
- timestamp
- settlement status

But the history row only emphasizes:

- referee address
- timestamp
- commission
- fee

This omits the introduced user's actual bet amount, which is one of the main things the user expects to inspect.

### 2. Direct-referral aggregates can appear empty

The page renders referee aggregate columns such as:

- join date
- total volume
- earned commission

Some historical referee entries remain at zero while detailed commission records exist in the ledger.

That means the detail list and aggregate table can contradict each other.

## Design

### 1. Commission history row content

Each non-withdrawal commission row should display:

- referee identifier
- bet amount
- commission amount
- settlement status
- timestamp

The current fee value may remain as supporting information, but it should not replace the bet amount as the main secondary metric.

Recommended reading order:

1. referee
2. bet amount
3. commission amount
4. status
5. timestamp

This makes it obvious that the introduced user placed a bet and generated a specific commission event.

### 2. Status handling

Commission history continues to use the existing filter tabs:

- `all`
- `settled`
- `pending`

Display rules:

- `settled` rows are shown as settled commission income
- `pending` rows are shown as pending commission income
- withdrawal records are excluded from the normal commission history list

This preserves the current filtering behavior while making each row easier to interpret.

### 3. Direct-referral aggregate fallback

For the referee table, the page should display the best available aggregate values for each direct referral.

Recommended source priority:

1. existing referee aggregate values when they are present and non-zero
2. fallback aggregate values derived from matching commission ledger entries for that referee address

Derived fallback values should include:

- total bet volume from summed `betAmount`
- total commission from summed `commission`
- latest derived activity presence for determining whether the referee has generated visible events

The design goal is not to rewrite the database in the first pass, but to prevent obviously incorrect zero displays when detailed records already exist.

### 4. Summary semantics

The top summary and withdraw card semantics remain unchanged:

- `total` reflects settled earned commission
- `withdrawable` reflects settled and currently withdrawable commission
- pending amounts do not become withdrawable

To reduce confusion, the page may add a pending-oriented display value near the history or referral list area rather than changing existing financial summary meaning.

Recommended first version:

- keep top summary cards untouched unless implementation finds a minimal place to show pending count or pending total
- prioritize fixing row-level detail and referee-level aggregate visibility

### 5. Backward compatibility

Historical commission entries may not all have the same optional fields.

The display layer should therefore:

- safely parse numeric strings like `betAmount` and `commission`
- tolerate missing signatures
- continue to render older entries without crashing

If a record is malformed:

- suppress only the malformed derived value
- keep the rest of the page rendering

## Data Flow

1. Referral page fetches `/api/referral`.
2. API returns `stats`, `commissions`, `referees`, `balances`, and `commissionRate`.
3. Frontend filters commission items by status and time range.
4. Frontend excludes withdrawal records from normal commission rows.
5. Frontend renders each direct-referral commission row with bet amount, commission amount, status, and timestamp.
6. Frontend derives fallback referee aggregates by grouping commission rows per referee when existing aggregate values are missing or stale.

## Error Handling

- If referral data is loading, keep the current loading state.
- If referral data fails to load, keep the current error state.
- If a commission row contains an invalid numeric string, do not crash the page; treat that field as zero for derived display.
- If a referee exists with no commission rows, continue showing zero values.
- If a commission row refers to an address not present in `referees`, do not silently invent a new referee row in this UI pass unless implementation complexity is trivial.

## Scope

In scope:

- referral history row display improvements
- direct-referral aggregate fallback for visible table values
- preservation of settled-only withdrawable semantics
- minimal i18n additions required for new labels
- focused tests for row rendering and aggregate fallback

Out of scope:

- changing payout reserve rules
- changing withdrawal eligibility logic
- recomputing all server-side referral stats as a new canonical model
- multi-level team commission display
- admin leaderboard logic

## Localization

Add only the minimal keys needed for new visible labels.

Likely keys:

- `referral.history.bet_amount`
- `referral.history.status_settled`
- `referral.history.status_pending`

If the current implementation can reuse existing tab labels or status wording safely, prefer reuse over adding extra copy.

At minimum, ensure the Chinese locales used by the current page have correct strings:

- `zh-TW`
- `zh-CN`

## Testing

Recommended focused coverage:

- history row renders bet amount, commission amount, and pending status when commission data exists
- history filter still hides rows outside the selected status or time window
- withdrawal rows do not appear in the normal commission list
- referee aggregate table falls back to ledger-derived volume and commission when stored aggregate values are zero
- settled-only withdrawable behavior remains unchanged

Manual verification:

1. Open the referral page for an address with direct-referral commission records.
2. Confirm each visible history row shows bet amount and commission amount.
3. Switch between `全部 / 已結算 / 待結算`.
4. Switch between `1D / 3D / 7D / 30D / 3M / ALL`.
5. Confirm the referee table shows non-zero volume and commission for referrals that already have matching commission entries.
6. Confirm `withdrawable` still does not include pending commission.

## Expected Outcome

After this change:

- users can see that direct referrals actually placed bets
- users can see the commission generated by each bet
- pending commission remains visible without being mistaken for withdrawable balance
- direct-referral table values better match the underlying ledger data
- the page no longer looks empty when detailed commission records already exist
