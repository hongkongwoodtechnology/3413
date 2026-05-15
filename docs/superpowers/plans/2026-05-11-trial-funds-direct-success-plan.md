# Trial Funds Direct Success Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make trial-funds bets skip the fake on-chain progress flow and go straight to the existing success state with `預測已下注！`.

**Architecture:** Keep the real-money path unchanged, but remove the artificial `submitting` and `confirming` delays for `useBonus === true`. The shared success path, optimistic UI updates, and backend bet persistence remain intact so only the status progression changes.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest

---

## File Map

- Modify: `src/app/page.tsx`
  - Removes fake chain progress for trial-funds bets and keeps the success overlay path.
- Optional Test Target: `src/app/page.tsx`
  - Verify the trial-funds branch no longer schedules fake intermediate transaction states.

### Task 1: Remove Fake Trial-Funds Progress States

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`

- [ ] **Step 1: Find the trial-funds status branch**

Current branch:

```ts
      } else {
        // 如果是體驗金，只在前端模擬延遲 (因為體驗金存在我們後端資料庫)
        setTxStatus("submitting");
        await new Promise(resolve => setTimeout(resolve, 1500));
        setTxStatus("confirming");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
```

- [ ] **Step 2: Replace it with a direct success-path handoff**

Updated branch:

```ts
      } else {
        // 體驗金不走上鏈流程，直接進入共用的成功收尾邏輯。
      }
```

- [ ] **Step 3: Keep the shared success finish unchanged**

Shared success section that must remain:

```ts
      setTxStatus("success")
      
      setTimeout(() => {
        setTxStatus("idle")
        setSelectedMatchId(null)
        setSelectedOutcome(null)
        setAmount("")
      }, 3000)
```

- [ ] **Step 4: Run diagnostics**

Check:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.tsx
```

Expected:

```text
No new diagnostics.
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: skip fake chain progress for trial funds bets"
```

### Task 2: Regression Verification

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`

- [ ] **Step 1: Verify trial-funds UX**

Manual check:

```text
Place a bet with 體驗金 enabled.
Confirm the UI no longer shows sign-request or confirming states.
Confirm the success overlay shows 預測已下注！ directly.
```

- [ ] **Step 2: Verify real-money UX still works**

Manual check:

```text
Place or dry-run a real-money bet.
Confirm the UI still shows submitting and confirming before success.
```

- [ ] **Step 3: Verify optimistic updates still occur**

Manual check:

```text
After a successful trial-funds bet, confirm the local balance, bet history, and match pools still update as before.
```

- [ ] **Step 4: Optional focused test if extracting a helper becomes worthwhile**

Run:

```bash
npm test -- --runTestsByPath src/lib/live-matches-loading.test.ts
```

Expected:

```text
PASS src/lib/live-matches-loading.test.ts
```

- [ ] **Step 5: Commit final verified state**

```bash
git add src/app/page.tsx
git commit -m "test: verify trial funds direct success flow"
```
