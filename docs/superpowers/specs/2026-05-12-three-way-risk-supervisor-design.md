# Three-Way Risk Supervisor Design

## Summary

This spec defines a layered risk supervisor for a `home / draw / away` market that runs across both pre-match and live phases.

Confirmed scope:

- market type is only `home / draw / away`
- phases include both `pre-match` and `live`
- controls are internal only
- available actions are `reprice`, `limit_stake`, `suspend_outcome`, and `suspend_match`
- first-version risk baselines use `single-match total pool`, not platform reserve

This design is intentionally additive:

- existing market phase logic remains in place
- existing single-sided refund behavior remains in place
- existing odds calculation remains in place
- the new supervisor evaluates risk around those systems and decides whether pricing or acceptance should proceed

## Problem

The current system already contains useful pieces:

- explicit single-sided market detection
- fixed `initialOdds` during single-sided phase
- dynamic pricing for multi-sided markets
- position concentration checks

What it does not yet define as one coherent system is:

- a unified trigger order across pre-match and live
- consistent liability-based thresholds
- a reusable monitoring model that matches backend, Excel verification, and admin alerts
- event-protection rules for live data shocks such as goals, red cards, VAR, or feed delay

Without one shared supervisor:

- the same market may be judged differently by pricing, order acceptance, and admin views
- live protection may be inconsistent
- operations cannot easily audit why a market was repriced, limited, or suspended

## Confirmed Product Decisions

- The market remains `home / draw / away` only.
- The supervisor applies to both `pre-match` and `live`.
- The system does not hedge externally.
- Risk control uses internal actions only:
  - `reprice`
  - `limit_stake`
  - `suspend_outcome`
  - `suspend_match`
- First-version thresholds use `single-match total pool` as the denominator.
- Existing single-sided behavior remains unchanged:
  - quote `initialOdds`
  - accept bets
  - refund if the market never forms before close

## Approaches Considered

### Recommended: layered supervisor with explicit triggers

Add a separate risk-supervisor layer that evaluates market state in four ordered stages:

1. market phase
2. live event protection
3. liability imbalance
4. single-order impact

Why this is recommended:

- matches the current codebase structure
- keeps pricing and risk responsibilities separate
- gives one language for backend logic, Excel checks, and admin alerts
- is easier to reason about than a composite risk score

### Alternative: simple threshold-only model

Use only `max_liability_ratio` and `max_pool_share` thresholds.

Rejected because:

- it is too coarse for live operation
- it does not define how single-bet impact is handled
- it does not cleanly separate live freezes from ordinary imbalance

### Alternative: unified risk score model

Combine many indicators into one score and trigger actions from score bands.

Rejected because:

- it is less transparent for operators
- it is harder to verify in Excel
- it is harder to audit after incidents

## Core Architecture

### Trigger order

Every market refresh and every order request should evaluate risk in the same order:

```text
market phase
-> live event protection
-> current market imbalance
-> single-order impact
-> action decision
```

This trigger order prevents independent modules from making conflicting decisions.

### Layer 1: market phase

The supervisor must classify each market into one of:

- `zero-sided`
- `single-sided`
- `multi-sided-pre`
- `multi-sided-live`

Behavior:

- `zero-sided`
  - show initial market
  - no liability risk action
- `single-sided`
  - keep existing `initialOdds`
  - keep existing refund-safe behavior
  - do not apply aggressive liability controls
- `multi-sided-pre`
  - enable imbalance checks and order-impact checks
- `multi-sided-live`
  - enable live event protection before any other pricing or order logic

### Layer 2: live event protection

In live markets, the system should suspend first and reprice later whenever a critical match event or data abnormality appears.

Protected triggers:

- `goal`
- `red_card`
- `VAR_pending`
- `score_jump`
- `status_backfill`
- `feed_delay`

Behavior:

- suspend the entire match for live-protection events
- wait for confirmation or feed stabilization
- resume only after the event is resolved or the feed becomes trustworthy again

### Layer 3: liability imbalance

For each market, the supervisor should calculate:

- `home_liability`
- `draw_liability`
- `away_liability`
- `max_liability`
- `max_liability_outcome`
- `max_liability_ratio`

Definition:

```text
outcome liability = sum(accepted stake * locked odds) for that outcome
```

This is intentionally gross payout pressure. It does not first net against losing pools or fees.

### Layer 4: single-order impact

Before accepting a bet, the supervisor should simulate the post-bet market:

- updated liability on the selected outcome
- updated total pool
- updated `max_liability_ratio`
- resulting post-bet risk level

This check decides whether the incoming order may proceed at the current quote, needs repricing, needs stake limiting, or must be rejected.

## Risk Metrics

### Core fields per match

Required per-market fields:

- `match_id`
- `phase`
- `status`
- `home_pool`
- `draw_pool`
- `away_pool`
- `total_pool`
- `home_odds`
- `draw_odds`
- `away_odds`
- `home_liability`
- `draw_liability`
- `away_liability`
- `max_liability`
- `max_liability_outcome`
- `max_liability_ratio`
- `home_pool_share`
- `draw_pool_share`
- `away_pool_share`
- `max_pool_share`
- `event_freeze_flag`
- `data_delay_flag`
- `risk_level`
- `action`

### Formulas

```text
total_pool = home_pool + draw_pool + away_pool
max_liability = max(home_liability, draw_liability, away_liability)
max_liability_ratio = max_liability / total_pool
pool_share(outcome) = outcome_pool / total_pool
max_pool_share = max(home_pool_share, draw_pool_share, away_pool_share)
```

If `total_pool == 0`, all ratio fields should resolve to `0`.

## Risk Thresholds

### Liability thresholds

- `warning` when `max_liability_ratio >= 1.80`
- `danger` when `max_liability_ratio >= 2.20`
- `critical` when `max_liability_ratio >= 2.80`

### Pool concentration thresholds

- `warning` when `max_pool_share >= 0.60`
- `danger` when `max_pool_share >= 0.75`
- `critical` when `max_pool_share >= 0.85`

### Threshold interpretation

- liability thresholds measure payout pressure
- pool-share thresholds measure incoming flow concentration
- the final market risk level uses the higher of the two levels

This allows the system to escalate even when payout pressure is not yet extreme but order flow is already heavily one-sided.

## Action Rules

### Risk actions

- `normal`
  - action: `none`
- `warning`
  - action: `reprice`
  - guidance: shorten the high-risk outcome by roughly `2% - 4%`
- `danger`
  - action: `limit_stake`
  - guidance: shorten the high-risk outcome by roughly `5% - 8%`
  - reduce maximum accepted stake on the high-risk outcome
- `critical`
  - action: `suspend_outcome`
  - close the highest-risk outcome
  - keep the rest of the market open if live protection is not the cause

### Match-wide suspension

Use `suspend_match` only for:

- live critical events
- feed delay
- data anomalies

Ordinary pre-match imbalance should not suspend the entire match unless future business rules explicitly require it.

### Minimum-sample protection

When `total_pool` is still very small, the system should avoid overly aggressive liability actions and rely on:

- existing single-sided behavior
- basic per-bet stake limits

This prevents noisy ratios in tiny pools from creating false alarms.

### High-odds protection

The first version may optionally apply extra caution to naturally high-priced outcomes because equal stake creates larger payout pressure there.

This is an implementation option, not a mandatory v1 formula.

## Excel Verification Template

### Workbook structure

Recommended sheets:

- `Matches`
- `Bets`
- `Config`

### Config values

Recommended first-version config:

- `warning_liability_ratio = 1.8`
- `danger_liability_ratio = 2.2`
- `critical_liability_ratio = 2.8`
- `warning_pool_share = 0.60`
- `danger_pool_share = 0.75`
- `critical_pool_share = 0.85`
- `goal_freeze_sec = 15`
- `red_card_freeze_sec = 15`
- `var_freeze_sec = 30`
- `feed_delay_sec = 8`

### Bets sheet

Recommended fields:

- `bet_id`
- `match_id`
- `outcome`
- `stake`
- `locked_odds`
- `potential_payout`
- `bet_time`
- `match_phase_at_bet`
- `status`

Formula:

```text
potential_payout = stake * locked_odds
```

### Matches sheet

Recommended fields:

- `match_id`
- `status`
- `phase`
- `home_pool`
- `draw_pool`
- `away_pool`
- `total_pool`
- `home_liability`
- `draw_liability`
- `away_liability`
- `max_liability`
- `max_liability_outcome`
- `max_liability_ratio`
- `home_pool_share`
- `draw_pool_share`
- `away_pool_share`
- `max_pool_share`
- `liability_level`
- `pool_share_level`
- `event_freeze_flag`
- `data_delay_flag`
- `final_risk_level`
- `action`

### Example formulas

```text
total_pool = SUM(home_pool:away_pool)
home_liability = SUMIFS(Bets.potential_payout, Bets.match_id, match_id, Bets.outcome, "home", Bets.status, "accepted")
draw_liability = SUMIFS(Bets.potential_payout, Bets.match_id, match_id, Bets.outcome, "draw", Bets.status, "accepted")
away_liability = SUMIFS(Bets.potential_payout, Bets.match_id, match_id, Bets.outcome, "away", Bets.status, "accepted")
max_liability = MAX(home_liability, draw_liability, away_liability)
max_liability_outcome = INDEX({"home","draw","away"}, MATCH(max_liability, liabilities, 0))
max_liability_ratio = max_liability / total_pool
max_pool_share = MAX(home_pool_share, draw_pool_share, away_pool_share)
```

### Post-bet simulation area

The template should include a simple what-if block with:

- `test_outcome`
- `test_stake`
- `test_quote_odds`
- post-bet liabilities
- post-bet total pool
- post-bet max liability ratio
- post-bet risk level
- decision

This gives operators and developers one shared way to validate order-impact logic.

## Python Monitoring Design

### Role of the Python supervisor

The Python component is a `risk supervisor`, not a replacement odds engine.

Responsibilities:

- build a match snapshot
- evaluate current market risk
- detect live-protection conditions
- simulate single-order impact
- return an action decision

### Suggested responsibilities

- `build_match_snapshot(match, bets)`
  - assemble market phase, pools, liabilities, and live-state fields
- `evaluate_market_risk(snapshot, config)`
  - calculate current ratios, levels, and actions
- `detect_live_protection(snapshot, feed_state, config)`
  - detect event freezes and data anomalies
- `simulate_bet_impact(snapshot, order, config)`
  - calculate post-bet liabilities and post-bet risk
- `decide_order_action(snapshot, order, config)`
  - produce `accept`, `reprice`, `limit`, `reject`, or `suspend`

### Execution model

The system should run in two modes:

- `order-driven`
  - evaluate every incoming bet before acceptance
- `event-driven`
  - re-evaluate every live feed update, score change, or status change

This covers both:

- large incoming orders
- risk changes caused by the match itself even without new betting activity

### Integration boundary

Recommended integration:

- keep `odds-engine` responsible for pricing
- keep `market-rules` responsible for market phase
- add a `risk supervisor` that decides whether quoting and acceptance should continue

This keeps the scope focused and avoids rewriting working domain logic.

## Admin Alerts

### Alert levels

- `info`
  - lifecycle notifications only
- `warning`
  - early imbalance, system reprices
- `danger`
  - significant imbalance, system limits stake
- `critical`
  - unacceptable risk or live protection, system suspends outcome or match

### Alert types

Recommended alert categories:

- `phase_change`
- `liability_warning`
- `concentration_warning`
- `post_bet_impact`
- `live_event_freeze`
- `feed_delay`
- `data_anomaly`
- `auto_suspend`
- `manual_resume_required`

### Trigger rules

#### `info`

Use for state transitions:

- `zero-sided -> single-sided`
- `single-sided -> multi-sided`
- `upcoming -> live`
- `live -> suspended`
- `suspended -> resumed`

#### `warning`

Trigger when any of the following holds:

- `max_liability_ratio >= 1.80`
- `max_pool_share >= 0.60`
- post-bet simulation reaches `warning`

System action:

- `reprice`

#### `danger`

Trigger when any of the following holds:

- `max_liability_ratio >= 2.20`
- `max_pool_share >= 0.75`
- post-bet simulation reaches `danger`
- repeated same-outcome large bets in a short window
- risk rebounds immediately after live-market reopen

System action:

- `limit_stake`

#### `critical`

Trigger when any of the following holds:

- `max_liability_ratio >= 2.80`
- `max_pool_share >= 0.85`
- post-bet simulation reaches `critical`
- `goal`
- `red_card`
- `VAR_pending`
- `feed_delay`
- `score_jump`
- `status_backfill`

System action:

- `suspend_outcome` or `suspend_match`

### Required alert fields

- `alert_id`
- `match_id`
- `match_label`
- `status`
- `phase`
- `alert_level`
- `alert_type`
- `trigger_outcome`
- `max_liability_outcome`
- `max_liability_ratio`
- `max_pool_share`
- `current_action`
- `message`
- `created_at`
- `resolved_at`
- `resolved_by`
- `dedupe_key`

### Dedupe and escalation

Recommended dedupe key:

```text
dedupe_key = match_id + alert_type + trigger_outcome
```

Rules:

- do not create duplicate alerts for the same match, outcome, and type in a short window
- if the level escalates, update the existing alert
- if the alert is already at `critical`, update `last_seen_at` instead of creating a new row

### Recovery behavior

Do not clear alerts immediately when a metric dips below a threshold.

Recommended recovery windows:

- `warning`: below threshold for `60s`
- `danger`: below threshold for `120s`
- `critical` from imbalance: below `danger` for `180s`
- `live_event_freeze`: recover only after event confirmation and stable feed
- `data_delay` and `data_anomaly`: recover only after normal data quality returns

### Admin dashboard cards

Recommended first-version summary cards:

- `Critical Matches Count`
- `Danger Matches Count`
- `Currently Suspended Outcomes`
- `Currently Suspended Matches`
- `Top 10 Liability Ratio`
- `Recent Live Event Freezes`

## Error Handling

- If live data is delayed or inconsistent, prefer `suspend_match` over speculative repricing.
- If the market is single-sided, continue to use existing refund-safe behavior.
- If ratio inputs are missing or invalid, fail conservatively and avoid taking unsupported bets.
- If alert classification and action classification disagree, action must follow the higher-severity outcome.

## Testing Strategy

### Unit tests

Add tests for:

- liability ratio classification across all thresholds
- pool-share classification across all thresholds
- merged risk-level selection
- live event freeze detection
- post-bet impact classification
- recovery-window behavior

### Integration tests

Add tests for:

- single-sided markets bypassing aggressive liability actions
- multi-sided pre-match markets repricing at `warning`
- markets limiting stake at `danger`
- markets suspending the risky outcome at `critical`
- live matches suspending on goal, red card, VAR, and feed delay
- resumed live markets re-entering normal flow only after confirmation

### Excel parity checks

Verify that a shared set of sample matches yields the same:

- liabilities
- max liability outcome
- max liability ratio
- pool-share level
- final risk level
- action

across:

- backend logic
- Python supervisor
- Excel verification sheet

## Non-goals

- changing the single-sided refund policy
- adding external hedging
- switching the first version to reserve-based risk denominators
- replacing the current odds engine
- introducing a black-box composite risk score
