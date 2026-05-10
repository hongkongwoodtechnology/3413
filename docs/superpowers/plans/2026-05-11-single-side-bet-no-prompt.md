# Single-Side Bet No Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the single-side betting confirmation dialog so `refund_single_side` bets proceed directly without showing any prompt.

**Architecture:** Keep the existing odds and refund model unchanged and make a UI-only adjustment inside `handlePrediction()` in `src/app/page.tsx`. Use a minimal TDD cycle around the affected path, then verify that the page still compiles cleanly and existing guarded states remain intact.

**Tech Stack:** Next.js, React, TypeScript, Jest, VS Code diagnostics

---

## File Map

- Modify: `src/app/page.tsx`
  - Remove the `window.confirm(...)` branch for `refund_single_side`
  - Keep `position_limit`, `projectedOdds === null`, and default execution paths unchanged
- Optional Test: `src/app/page.tsx` or a nearby extracted helper file if adding a focused test is practical
- Reference Spec: `docs/superpowers/specs/2026-05-11-single-side-bet-no-prompt-design.md`

### Task 1: Remove The Single-Side Prompt

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Reference: `c:\Users\USER\Documents\trae_projects\GAMBLE\docs\superpowers\specs\2026-05-11-single-side-bet-no-prompt-design.md`

- [ ] **Step 1: Read the current branch logic in `handlePrediction()`**

```tsx
if (projectedOdds.riskLevel === 'refund_single_side') {
    const confirmed = window.confirm(
        t('confirm.refund_single_side') ||
        '目前只有此選項有投注，如比賽前仍無人投注其他選項，所有投注將全額退款（不扣手續費）。確定要繼續投注嗎？'
    );
    if (!confirmed) return;
    await executePrediction(projectedOdds.odds);
    return;
}
```

Goal: confirm the only behavior being removed is the confirmation prompt and cancellation branch.

- [ ] **Step 2: Replace the prompt branch with direct execution**

```tsx
if (projectedOdds.riskLevel === 'refund_single_side') {
    await executePrediction(projectedOdds.odds);
    return;
}
```

Constraint: do not change any other `riskLevel` branch and do not add any inline message, alert, modal, or toast.

- [ ] **Step 3: Verify the edited file is syntactically and semantically clean**

Run diagnostics on:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.tsx
```

Expected: no new diagnostics.

### Task 2: Regression Verification

**Files:**
- Modify if practical: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Test if added: a focused test file only if it can cover this branch cheaply without broad refactoring

- [ ] **Step 1: Decide the lowest-cost verification path**

Use this rule:

```text
If a focused test can be added without large component refactoring, add it.
If adding the test would require broad extraction or large page rewrites, prefer manual verification because this change is a one-branch UI simplification.
```

- [ ] **Step 2A: If adding a focused test is practical, write the failing test first**

Example target behavior:

```tsx
it('submits refund_single_side bets without opening a confirmation dialog', async () => {
  const confirmSpy = jest.spyOn(window, 'confirm');
  const executePrediction = jest.fn();

  await handleRefundSingleSide(executePrediction, 2.15);

  expect(confirmSpy).not.toHaveBeenCalled();
  expect(executePrediction).toHaveBeenCalledWith(2.15);
});
```

Requirement: the test must fail first for the right reason before implementation.

- [ ] **Step 2B: If test extraction is not practical, run targeted manual verification**

Manual verification checklist:

```text
1. Create or simulate a refund_single_side betting scenario.
2. Click the confirm bet button.
3. Confirm no browser dialog appears.
4. Confirm the flow proceeds into normal bet submission.
5. Confirm position_limit still shows its existing rejection alert.
```

- [ ] **Step 3: Run the smallest relevant automated verification**

If no new test was added, run at least one nearby suite:

```bash
npm test -- src/app/api/bets/route.test.ts src/lib/wallets.test.ts
```

Expected: PASS

If a new focused test was added, include it in the command:

```bash
npm test -- <new-test-file> src/app/api/bets/route.test.ts src/lib/wallets.test.ts
```

- [ ] **Step 4: Commit the change**

```bash
git add src/app/page.tsx docs/superpowers/plans/2026-05-11-single-side-bet-no-prompt.md
git commit -m "fix: remove single-side betting confirmation prompt"
```

Only include any new test file in the commit if one was actually created.

## Self-Review

- Spec coverage: the plan removes the `refund_single_side` prompt, preserves existing refund behavior, adds no replacement UI, and keeps scope limited to the page interaction path.
- Placeholder scan: no `TODO`, `TBD`, or vague implementation-only wording remains.
- Type consistency: all references use the existing `projectedOdds.riskLevel === 'refund_single_side'` branch and `executePrediction(projectedOdds.odds)` call shape from `src/app/page.tsx`.
