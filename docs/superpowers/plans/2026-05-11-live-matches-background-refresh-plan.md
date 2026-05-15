# Live Matches Background Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep already-rendered live matches visible during polling, visibility refresh, and language refresh, while still showing the loading screen for the very first empty-state fetch.

**Architecture:** Introduce a tiny loading-policy helper that defines when the homepage may enter or render the full-screen matches loading state, then wire `src/app/page.tsx` to use that helper for both fetch startup and rendering. Keep `/api/matches` and translation keys unchanged; the change stays entirely in homepage state management and a focused unit test.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest

---

## File Map

- Create: `src/lib/live-matches-loading.ts`
  - Holds the tiny loading-policy helpers used by the homepage.
- Create: `src/lib/live-matches-loading.test.ts`
  - Unit tests for initial-load vs background-refresh behavior.
- Modify: `src/app/page.tsx`
  - Applies the helper to fetch startup and loading/empty rendering.

### Task 1: Add Focused Loading Policy Tests

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\live-matches-loading.test.ts`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\live-matches-loading.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  shouldStartMatchesLoading,
  shouldShowMatchesLoading,
} from "@/lib/live-matches-loading";

describe("live matches loading policy", () => {
  it("starts full-screen loading only when there are no matches yet", () => {
    expect(shouldStartMatchesLoading(0)).toBe(true);
    expect(shouldStartMatchesLoading(3)).toBe(false);
  });

  it("renders the loading screen only for the initial empty-state fetch", () => {
    expect(shouldShowMatchesLoading(true, 0)).toBe(true);
    expect(shouldShowMatchesLoading(true, 4)).toBe(false);
    expect(shouldShowMatchesLoading(false, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runTestsByPath src/lib/live-matches-loading.test.ts
```

Expected:

```text
FAIL src/lib/live-matches-loading.test.ts
Cannot find module '@/lib/live-matches-loading'
```

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/live-matches-loading.ts`:

```ts
export function shouldStartMatchesLoading(existingMatchCount: number): boolean {
  return existingMatchCount === 0;
}

export function shouldShowMatchesLoading(
  isLoading: boolean,
  matchCount: number
): boolean {
  return isLoading && matchCount === 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runTestsByPath src/lib/live-matches-loading.test.ts
```

Expected:

```text
PASS src/lib/live-matches-loading.test.ts
Tests: 2 passed, 2 total
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-matches-loading.ts src/lib/live-matches-loading.test.ts
git commit -m "test: cover live matches loading policy"
```

### Task 2: Apply the Policy to Homepage Fetch Startup

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\live-matches-loading.ts`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\live-matches-loading.test.ts`

- [ ] **Step 1: Import the loading helper into the homepage**

Add near the existing imports in `src/app/page.tsx`:

```ts
import {
  shouldShowMatchesLoading,
  shouldStartMatchesLoading,
} from "@/lib/live-matches-loading";
```

- [ ] **Step 2: Replace the inline initial-load decision**

Update the language-change fetch startup inside the homepage effect from:

```ts
const startFetch = async () => {
  const seq = ++requestSeq;
  return loadMatches(language, matches.length === 0, () => isMounted && seq === requestSeq);
};
```

to:

```ts
const startFetch = async () => {
  const seq = ++requestSeq;
  const isInitialFetch = shouldStartMatchesLoading(matches.length);
  return loadMatches(language, isInitialFetch, () => isMounted && seq === requestSeq);
};
```

- [ ] **Step 3: Keep `loadMatches()` scoped to initial full-screen loading only**

Preserve the existing `setIsLoading(true)` branch, but keep it gated by the `isInitial` flag only:

```ts
const loadMatches = async (
  currentLang: string,
  isInitial: boolean = false,
  canSetState?: () => boolean
) => {
  if (isInitial) {
    if (!canSetState || canSetState()) {
      setIsLoading(true);
    }
  }

  try {
    const data = await fetchLiveMatches(currentLang);
    if (!canSetState || canSetState()) {
      if (data.length > 0) {
        setMatchesIfChanged(prev => {
          if (prev.length === 0) return data;
          const dataMap = new Map(data.map((m: Match) => [String(m.id), m]));
          const merged: Match[] = [];

          for (const pm of prev) {
            const fresh = dataMap.get(String(pm.id));
            if (!fresh) {
              merged.push(pm);
              continue;
            }

            dataMap.delete(String(pm.id));

            if (
              pm.marketData &&
              fresh.marketData &&
              pm.marketData.realTotalPool > fresh.marketData.realTotalPool
            ) {
              merged.push({ ...fresh, marketData: pm.marketData, pools: pm.pools });
            } else {
              merged.push(fresh);
            }
          }

          for (const [, m] of dataMap) {
            merged.push(m);
          }

          return merged;
        });
      }
    }
  } finally {
    if (isInitial && (!canSetState || canSetState())) {
      setIsLoading(false);
    }
  }
};
```

- [ ] **Step 4: Run the focused unit test to confirm the helper contract still passes**

Run:

```bash
npm test -- --runTestsByPath src/lib/live-matches-loading.test.ts
```

Expected:

```text
PASS src/lib/live-matches-loading.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/lib/live-matches-loading.ts src/lib/live-matches-loading.test.ts
git commit -m "fix: limit live matches loading to initial fetch"
```

### Task 3: Apply the Policy to Homepage Rendering

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\live-matches-loading.test.ts`

- [ ] **Step 1: Introduce an explicit render boolean before the match grid**

Add near the derived matches state in `src/app/page.tsx`:

```ts
const currentMatch = matches.find(m => m.id === selectedMatchId);

const showMatchesLoading = shouldShowMatchesLoading(isLoading, matches.length);
```

- [ ] **Step 2: Change the match-grid conditional to use the derived boolean**

Update the render block from:

```tsx
{isLoading ? (
  <div className="col-span-full text-center py-32 text-neutral-500 animate-pulse">
    <div className="h-12 w-12 mx-auto mb-4 rounded-full border-4 border-primary-purple/30 border-t-primary-purple animate-spin" />
    <p className="text-lg font-medium text-neutral-400">{t('status.loading')}</p>
  </div>
) : paginatedGroupedMatches.length === 0 ? (
```

to:

```tsx
{showMatchesLoading ? (
  <div className="col-span-full text-center py-32 text-neutral-500 animate-pulse">
    <div className="h-12 w-12 mx-auto mb-4 rounded-full border-4 border-primary-purple/30 border-t-primary-purple animate-spin" />
    <p className="text-lg font-medium text-neutral-400">{t("status.loading")}</p>
  </div>
) : paginatedGroupedMatches.length === 0 ? (
```

- [ ] **Step 3: Re-run the focused test to confirm the render policy still matches the spec**

Run:

```bash
npm test -- --runTestsByPath src/lib/live-matches-loading.test.ts
```

Expected:

```text
PASS src/lib/live-matches-loading.test.ts
```

- [ ] **Step 4: Run linter/TypeScript diagnostics on the edited files**

Check diagnostics for:

```text
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/app/page.tsx
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/lib/live-matches-loading.ts
file:///c:/Users/USER/Documents/trae_projects/GAMBLE/src/lib/live-matches-loading.test.ts
```

Expected:

```text
No new diagnostics introduced by the loading-state change.
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/lib/live-matches-loading.ts src/lib/live-matches-loading.test.ts
git commit -m "fix: keep visible live matches during background refresh"
```

### Task 4: Manual Regression Verification

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\page.tsx`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\live-matches-loading.test.ts`

- [ ] **Step 1: Start the app**

Run:

```bash
npm run dev
```

Expected:

```text
Ready on http://localhost:3000
```

- [ ] **Step 2: Verify first empty-screen load still shows loading**

Manual check:

```text
Open the homepage in a fresh tab or hard-refresh the page.
Confirm the loading spinner and translated status.loading text appear before the first match payload renders.
```

- [ ] **Step 3: Verify background refresh does not cover visible matches**

Manual check:

```text
Leave the homepage open until the 15-second polling cycle runs.
Confirm visible match cards stay on screen and the full loading state does not replace them.
```

- [ ] **Step 4: Verify language switching keeps visible matches on screen**

Manual check:

```text
Switch between at least two languages after matches are already visible.
Confirm the list remains rendered while text updates and fresh localized match data arrives.
```

- [ ] **Step 5: Commit final verified state**

```bash
git add src/app/page.tsx src/lib/live-matches-loading.ts src/lib/live-matches-loading.test.ts
git commit -m "test: verify live matches background refresh behavior"
```
