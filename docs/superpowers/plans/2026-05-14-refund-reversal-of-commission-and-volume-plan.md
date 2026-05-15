# Refund Reversal Of Commission And Volume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically reverse referral commission and referral volume for all refunded bets, including historical refunded bets that were already recorded incorrectly.

**Architecture:** Extend the referral commission ledger with explicit refund-reversal events, run a conservative reconciliation pass inside `src/app/api/referral/route.ts`, and keep totals net by summing positive and negative ledger entries. Preserve existing refund classification flows in bets/matches APIs and keep the reversal logic centralized in the referral API so future refunds and historical repairs use the same idempotent path.

**Tech Stack:** Next.js App Router, TypeScript, Jest, file-based JSON persistence

---

## File Map

- Modify: `src/app/api/referral/route.ts`
  - Extend commission types with reversal metadata.
  - Add helper functions for refund-reversal reconciliation.
  - Run reconciliation before serving referral reads and mutations.
  - Ensure totals and aggregates work with negative reversal records.
- Modify: `src/app/api/referral/route.test.ts`
  - Add focused tests for reversal creation, idempotency, and aggregate/stat updates.
- Optional read-only context: `src/app/api/bets/route.ts`
  - No behavior change planned.
- Optional read-only context: `src/app/api/matches/route.ts`
  - No behavior change planned.

### Task 1: Extend Referral Ledger Types For Reversal Events

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Write the failing type-and-shape test**

Add this test to `src/app/api/referral/route.test.ts`:

```ts
    it('returns a refund reversal history item with explicit metadata', async () => {
        const db = {
            referrer111: {
                stats: {
                    total: '0.000000 USDT',
                    withdrawable: '0.000000 USDT',
                    month: '0.000000 USDT',
                    friends: 1,
                },
                commissions: [
                    {
                        id: 'comm-positive',
                        referee: 'bettor111',
                        betAmount: '0.020000',
                        fee: '0.001600',
                        support: '0.001120',
                        commission: '0.000480',
                        timestamp: '2026-05-12T19:21:33.574Z',
                        status: 'settled',
                        signature: 'sig-positive',
                    },
                    {
                        id: 'comm-reversal',
                        referee: 'bettor111',
                        betAmount: '-0.020000',
                        fee: '-0.001600',
                        support: '-0.001120',
                        commission: '-0.000480',
                        timestamp: '2026-05-12T20:21:33.574Z',
                        status: 'settled',
                        signature: 'sig-positive',
                        kind: 'refund_reversal',
                        refundOfCommissionId: 'comm-positive',
                    },
                ],
                referees: [
                    {
                        id: 'ref-1',
                        address: 'bettor111',
                        joinDateValue: 0,
                        totalVolumeValue: 0,
                        earnedCommissionValue: 0,
                        rewardIssued: false,
                    },
                ],
                balances: { usdt: 0, bonus: 0 },
                commissionRate: 0.3,
            },
        };

        mockReadFileSync.mockReturnValue(JSON.stringify(db));

        const { GET } = await import('./route');
        const response = await GET(new Request('http://localhost/api/referral?address=referrer111'));
        const payload = await response.json();

        expect(payload.data.commissions[1].kind).toBe('refund_reversal');
        expect(payload.data.commissions[1].refundOfCommissionId).toBe('comm-positive');
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts
```

Expected:

```text
FAIL src/app/api/referral/route.test.ts
Expected: "refund_reversal"
Received: undefined
```

- [ ] **Step 3: Add the minimal ledger type extensions**

Update the `Commission` interface in `src/app/api/referral/route.ts` to:

```ts
interface Commission {
    id: string;
    referee: string;
    betAmount: string;
    fee: string;
    support?: string;
    commission: string;
    timestamp: string;
    status: 'settled' | 'pending';
    signature?: string;
    kind?: 'bet_commission' | 'refund_reversal';
    refundOfCommissionId?: string;
}
```

When creating positive commission entries in the `place_bet` path, add:

```ts
                        kind: 'bet_commission' as const,
```

to both positive ledger object literals.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/referral/route.ts src/app/api/referral/route.test.ts
git commit -m "test: add referral refund reversal ledger metadata"
```

### Task 2: Add Refund Reconciliation And Aggregate Reversal

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Write the failing refund-reversal test**

Add this test to `src/app/api/referral/route.test.ts`:

```ts
    it('auto-reverses commission and volume for refunded bets during GET', async () => {
        const referralDb = {
            referrer111: {
                stats: {
                    total: '0.000000 USDT',
                    withdrawable: '0.000000 USDT',
                    month: '0.000000 USDT',
                    friends: 1,
                },
                commissions: [
                    {
                        id: 'comm-positive',
                        referee: 'bettor111',
                        betAmount: '0.020000',
                        fee: '0.001600',
                        support: '0.001120',
                        commission: '0.000480',
                        timestamp: '2026-05-12T19:21:33.574Z',
                        status: 'settled',
                        signature: 'sig-positive',
                        kind: 'bet_commission',
                    },
                ],
                referees: [
                    {
                        id: 'ref-1',
                        address: 'bettor111',
                        joinDateValue: 0,
                        totalVolumeValue: 0.02,
                        earnedCommissionValue: 0.00048,
                        rewardIssued: false,
                    },
                ],
                balances: { usdt: 0, bonus: 0 },
                commissionRate: 0.3,
            },
        };

        const betsDb = {
            bettor111: [
                {
                    id: 'bet-1',
                    userAddress: 'bettor111',
                    matchId: 99,
                    matchName: 'A vs B',
                    outcome: 'home',
                    amount: 0.02,
                    signature: 'sig-positive',
                    status: 'refunded',
                    useBonus: false,
                    timestamp: 1715541693574,
                },
            ],
        };

        mockReadFileSync.mockImplementation((filePath: string) => {
            if (String(filePath).includes('referral_db.json')) {
                return JSON.stringify(referralDb);
            }
            if (String(filePath).includes('bets_db.json')) {
                return JSON.stringify(betsDb);
            }
            return '{}';
        });

        const { GET } = await import('./route');
        const response = await GET(new Request('http://localhost/api/referral?address=referrer111'));
        const payload = await response.json();

        expect(payload.data.stats.total).toBe('0.000000 USDT');
        expect(payload.data.stats.withdrawable).toBe('0.000000 USDT');
        expect(payload.data.referees[0].earnedCommissionValue).toBe(0);
        expect(payload.data.referees[0].totalVolumeValue).toBe(0);
        expect(payload.data.commissions[0].kind).toBe('refund_reversal');
        expect(payload.data.commissions[0].commission).toBe('-0.000480');
        expect(payload.data.commissions[0].refundOfCommissionId).toBe('comm-positive');
        expect(mockWriteFileSync).toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts
```

Expected:

```text
FAIL src/app/api/referral/route.test.ts
Expected: "-0.000480"
Received: "0.000480"
```

- [ ] **Step 3: Implement minimal reconciliation helpers**

Add these helper types and functions in `src/app/api/referral/route.ts` near the existing database helpers:

```ts
type BetsDbRecord = Record<string, Array<{
    id: string;
    userAddress: string;
    matchId: number;
    amount: number;
    signature?: string | null;
    status?: string;
    useBonus?: boolean;
    timestamp?: number;
}>>;

function loadBetsDatabase(): BetsDbRecord {
    const betsPath = path.join(process.cwd(), 'data', 'bets_db.json');
    try {
        if (fs.existsSync(betsPath)) {
            return JSON.parse(fs.readFileSync(betsPath, 'utf-8'));
        }
    } catch (error) {
        console.error('Error loading bets database for referral reconciliation:', error);
    }
    return {};
}

function clampNonNegative(value: number): number {
    return value < 0 ? 0 : value;
}
```

Then add the reconciliation function:

```ts
function reconcileRefundReversals(db: Record<string, UserData>): boolean {
    const betsDb = loadBetsDatabase();
    let modified = false;

    for (const [, bets] of Object.entries(betsDb)) {
        for (const bet of bets) {
            if (bet.status !== 'refunded' || bet.useBonus || !bet.signature) continue;

            for (const userData of Object.values(db)) {
                const positive = userData.commissions.find((commission) =>
                    commission.signature === bet.signature &&
                    commission.referee === bet.userAddress &&
                    (commission.kind ?? 'bet_commission') !== 'refund_reversal'
                );

                if (!positive) continue;

                const alreadyReversed = userData.commissions.some((commission) =>
                    commission.kind === 'refund_reversal' &&
                    commission.refundOfCommissionId === positive.id
                );

                if (alreadyReversed) continue;

                const positiveBetAmount = Number(positive.betAmount);
                const positiveCommission = Number(positive.commission);
                const positiveFee = Number(positive.fee);
                const positiveSupport = Number(positive.support || '0');

                userData.commissions.unshift({
                    id: `comm-reversal-${positive.id}`,
                    referee: positive.referee,
                    betAmount: (-positiveBetAmount).toFixed(6),
                    fee: (-positiveFee).toFixed(6),
                    support: (-positiveSupport).toFixed(6),
                    commission: (-positiveCommission).toFixed(6),
                    timestamp: new Date().toISOString(),
                    status: 'settled',
                    signature: positive.signature,
                    kind: 'refund_reversal',
                    refundOfCommissionId: positive.id,
                });

                const referee = userData.referees.find((item) => item.address === positive.referee);
                if (referee) {
                    referee.totalVolumeValue = clampNonNegative(referee.totalVolumeValue - positiveBetAmount);
                    referee.earnedCommissionValue = clampNonNegative(referee.earnedCommissionValue - positiveCommission);
                }

                modified = true;
            }
        }
    }

    return modified;
}
```

Finally, call it in both `GET` and `POST` after `const db = loadDatabase();`:

```ts
        const refundReversalModified = reconcileRefundReversals(db);
        if (refundReversalModified) {
            saveDatabase(db);
        }
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/referral/route.ts src/app/api/referral/route.test.ts
git commit -m "fix: reverse refunded referral commission and volume"
```

### Task 3: Prove Reconciliation Is Idempotent

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Write the failing idempotency test**

Add this test to `src/app/api/referral/route.test.ts`:

```ts
    it('does not create duplicate refund reversals when GET runs twice', async () => {
        const referralDb = {
            referrer111: {
                stats: {
                    total: '0.000000 USDT',
                    withdrawable: '0.000000 USDT',
                    month: '0.000000 USDT',
                    friends: 1,
                },
                commissions: [
                    {
                        id: 'comm-positive',
                        referee: 'bettor111',
                        betAmount: '0.020000',
                        fee: '0.001600',
                        support: '0.001120',
                        commission: '0.000480',
                        timestamp: '2026-05-12T19:21:33.574Z',
                        status: 'settled',
                        signature: 'sig-positive',
                        kind: 'bet_commission',
                    },
                ],
                referees: [
                    {
                        id: 'ref-1',
                        address: 'bettor111',
                        joinDateValue: 0,
                        totalVolumeValue: 0.02,
                        earnedCommissionValue: 0.00048,
                        rewardIssued: false,
                    },
                ],
                balances: { usdt: 0, bonus: 0 },
                commissionRate: 0.3,
            },
        };

        const betsDb = {
            bettor111: [
                {
                    id: 'bet-1',
                    userAddress: 'bettor111',
                    matchId: 99,
                    amount: 0.02,
                    signature: 'sig-positive',
                    status: 'refunded',
                    useBonus: false,
                    timestamp: 1715541693574,
                },
            ],
        };

        let storedReferralDb = JSON.stringify(referralDb);

        mockReadFileSync.mockImplementation((filePath: string) => {
            if (String(filePath).includes('referral_db.json')) {
                return storedReferralDb;
            }
            if (String(filePath).includes('bets_db.json')) {
                return JSON.stringify(betsDb);
            }
            return '{}';
        });

        mockWriteFileSync.mockImplementation((_filePath: string, data: string) => {
            storedReferralDb = data;
        });

        const { GET } = await import('./route');

        await GET(new Request('http://localhost/api/referral?address=referrer111'));
        const secondResponse = await GET(new Request('http://localhost/api/referral?address=referrer111'));
        const secondPayload = await secondResponse.json();

        const reversalEntries = secondPayload.data.commissions.filter(
            (commission: any) => commission.kind === 'refund_reversal'
        );

        expect(reversalEntries).toHaveLength(1);
        expect(secondPayload.data.referees[0].earnedCommissionValue).toBe(0);
        expect(secondPayload.data.referees[0].totalVolumeValue).toBe(0);
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts
```

Expected:

```text
FAIL src/app/api/referral/route.test.ts
Expected length: 1
Received length: 2
```

- [ ] **Step 3: Tighten the reversal detection if needed**

Ensure the reconciliation guard in `src/app/api/referral/route.ts` remains exactly this:

```ts
                const alreadyReversed = userData.commissions.some((commission) =>
                    commission.kind === 'refund_reversal' &&
                    commission.refundOfCommissionId === positive.id
                );
```

Do not add fallback duplication heuristics in this step. Use the linked positive-record ID only.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/referral/route.test.ts src/app/api/referral/route.ts
git commit -m "test: verify refund reversal reconciliation is idempotent"
```

### Task 4: Verify Net Referral Totals After Reversal

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\referral\route.test.ts`

- [ ] **Step 1: Add the failing net-stats test**

Add this test to `src/app/api/referral/route.test.ts`:

```ts
    it('keeps only net positive commission in stats after a refund reversal', async () => {
        const referralDb = {
            referrer111: {
                stats: {
                    total: '0.000000 USDT',
                    withdrawable: '0.000000 USDT',
                    month: '0.000000 USDT',
                    friends: 1,
                },
                commissions: [
                    {
                        id: 'comm-kept',
                        referee: 'bettor222',
                        betAmount: '0.050000',
                        fee: '0.004000',
                        support: '0.002800',
                        commission: '0.001200',
                        timestamp: '2026-05-13T19:21:33.574Z',
                        status: 'settled',
                        signature: 'sig-kept',
                        kind: 'bet_commission',
                    },
                    {
                        id: 'comm-positive',
                        referee: 'bettor111',
                        betAmount: '0.020000',
                        fee: '0.001600',
                        support: '0.001120',
                        commission: '0.000480',
                        timestamp: '2026-05-12T19:21:33.574Z',
                        status: 'settled',
                        signature: 'sig-positive',
                        kind: 'bet_commission',
                    },
                ],
                referees: [
                    {
                        id: 'ref-1',
                        address: 'bettor111',
                        joinDateValue: 0,
                        totalVolumeValue: 0.02,
                        earnedCommissionValue: 0.00048,
                        rewardIssued: false,
                    },
                    {
                        id: 'ref-2',
                        address: 'bettor222',
                        joinDateValue: 0,
                        totalVolumeValue: 0.05,
                        earnedCommissionValue: 0.0012,
                        rewardIssued: false,
                    },
                ],
                balances: { usdt: 0, bonus: 0 },
                commissionRate: 0.3,
            },
        };

        const betsDb = {
            bettor111: [
                {
                    id: 'bet-1',
                    userAddress: 'bettor111',
                    matchId: 99,
                    amount: 0.02,
                    signature: 'sig-positive',
                    status: 'refunded',
                    useBonus: false,
                    timestamp: 1715541693574,
                },
            ],
        };

        mockReadFileSync.mockImplementation((filePath: string) => {
            if (String(filePath).includes('referral_db.json')) {
                return JSON.stringify(referralDb);
            }
            if (String(filePath).includes('bets_db.json')) {
                return JSON.stringify(betsDb);
            }
            return '{}';
        });

        const { GET } = await import('./route');
        const response = await GET(new Request('http://localhost/api/referral?address=referrer111'));
        const payload = await response.json();

        expect(payload.data.stats.total).toBe('0.001200 USDT');
        expect(payload.data.stats.month).toBe('0.001200 USDT');
        expect(payload.data.stats.withdrawable).toBe('0.001000 USDT');
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts
```

Expected:

```text
FAIL src/app/api/referral/route.test.ts
Expected: "0.001200 USDT"
Received: "0.001680 USDT"
```

- [ ] **Step 3: Keep totals based on signed commission values**

Ensure the total-building logic in `src/app/api/referral/route.ts` keeps this behavior:

```ts
    for (const commission of userData.commissions) {
        if (commission.status !== 'settled') continue;

        const commissionRaw = parseUsdtToRaw(commission.commission);
        if (commission.referee === 'WITHDRAWAL') {
            withdrawnRaw += commissionRaw < ZERO ? -commissionRaw : commissionRaw;
            continue;
        }

        if (commissionRaw <= ZERO) continue;
        totalEarnedRaw += commissionRaw;
```

Replace that block with signed accounting:

```ts
    for (const commission of userData.commissions) {
        if (commission.status !== 'settled') continue;

        const commissionRaw = parseUsdtToRaw(commission.commission);
        if (commission.referee === 'WITHDRAWAL') {
            withdrawnRaw += commissionRaw < ZERO ? -commissionRaw : commissionRaw;
            continue;
        }

        totalEarnedRaw += commissionRaw;

        const ts = Date.parse(commission.timestamp);
        if (!Number.isNaN(ts) && ts >= monthStart) {
            monthEarnedRaw += commissionRaw;
        }
    }

    if (totalEarnedRaw < ZERO) totalEarnedRaw = ZERO;
    if (monthEarnedRaw < ZERO) monthEarnedRaw = ZERO;
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
```

- [ ] **Step 5: Run the full focused suite and commit**

Run:

```bash
npx jest --runInBand src/app/api/referral/route.test.ts src/lib/wallets.test.ts src/components/ReferralHandler.test.tsx
```

Expected:

```text
PASS src/app/api/referral/route.test.ts
PASS src/lib/wallets.test.ts
PASS src/components/ReferralHandler.test.tsx
```

Then commit:

```bash
git add src/app/api/referral/route.ts src/app/api/referral/route.test.ts
git commit -m "fix: net refunded referral commission and volume"
```

## Self-Review

- Spec coverage check:
  - Negative reversal records: covered in Tasks 1 and 2.
  - Reverse referee commission and volume: covered in Task 2.
  - Historical auto-repair: covered in Task 2.
  - Idempotency: covered in Task 3.
  - Net stats after reversal: covered in Task 4.
- Placeholder scan:
  - No `TODO`, `TBD`, or vague implementation steps remain.
- Type consistency:
  - Reversal event naming is consistently `refund_reversal`.
  - Link field naming is consistently `refundOfCommissionId`.
