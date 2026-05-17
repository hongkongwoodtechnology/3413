# Stale Match Refresh Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a styled in-page stale-match toast with a `立即刷新` action for the two homepage bet flows when `/api/bets` returns the closed-match error.

**Architecture:** Keep the change local to the two homepage entry files and a tiny presentational toast component. Extend page tests first, verify the stale-match error path fails correctly, then add the toast UI and wire the refresh action to each page's existing match reload path.

**Tech Stack:** Next.js App Router pages, React, TypeScript, Testing Library, Jest

---

## File Map

- Create: `src/components/ui/stale-match-toast.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/[locale]/page.test.tsx`
- Reference: `docs/superpowers/specs/2026-05-17-stale-match-refresh-toast-design.md`

### Task 1: Add failing homepage tests for the stale-match toast

**Files:**
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Add a test helper that makes `/api/bets` reject with the stale-match message**

```ts
function mockClosedMatchBetFailure() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/bets")) {
      return makeJsonResponse({ error: "賽事已結束，無法投注。" }, false);
    }

    return makeJsonResponse({ success: true });
  }) as jest.Mock;
}
```

- [ ] **Step 2: Add a failing default-home test for toast rendering**

```ts
it("shows a stale-match toast when /api/bets rejects a closed match", async () => {
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  mockedSkipChainProgress = true;
  (fetchLiveMatches as jest.Mock).mockResolvedValue(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  mockClosedMatchBetFailure();
  window.alert = jest.fn();

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "btn.confirm" }));

  await waitFor(() => {
    expect(screen.getByText("賽事已結束")).toBeInTheDocument();
  });

  expect(screen.getByText("請刷新頁面後再試")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "立即刷新" })).toBeInTheDocument();
  expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining("賽事已結束"));
});
```

- [ ] **Step 3: Add a failing default-home test for refresh action**

```ts
it("refreshes matches and closes the stale-match toast after clicking 立即刷新", async () => {
  mockedConnected = true;
  mockedPublicKey = { toBase58: () => "wallet-111" };
  mockedSkipChainProgress = true;
  (fetchLiveMatches as jest.Mock)
    .mockResolvedValueOnce(MATCH_FIXTURE)
    .mockResolvedValueOnce(MATCH_FIXTURE);
  (getUSDTBalance as jest.Mock).mockResolvedValue(100);
  (getTrialUSDTBalance as jest.Mock).mockResolvedValue(15);
  mockClosedMatchBetFailure();

  render(<Home />);

  await waitFor(() => {
    expect(screen.getByText("Alpha FC")).toBeInTheDocument();
  });

  fireEvent.click(screen.getAllByRole("button", { name: /1\.5/ })[0]);
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "btn.confirm" }));

  const refreshButton = await screen.findByRole("button", { name: "立即刷新" });
  fireEvent.click(refreshButton);

  await waitFor(() => {
    expect(fetchLiveMatches).toHaveBeenCalledTimes(2);
  });

  await waitFor(() => {
    expect(screen.queryByText("賽事已結束")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Mirror the same two failing tests in `src/app/[locale]/page.test.tsx`**

```ts
it("shows a stale-match toast when /api/bets rejects a closed match", async () => {
  // same setup pattern as default page test
});

it("refreshes matches and closes the stale-match toast after clicking 立即刷新", async () => {
  // same setup pattern as default page test
});
```

- [ ] **Step 5: Run the two page test files to verify failure**

Run: `npm test -- --runTestsByPath src/app/page.test.tsx src/app/[locale]/page.test.tsx --runInBand`
Expected: FAIL because the toast UI and refresh action do not exist yet

### Task 2: Build the focused toast component

**Files:**
- Create: `src/components/ui/stale-match-toast.tsx`
- Test: `src/app/page.test.tsx`
- Test: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Create the presentational toast component**

```tsx
type StaleMatchToastProps = {
  open: boolean;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onClose: () => void;
};

export function StaleMatchToast({
  open,
  isRefreshing = false,
  onRefresh,
  onClose,
}: StaleMatchToastProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[80] flex justify-center sm:inset-x-auto sm:right-4 sm:bottom-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-slate-950/88 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.7)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">賽事已結束</p>
            <p className="mt-1 text-sm text-slate-300">請刷新頁面後再試</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? "刷新中..." : "立即刷新"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-white/12 px-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export it as a small focused UI unit**

```tsx
export default StaleMatchToast;
```

- [ ] **Step 3: Do not add a global provider or external dependency**

```text
Keep the component stateless except for the props above.
```

### Task 3: Wire the toast into `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/ui/stale-match-toast.tsx`
- Test: `src/app/page.test.tsx`

- [ ] **Step 1: Add stale-match toast state near other page state**

```tsx
const [showStaleMatchToast, setShowStaleMatchToast] = useState(false);
const [isRefreshingMatches, setIsRefreshingMatches] = useState(false);
```

- [ ] **Step 2: Extract or reuse the existing match reload function**

```tsx
const reloadMatches = useCallback(async () => {
  setIsRefreshingMatches(true);
  try {
    const liveMatches = await fetchLiveMatches(language);
    setMatches(liveMatches);
    setShowStaleMatchToast(false);
  } finally {
    setIsRefreshingMatches(false);
  }
}, [language]);
```

- [ ] **Step 3: Route the specific backend error into toast state**

```tsx
if (error.message?.includes("賽事已結束，無法投注。")) {
  setShowStaleMatchToast(true);
  setTxStatus("idle");
  return;
}
```

- [ ] **Step 4: Keep the existing alert path for all other errors**

```tsx
alert(errorMessage);
setTxStatus("idle");
```

- [ ] **Step 5: Render the toast near the root page layout**

```tsx
<StaleMatchToast
  open={showStaleMatchToast}
  isRefreshing={isRefreshingMatches}
  onRefresh={reloadMatches}
  onClose={() => setShowStaleMatchToast(false)}
/>
```

- [ ] **Step 6: Run `src/app/page.test.tsx`**

Run: `npm test -- --runTestsByPath src/app/page.test.tsx --runInBand`
Expected: PASS

### Task 4: Wire the toast into `src/app/[locale]/page.tsx`

**Files:**
- Modify: `src/app/[locale]/page.tsx`
- Create: `src/components/ui/stale-match-toast.tsx`
- Test: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Add the same toast state**

```tsx
const [showStaleMatchToast, setShowStaleMatchToast] = useState(false);
const [isRefreshingMatches, setIsRefreshingMatches] = useState(false);
```

- [ ] **Step 2: Reuse the localized page's existing match reload path**

```tsx
const reloadMatches = useCallback(async () => {
  setIsRefreshingMatches(true);
  try {
    const liveMatches = await fetchLiveMatches(language);
    setMatches(liveMatches);
    setShowStaleMatchToast(false);
  } finally {
    setIsRefreshingMatches(false);
  }
}, [language]);
```

- [ ] **Step 3: Branch the closed-match error to toast**

```tsx
if (error.message?.includes("賽事已結束，無法投注。")) {
  setShowStaleMatchToast(true);
  setTxStatus("idle");
  return;
}
```

- [ ] **Step 4: Render the same shared toast component**

```tsx
<StaleMatchToast
  open={showStaleMatchToast}
  isRefreshing={isRefreshingMatches}
  onRefresh={reloadMatches}
  onClose={() => setShowStaleMatchToast(false)}
/>
```

- [ ] **Step 5: Run `src/app/[locale]/page.test.tsx`**

Run: `npm test -- --runTestsByPath src/app/[locale]/page.test.tsx --runInBand`
Expected: PASS

### Task 5: Final verification

**Files:**
- Create: `src/components/ui/stale-match-toast.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Run both targeted page test files together**

Run: `npm test -- --runTestsByPath src/app/page.test.tsx src/app/[locale]/page.test.tsx --runInBand`
Expected: PASS

- [ ] **Step 2: Check diagnostics for all edited files**

Run tool: `GetDiagnostics` for:
- `src/components/ui/stale-match-toast.tsx`
- `src/app/page.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/page.test.tsx`
- `src/app/[locale]/page.test.tsx`

Expected: no new diagnostics introduced by the toast change

- [ ] **Step 3: Summarize the shipped behavior**

```text
Closed-match bet failures now show a styled floating stale-match toast with a direct refresh action on both homepage variants, while other error handling stays unchanged.
```
