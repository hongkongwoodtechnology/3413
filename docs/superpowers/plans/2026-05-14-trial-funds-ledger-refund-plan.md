# Trial Funds Ledger Refund Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist trial-funds balance deductions on `useBonus` bets and refund the same amount back to the internal trial-funds ledger exactly once when a bet becomes `refunded`.

**Architecture:** Keep the source of truth for trial funds in `referral_db.balances.bonus`. Add a small server-side ledger action in `/api/referral` for trial bet deductions, and extend the existing refund reconciliation pass so it also restores `balances.bonus` for refunded bonus bets with an idempotent marker on the bet record.

**Tech Stack:** Next.js App Router, TypeScript, Jest with `ts-jest`, file-backed JSON persistence

---

## File Map

- Modify: `src/app/api/referral/route.ts`
  - Add a trial-funds ledger action for `useBonus` bet deductions and add one-time refund reconciliation for refunded bonus bets.
- Modify: `src/app/api/referral/route.test.ts`
  - Add focused API tests for bonus deduction persistence and single-run refund restoration.
- Modify: `src/app/[locale]/page.tsx`
  - Call the new referral ledger action after a successful `useBonus` bet save so the internal balance is persisted.

