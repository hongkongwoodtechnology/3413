# Admin Unified Hybrid Design

## Summary

This spec unifies the current embedded homepage admin panel and the legacy `/admin` route into one coherent hybrid admin system.

The target model has two layers:

- a lightweight homepage quick panel for high-priority admin summaries and shortcuts
- a full `/admin` back office for complete operational workflows

The redesign focuses on information architecture first, then visual cleanup. The goal is not only to make the interface look cleaner, but to reduce cognitive overload, separate high-frequency and low-frequency operations, and create a scalable admin structure for future growth.

## Current Problems

The codebase currently contains two parallel admin experiences:

- `src/components/admin/AdminDashboard.tsx`
  - embedded inside the homepage through a toggle
  - dark theme
  - extremely large single component with mixed concerns
- `src/app/admin/*`
  - route-based admin area with `src/app/admin/layout.tsx`
  - lighter legacy visual style
  - multiple separate pages with a clearer page structure but inconsistent visual system

This creates several product and UX problems:

- duplicated admin mental models
- inconsistent themes and navigation patterns
- too many unrelated functions stacked in one dashboard
- high-risk actions mixed into overview screens
- weak hierarchy between summary information and operational tasks

## Product Decision

The confirmed direction is a hybrid admin model.

### Layer 1: Homepage Quick Panel

The homepage should keep only a compact admin quick panel for immediate awareness and navigation.

It should contain:

- key KPI summaries
- payout alerts
- anomaly alerts
- revenue summary
- direct links into full `/admin` sections

It should not contain:

- long tables
- complex filters
- destructive or multi-step operations
- financial workflows
- system initialization flows

### Layer 2: Full `/admin` Back Office

The full admin system should live under `/admin` and become the single source of truth for all real admin operations.

This route-based admin area should absorb the current functional surface area from the homepage admin panel and legacy admin pages, while using one unified visual language and one unified navigation model.

## Recommended Approach

Use `/admin` as the operational hub and keep the homepage admin view as a summary-only quick panel.

### Why this approach

- preserves fast access to urgent information from the homepage
- removes operational clutter from the homepage
- gives the admin system proper navigation and page boundaries
- scales better than a single mega-dashboard
- avoids keeping two full admin systems alive

### Rejected alternatives

- Keep everything in one homepage admin panel. Rejected because it does not solve the structural clutter problem.
- Move everything to `/admin` and remove all homepage admin visibility. Rejected because a compact quick panel is still useful for fast operator awareness.

## Information Architecture

The full `/admin` area should be organized into five primary modules.

### 1. Overview

Purpose:

- provide operational visibility at a glance
- surface urgent items
- route users to deeper tools

Contents:

- core KPI cards
- anomaly summary
- pending payout summary
- platform revenue summary
- quick action links

Rules:

- no dense operational tables by default
- no low-frequency setup tools
- no destructive workflow buttons except tightly scoped shortcuts

### 2. Markets And Matches

Purpose:

- monitor match-level market health
- inspect pool distribution and market concentration

Contents:

- market list
- concentration risk status
- distribution chart
- match-level betting details
- search, sorting, export controls

### 3. Finance And Payouts

Purpose:

- centralize money movement and settlement operations

Contents:

- winner payout workflows
- platform net revenue
- withdrawal tools
- archive old data actions
- legacy payout handling actions

Rules:

- all payout-affecting actions live here
- high-risk buttons should be grouped and visually isolated

### 4. Users And Referrals

Purpose:

- manage user lookup and referral operations

Contents:

- user search
- referral leaderboard
- bonus airdrop
- commission rate configuration

### 5. Security And System

Purpose:

- isolate infrastructure and security-sensitive tools

Contents:

- audit logs
- ATA initialization
- system status or future admin-only controls

Rules:

- setup and infrastructure actions should not appear on overview pages

## Visual Design Direction

The admin system should use one consistent visual language aligned with the main product rather than keeping the current legacy light theme.

### Visual principles

- dark interface aligned with the main app
- stronger hierarchy through spacing, sectioning, and typography
- fewer cards per viewport
- more deliberate grouping of controls
- status colors reserved for meaningful state changes

### Layout principles

- fixed left sidebar for the five primary modules
- persistent top bar for page title, last refresh time, and page-level actions
- overview pages prioritize summaries
- detail pages prioritize tables, filters, and workflows
- dangerous actions moved lower and visually separated

### Density rules

- dashboard top section should not exceed four primary KPI cards
- alert blocks should appear before informational charts
- low-frequency admin tools must not compete visually with daily-use data

## Structural Refactor Direction

The current `src/components/admin/AdminDashboard.tsx` is too large and mixes many unrelated responsibilities.

The redesign should use smaller focused admin sections and route-level composition.

Recommended direction:

- move homepage quick panel into a dedicated lightweight component
- move full admin overview into route-based admin pages
- split large admin surfaces into page-scoped sections or feature components
- preserve existing APIs where possible

This spec does not require a full backend redesign. It is primarily a UI architecture and frontend structure change.

## Affected Areas

Likely files involved:

- `src/components/admin/AdminDashboard.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/admin/analytics/page.tsx`
- `src/app/admin/secure-audit-logs/page.tsx`
- `src/app/page.tsx`

Possible new supporting components:

- `src/components/admin/QuickPanel.tsx`
- `src/components/admin/overview/*`
- `src/components/admin/finance/*`
- `src/components/admin/markets/*`
- `src/components/admin/users/*`
- `src/components/admin/system/*`

## Behavior Changes

### Homepage

The homepage should no longer host the full admin dashboard experience.

Instead:

- show a compact quick panel only for admins
- show summary metrics and alerts
- provide clear navigation into `/admin`

### Admin Navigation

The `/admin` layout should become the canonical admin shell.

It should:

- unify theme and spacing
- present the five confirmed modules
- make navigation stable and predictable

### Legacy Pages

Legacy admin pages should not remain visually or structurally disconnected.

They should either:

- be restyled and absorbed into the new shell
- or be replaced by new route pages that represent the same function in the new IA

## Non-Goals

This spec does not include:

- backend API redesign
- permission model redesign
- changing payout business rules
- changing referral business rules
- changing analytics logic

## Testing And Verification

The redesign should be validated at three levels.

### 1. Structural verification

- admin quick panel appears only in homepage summary form
- full operations are accessible from `/admin`
- the five modules are reachable through unified navigation

### 2. UX verification

- overview page is visibly less crowded than the current mega dashboard
- high-risk tools are separated from KPI summaries
- operators can reach core workflows in fewer steps

### 3. Regression verification

- existing data still loads from the same APIs
- payout, referral, and audit workflows still function after relocation
- admin-only visibility remains preserved

## Scope

In scope:

- merge embedded and legacy admin experiences into one hybrid system
- define homepage quick panel
- rebuild `/admin` as the full back office
- redesign navigation and page hierarchy
- unify visual style
- reorganize existing admin functionality by module

Out of scope:

- changing backend business logic
- redesigning every chart’s data model
- adding new admin product features unrelated to organization and layout
