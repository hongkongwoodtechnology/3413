# 三向盤風控監督器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有 `home / draw / away` 市場上加入可持久化的三向盤風控監督器，覆蓋賽前與賽中，並把風控結果接到下注 API、live 刷新流程與後台。

**Architecture:** 先把風控核心做成純 TypeScript 函式，確保門檻、負債、集中度、單注衝擊與 live freeze 都能被單元測試覆蓋。再把這些結果持久化到 `market_db.json` 與 `risk_alerts.json`，讓 `POST /api/bets` 做 pre-trade 檢查、`/api/matches` 做 feed-driven refresh，最後由新的 admin route 對後台輸出風控摘要與告警清單。

**Tech Stack:** Next.js Route Handlers、TypeScript、Jest、檔案型 JSON DB、React 19、現有 `DynamicOddsEngine`

---

## 檔案分工

- Create: `src/lib/risk-supervisor.ts`
  - 純函式風控核心，包含 phase、ratio、risk level、order impact、action 決策
- Create: `src/lib/risk-supervisor.test.ts`
  - 驗證門檻分類、單注衝擊與 phase 判斷
- Create: `src/lib/risk-alerts.ts`
  - `risk_alerts.json` 的讀寫、去重、升級與恢復
- Create: `src/lib/risk-alerts.test.ts`
  - 驗證 dedupe、escalation、recovery 行為
- Create: `src/lib/risk-refresh.ts`
  - 把 live feed 狀態轉成 freeze / alert / riskState 更新
- Create: `src/lib/risk-refresh.test.ts`
  - 驗證 goal、red card、VAR、feed delay 的 freeze 規則
- Create: `src/app/api/admin/risk/route.ts`
  - 對後台輸出風控 summary、top liability 與 alerts
- Create: `src/app/api/admin/risk/route.test.ts`
  - 驗證 admin risk route 回傳格式與統計結果
- Modify: `src/lib/marketDb.ts`
  - 擴充 `MarketDataInfo`，保存 `riskState` 與 `lastLiveSnapshot`
- Modify: `src/app/api/bets/route.ts`
  - 在接受下注前執行風控決策，拒絕或限注危險訂單，並限制體驗金不可超過賭池 `15%`
- Modify: `src/app/api/bets/route.test.ts`
  - 覆蓋 `limit_stake`、`suspend_outcome` 與體驗金上限的 API 行為
- Modify: `src/app/api/matches/route.ts`
  - 每次 live feed 更新時刷新 `riskState`，產生 freeze 與 alert
- Modify: `src/components/admin/AdminDashboard.tsx`
  - 新增風控 summary cards、top liability 清單與 recent alerts

## 先做的設計決策

- 這次不實作獨立 Python 服務；把 spec 裡的 supervisor 概念落到現有 TypeScript 後端，避免雙語言同步成本。
- `warning -> reprice` 在 v1 先以持久化狀態與後台提示落地，不在 `POST /api/bets` 強制回 `409` 重報價。
- 體驗金上限使用 `下注前 total_pool * 0.15`，且只對 `useBonus = true` 的單場累計 bonus stake 生效。
- `POST /api/bets` 在 v1 只硬性攔截：
  - `limit_stake`
  - `suspend_outcome`
  - `suspend_match`
  - `risk_trial_funds_cap`
- live freeze 先掛在現有 `/api/matches` feed refresh 流程，不新增獨立 cron。

### Task 1: 建立純函式風控核心

**Files:**
- Create: `src/lib/risk-supervisor.ts`
- Test: `src/lib/risk-supervisor.test.ts`

- [ ] **Step 1: 先寫失敗中的核心單元測試**

```ts
import {
  DEFAULT_RISK_CONFIG,
  buildRiskSnapshot,
  evaluateRiskSnapshot,
  getMarketPhase,
  simulateBetImpact,
} from './risk-supervisor';

describe('risk supervisor core', () => {
  it('classifies a zero-sided market as zero-sided', () => {
    expect(
      getMarketPhase({
        pools: { home: 0, draw: 0, away: 0 },
        status: 'upcoming',
      })
    ).toBe('zero-sided');
  });

  it('escalates to danger when liability ratio crosses 2.2', () => {
    const snapshot = buildRiskSnapshot({
      matchId: '101',
      status: 'upcoming',
      pools: { home: 100, draw: 50, away: 50 },
      liabilities: { home: 460, draw: 120, away: 90 },
    });

    const result = evaluateRiskSnapshot(snapshot, DEFAULT_RISK_CONFIG);

    expect(result.maxLiabilityOutcome).toBe('home');
    expect(result.maxLiabilityRatio).toBeCloseTo(2.3, 6);
    expect(result.riskLevel).toBe('danger');
    expect(result.action).toBe('limit_stake');
  });

  it('projects a critical post-bet state when one order breaks the 2.8 ratio', () => {
    const snapshot = buildRiskSnapshot({
      matchId: '101',
      status: 'upcoming',
      pools: { home: 100, draw: 80, away: 70 },
      liabilities: { home: 150, draw: 120, away: 140 },
    });

    const result = simulateBetImpact(
      snapshot,
      { outcome: 'home', stake: 40, quoteOdds: 15 },
      DEFAULT_RISK_CONFIG
    );

    expect(result.postRiskLevel).toBe('critical');
    expect(result.action).toBe('suspend_outcome');
  });
});
```

- [ ] **Step 2: 跑測試確認目前會失敗**

Run:

```bash
npm test -- --runInBand src/lib/risk-supervisor.test.ts
```

Expected:

```text
FAIL src/lib/risk-supervisor.test.ts
Cannot find module './risk-supervisor'
```

- [ ] **Step 3: 寫最小可用實作**

```ts
export type RiskOutcome = 'home' | 'draw' | 'away';
export type MarketStatus = 'upcoming' | 'live' | 'finished' | 'suspended';
export type MarketPhase = 'zero-sided' | 'single-sided' | 'multi-sided-pre' | 'multi-sided-live';
export type RiskLevel = 'normal' | 'warning' | 'danger' | 'critical';
export type RiskAction = 'none' | 'reprice' | 'limit_stake' | 'suspend_outcome' | 'suspend_match';

export type RiskThresholdConfig = {
  warningLiabilityRatio: number;
  dangerLiabilityRatio: number;
  criticalLiabilityRatio: number;
  warningPoolShare: number;
  dangerPoolShare: number;
  criticalPoolShare: number;
};

export type RiskSnapshotInput = {
  matchId: string;
  status: MarketStatus;
  pools: Record<RiskOutcome, number>;
  liabilities: Record<RiskOutcome, number>;
  eventFreezeFlag?: boolean;
  dataDelayFlag?: boolean;
};

export const DEFAULT_RISK_CONFIG: RiskThresholdConfig = {
  warningLiabilityRatio: 1.8,
  dangerLiabilityRatio: 2.2,
  criticalLiabilityRatio: 2.8,
  warningPoolShare: 0.6,
  dangerPoolShare: 0.75,
  criticalPoolShare: 0.85,
};

const OUTCOMES: RiskOutcome[] = ['home', 'draw', 'away'];
const RISK_RANK: Record<RiskLevel, number> = {
  normal: 1,
  warning: 2,
  danger: 3,
  critical: 4,
};

export function getMarketPhase(input: Pick<RiskSnapshotInput, 'pools' | 'status'>): MarketPhase {
  const activeOutcomeCount = OUTCOMES.filter((key) => (input.pools[key] || 0) > 0).length;
  if (activeOutcomeCount === 0) return 'zero-sided';
  if (activeOutcomeCount === 1) return 'single-sided';
  return input.status === 'live' ? 'multi-sided-live' : 'multi-sided-pre';
}

export function buildRiskSnapshot(input: RiskSnapshotInput) {
  const totalPool = OUTCOMES.reduce((sum, key) => sum + (input.pools[key] || 0), 0);
  const maxLiabilityOutcome = OUTCOMES.reduce((best, key) =>
    (input.liabilities[key] || 0) > (input.liabilities[best] || 0) ? key : best
  , 'home' as RiskOutcome);
  const maxLiability = input.liabilities[maxLiabilityOutcome] || 0;
  const maxPoolShare = totalPool === 0 ? 0 : Math.max(...OUTCOMES.map((key) => (input.pools[key] || 0) / totalPool));

  return {
    ...input,
    phase: getMarketPhase(input),
    totalPool,
    maxLiabilityOutcome,
    maxLiability,
    maxLiabilityRatio: totalPool === 0 ? 0 : maxLiability / totalPool,
    maxPoolShare,
  };
}

export function classifyRiskLevel(value: number, warning: number, danger: number, critical: number): RiskLevel {
  if (value >= critical) return 'critical';
  if (value >= danger) return 'danger';
  if (value >= warning) return 'warning';
  return 'normal';
}

export function mergeRiskLevels(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

export function evaluateRiskSnapshot(snapshot: ReturnType<typeof buildRiskSnapshot>, config: RiskThresholdConfig) {
  const liabilityLevel = classifyRiskLevel(
    snapshot.maxLiabilityRatio,
    config.warningLiabilityRatio,
    config.dangerLiabilityRatio,
    config.criticalLiabilityRatio
  );
  const poolShareLevel = classifyRiskLevel(
    snapshot.maxPoolShare,
    config.warningPoolShare,
    config.dangerPoolShare,
    config.criticalPoolShare
  );
  const riskLevel = mergeRiskLevels(liabilityLevel, poolShareLevel);
  const action: RiskAction =
    snapshot.eventFreezeFlag || snapshot.dataDelayFlag ? 'suspend_match' :
    riskLevel === 'critical' ? 'suspend_outcome' :
    riskLevel === 'danger' ? 'limit_stake' :
    riskLevel === 'warning' ? 'reprice' :
    'none';

  return {
    ...snapshot,
    liabilityLevel,
    poolShareLevel,
    riskLevel,
    action,
  };
}

export function simulateBetImpact(
  snapshot: ReturnType<typeof buildRiskSnapshot>,
  order: { outcome: RiskOutcome; stake: number; quoteOdds: number },
  config: RiskThresholdConfig
) {
  const nextLiabilities = { ...snapshot.liabilities };
  nextLiabilities[order.outcome] += order.stake * order.quoteOdds;
  const nextPools = { ...snapshot.pools, [order.outcome]: snapshot.pools[order.outcome] + order.stake };
  const nextSnapshot = buildRiskSnapshot({
    matchId: snapshot.matchId,
    status: snapshot.status,
    pools: nextPools,
    liabilities: nextLiabilities,
    eventFreezeFlag: snapshot.eventFreezeFlag,
    dataDelayFlag: snapshot.dataDelayFlag,
  });
  const evaluation = evaluateRiskSnapshot(nextSnapshot, config);

  return {
    postSnapshot: nextSnapshot,
    postRiskLevel: evaluation.riskLevel,
    action: evaluation.action,
  };
}
```

- [ ] **Step 4: 重跑核心測試**

Run:

```bash
npm test -- --runInBand src/lib/risk-supervisor.test.ts
```

Expected:

```text
PASS src/lib/risk-supervisor.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/risk-supervisor.ts src/lib/risk-supervisor.test.ts
git commit -m "feat: add three-way risk supervisor core"
```

### Task 2: 加入風控狀態與告警持久化

**Files:**
- Create: `src/lib/risk-alerts.ts`
- Test: `src/lib/risk-alerts.test.ts`
- Modify: `src/lib/marketDb.ts`

- [ ] **Step 1: 先寫失敗中的告警去重/升級測試**

```ts
import {
  buildAlert,
  mergeAlert,
  shouldAutoResolveAlert,
} from './risk-alerts';

describe('risk alerts store helpers', () => {
  it('reuses the same dedupe key and escalates severity', () => {
    const current = buildAlert({
      matchId: '101',
      alertType: 'liability_warning',
      alertLevel: 'warning',
      triggerOutcome: 'home',
      currentAction: 'reprice',
    });

    const next = mergeAlert(current, {
      alertLevel: 'danger',
      currentAction: 'limit_stake',
      maxLiabilityRatio: 2.4,
    });

    expect(next.alertLevel).toBe('danger');
    expect(next.currentAction).toBe('limit_stake');
    expect(next.dedupeKey).toBe('101:liability_warning:home');
  });

  it('resolves warning alerts only after 60 seconds below threshold', () => {
    expect(
      shouldAutoResolveAlert(
        { alertLevel: 'warning', belowThresholdSince: 1_000 },
        61_001
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run:

```bash
npm test -- --runInBand src/lib/risk-alerts.test.ts
```

Expected:

```text
FAIL src/lib/risk-alerts.test.ts
Cannot find module './risk-alerts'
```

- [ ] **Step 3: 擴充 `marketDb` 型別並實作 alert store**

```ts
// src/lib/marketDb.ts
export type MarketRiskState = {
  phase?: 'zero-sided' | 'single-sided' | 'multi-sided-pre' | 'multi-sided-live';
  eventFreezeFlag?: boolean;
  dataDelayFlag?: boolean;
  freezeReason?: string | null;
  frozenUntil?: number | null;
  maxLiabilityOutcome?: 'home' | 'draw' | 'away' | null;
  maxLiabilityRatio?: number;
  maxPoolShare?: number;
  liabilityLevel?: 'normal' | 'warning' | 'danger' | 'critical';
  poolShareLevel?: 'normal' | 'warning' | 'danger' | 'critical';
  riskLevel?: 'normal' | 'warning' | 'danger' | 'critical';
  action?: 'none' | 'reprice' | 'limit_stake' | 'suspend_outcome' | 'suspend_match';
  updatedAt?: number;
};

export type LastLiveSnapshot = {
  status?: string;
  score?: string | null;
  liveMinute?: number;
  updatedAt?: number;
};

export type MarketDataInfo = {
  realTotalPool: number;
  liabilities: { home: number; draw: number; away: number };
  pools?: { home: number; draw: number; away: number };
  attractionWindowUsed?: { home: number; draw: number; away: number };
  initialOdds?: { home: number; draw: number; away: number };
  seedBankroll?: number;
  refundProcessed?: boolean;
  settled?: boolean;
  finalWinner?: string;
  finalScore?: string;
  adminSurplus?: number;
  riskState?: MarketRiskState;
  lastLiveSnapshot?: LastLiveSnapshot;
};
```

```ts
// src/lib/risk-alerts.ts
import fs from 'fs';
import path from 'path';

export type AlertLevel = 'info' | 'warning' | 'danger' | 'critical';
export type AlertType =
  | 'phase_change'
  | 'liability_warning'
  | 'concentration_warning'
  | 'post_bet_impact'
  | 'live_event_freeze'
  | 'feed_delay'
  | 'data_anomaly'
  | 'auto_suspend'
  | 'manual_resume_required';

export type RiskAlertRecord = {
  alertId: string;
  matchId: string;
  alertType: AlertType;
  alertLevel: AlertLevel;
  triggerOutcome: 'home' | 'draw' | 'away' | 'none';
  currentAction: string;
  dedupeKey: string;
  createdAt: number;
  lastSeenAt: number;
  belowThresholdSince?: number | null;
  resolvedAt?: number | null;
  maxLiabilityRatio?: number;
  maxPoolShare?: number;
};

const ALERT_FILE_PATH = path.join(process.cwd(), 'data', 'risk_alerts.json');
const ALERT_RANK: Record<AlertLevel, number> = { info: 1, warning: 2, danger: 3, critical: 4 };

export function buildAlert(input: {
  matchId: string;
  alertType: AlertType;
  alertLevel: AlertLevel;
  triggerOutcome: 'home' | 'draw' | 'away' | 'none';
  currentAction: string;
  maxLiabilityRatio?: number;
  maxPoolShare?: number;
}) {
  const now = Date.now();
  return {
    alertId: `risk-${now}-${Math.random().toString(36).slice(2, 8)}`,
    matchId: input.matchId,
    alertType: input.alertType,
    alertLevel: input.alertLevel,
    triggerOutcome: input.triggerOutcome,
    currentAction: input.currentAction,
    dedupeKey: `${input.matchId}:${input.alertType}:${input.triggerOutcome}`,
    createdAt: now,
    lastSeenAt: now,
    maxLiabilityRatio: input.maxLiabilityRatio,
    maxPoolShare: input.maxPoolShare,
    resolvedAt: null,
  } satisfies RiskAlertRecord;
}

export function mergeAlert(
  current: RiskAlertRecord,
  next: Partial<Pick<RiskAlertRecord, 'alertLevel' | 'currentAction' | 'maxLiabilityRatio' | 'maxPoolShare'>>
) {
  return {
    ...current,
    alertLevel:
      next.alertLevel && ALERT_RANK[next.alertLevel] > ALERT_RANK[current.alertLevel]
        ? next.alertLevel
        : current.alertLevel,
    currentAction: next.currentAction ?? current.currentAction,
    maxLiabilityRatio: next.maxLiabilityRatio ?? current.maxLiabilityRatio,
    maxPoolShare: next.maxPoolShare ?? current.maxPoolShare,
    lastSeenAt: Date.now(),
    resolvedAt: null,
  };
}

export function shouldAutoResolveAlert(
  alert: Pick<RiskAlertRecord, 'alertLevel' | 'belowThresholdSince'>,
  now: number
) {
  if (!alert.belowThresholdSince) return false;
  const requiredMs =
    alert.alertLevel === 'warning' ? 60_000 :
    alert.alertLevel === 'danger' ? 120_000 :
    alert.alertLevel === 'critical' ? 180_000 :
    0;
  return requiredMs > 0 && now - alert.belowThresholdSince >= requiredMs;
}

export function loadRiskAlerts(): RiskAlertRecord[] {
  if (!fs.existsSync(ALERT_FILE_PATH)) return [];
  return JSON.parse(fs.readFileSync(ALERT_FILE_PATH, 'utf-8'));
}

export function saveRiskAlerts(alerts: RiskAlertRecord[]) {
  fs.writeFileSync(ALERT_FILE_PATH, JSON.stringify(alerts, null, 2), 'utf-8');
}
```

- [ ] **Step 4: 重跑型別與 alert 測試**

Run:

```bash
npm test -- --runInBand src/lib/risk-alerts.test.ts
```

Expected:

```text
PASS src/lib/risk-alerts.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketDb.ts src/lib/risk-alerts.ts src/lib/risk-alerts.test.ts
git commit -m "feat: persist risk state and alert records"
```

### Task 3: 在下注 API 上接入 pre-trade 風控

**Files:**
- Modify: `src/app/api/bets/route.ts`
- Test: `src/app/api/bets/route.test.ts`

- [ ] **Step 1: 先補會失敗的 API 測試**

```ts
it('rejects orders when the simulated post-bet state is critical', async () => {
  (fs.readFileSync as jest.Mock).mockImplementation((file: string) => {
    if (String(file).includes('bets_db.json')) return '{}';
    if (String(file).includes('market_db.json')) {
      return JSON.stringify({
        '303': {
          realTotalPool: 200,
          liabilities: { home: 500, draw: 50, away: 50 },
          pools: { home: 100, draw: 50, away: 50 },
          initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      });
    }
    return '{}';
  });

  const req = new Request('http://localhost/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: 'risk-user',
      matchId: 303,
      matchName: 'Risk vs Spike',
      outcome: 'home',
      amount: 20,
      odds: 15,
      useBonus: false,
    }),
  });

  const res = await POST(req);
  const json = await res.json();

  expect(res.status).toBe(403);
  expect(json.code).toBe('risk_suspend_outcome');
});

it('returns a max stake hint when the order lands in danger', async () => {
  (fs.readFileSync as jest.Mock).mockImplementation((file: string) => {
    if (String(file).includes('bets_db.json')) return '{}';
    if (String(file).includes('market_db.json')) {
      return JSON.stringify({
        '404': {
          realTotalPool: 300,
          liabilities: { home: 420, draw: 120, away: 100 },
          pools: { home: 150, draw: 90, away: 60 },
          initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      });
    }
    return '{}';
  });

  const req = new Request('http://localhost/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: 'risk-user',
      matchId: 404,
      matchName: 'Danger vs Limit',
      outcome: 'home',
      amount: 30,
      odds: 8,
      useBonus: false,
    }),
  });

  const res = await POST(req);
  const json = await res.json();

  expect(res.status).toBe(403);
  expect(json.code).toBe('risk_limit_stake');
  expect(json.maxStake).toBeGreaterThan(0);
});

it('rejects bonus bets that would push trial funds beyond 15% of the pre-bet pool', async () => {
  (fs.readFileSync as jest.Mock).mockImplementation((file: string) => {
    if (String(file).includes('bets_db.json')) {
      return JSON.stringify({
        'bonus-user-a': [
          {
            id: 'bonus-a',
            userAddress: 'bonus-user-a',
            matchId: 505,
            matchName: 'Bonus vs Cap',
            outcome: 'home',
            amount: 10,
            odds: 1.88,
            status: 'pending',
            useBonus: true,
            timestamp: 1,
          },
        ],
      });
    }
    if (String(file).includes('market_db.json')) {
      return JSON.stringify({
        '505': {
          realTotalPool: 100,
          liabilities: { home: 18.8, draw: 0, away: 0 },
          pools: { home: 100, draw: 0, away: 0 },
          initialOdds: { home: 1.88, draw: 3.4, away: 4.7 },
          attractionWindowUsed: { home: 0, draw: 0, away: 0 },
        },
      });
    }
    return '{}';
  });

  const req = new Request('http://localhost/api/bets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: 'bonus-user-b',
      matchId: 505,
      matchName: 'Bonus vs Cap',
      outcome: 'home',
      amount: 6,
      odds: 1.88,
      useBonus: true,
    }),
  });

  const res = await POST(req);
  const json = await res.json();

  expect(res.status).toBe(403);
  expect(json.code).toBe('risk_trial_funds_cap');
  expect(json.remainingBonusStake).toBe(5);
});
```

- [ ] **Step 2: 跑 API 測試確認失敗**

Run:

```bash
npm test -- --runInBand src/app/api/bets/route.test.ts
```

Expected:

```text
FAIL src/app/api/bets/route.test.ts
Expected status 403 but received 200
```

- [ ] **Step 3: 在 `POST /api/bets` 前置接入 supervisor**

```ts
import {
  DEFAULT_RISK_CONFIG,
  buildRiskSnapshot,
  evaluateRiskSnapshot,
  simulateBetImpact,
} from '@/lib/risk-supervisor';

const acceptedBets = Object.values(db)
  .flat()
  .filter((bet) => String(bet.matchId) === key && (bet.status === 'pending' || !bet.status));

const trialFundsUsed = acceptedBets
  .filter((bet) => bet.useBonus)
  .reduce((sum, bet) => sum + (bet.amount || 0), 0);
const trialFundsCap = Number((currentTotalReal * 0.15).toFixed(6));
const trialFundsRemaining = Math.max(0, Number((trialFundsCap - trialFundsUsed).toFixed(6)));

if (useBonus && amount > trialFundsRemaining) {
  return NextResponse.json(
    {
      error: `體驗金超出單場上限，目前最多還可使用 ${trialFundsRemaining.toFixed(4)} USDT。`,
      code: 'risk_trial_funds_cap',
      trialFundsCap,
      trialFundsUsed,
      remainingBonusStake: trialFundsRemaining,
    },
    { status: 403 }
  );
}

const currentSnapshot = buildRiskSnapshot({
  matchId: key,
  status: liveMinute && liveMinute > 0 ? 'live' : 'upcoming',
  pools: currentPools,
  liabilities: currentMarket.liabilities,
  eventFreezeFlag: currentMarket.riskState?.eventFreezeFlag,
  dataDelayFlag: currentMarket.riskState?.dataDelayFlag,
});

const currentRisk = evaluateRiskSnapshot(currentSnapshot, DEFAULT_RISK_CONFIG);
if (currentRisk.action === 'suspend_match') {
  return NextResponse.json(
    { error: '目前賽事因 live 風控暫停受注。', code: 'risk_suspend_match' },
    { status: 403 }
  );
}

const projectedRisk = simulateBetImpact(
  currentSnapshot,
  { outcome: outcomeKey, stake: amount, quoteOdds: lockedOdds },
  DEFAULT_RISK_CONFIG
);

if (projectedRisk.action === 'suspend_outcome') {
  return NextResponse.json(
    { error: '此選項風險過高，暫停受注。', code: 'risk_suspend_outcome' },
    { status: 403 }
  );
}

if (projectedRisk.action === 'limit_stake') {
  const maxStake = Math.max(
    0,
    Number(
      (
        currentSnapshot.totalPool * DEFAULT_RISK_CONFIG.dangerLiabilityRatio -
        currentSnapshot.maxLiability
      ) / Math.max(lockedOdds, 1.01)
    .toFixed(4))
  );

  if (amount > maxStake) {
    return NextResponse.json(
      {
        error: `投注金額超出目前風控上限，請降低到 ${maxStake.toFixed(4)} USDT 以下。`,
        code: 'risk_limit_stake',
        maxStake,
      },
      { status: 403 }
    );
  }
}
```

```ts
const nextSnapshot = buildRiskSnapshot({
  matchId: key,
  status: liveMinute && liveMinute > 0 ? 'live' : 'upcoming',
  pools: {
    ...currentPools,
    [outcomeKey]: (currentPools[outcomeKey] || 0) + amount,
  },
  liabilities: {
    ...currentMarket.liabilities,
    [outcomeKey]: (currentMarket.liabilities?.[outcomeKey] || 0) + amount * lockedOdds,
  },
  eventFreezeFlag: false,
  dataDelayFlag: false,
});

currentMarket.riskState = {
  ...evaluateRiskSnapshot(nextSnapshot, DEFAULT_RISK_CONFIG),
  trialFundsCap,
  trialFundsUsed: useBonus ? trialFundsUsed + amount : trialFundsUsed,
  trialFundsRemaining: useBonus
    ? Math.max(0, Number((trialFundsCap - (trialFundsUsed + amount)).toFixed(6)))
    : trialFundsRemaining,
  updatedAt: Date.now(),
};
```

- [ ] **Step 4: 重跑下注 API 測試**

Run:

```bash
npm test -- --runInBand src/app/api/bets/route.test.ts
```

Expected:

```text
PASS src/app/api/bets/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bets/route.ts src/app/api/bets/route.test.ts
git commit -m "feat: enforce pre-trade risk checks in bets api"
```

### Task 4: 把 live feed 轉成 freeze 與風控刷新

**Files:**
- Create: `src/lib/risk-refresh.ts`
- Test: `src/lib/risk-refresh.test.ts`
- Modify: `src/app/api/matches/route.ts`

- [ ] **Step 1: 先寫會失敗的 live refresh 測試**

```ts
import { reconcileLiveRiskState } from './risk-refresh';

describe('risk refresh from live feed', () => {
  it('freezes the match when score changes', () => {
    const result = reconcileLiveRiskState({
      now: 1_000_000,
      match: { id: 101, status: 'live', score: '1-0', liveMinute: 72 },
      market: {
        realTotalPool: 200,
        liabilities: { home: 240, draw: 80, away: 70 },
        pools: { home: 100, draw: 60, away: 40 },
        lastLiveSnapshot: { status: 'live', score: '0-0', liveMinute: 71, updatedAt: 999_000 },
      },
    });

    expect(result.nextRiskState.eventFreezeFlag).toBe(true);
    expect(result.nextRiskState.freezeReason).toBe('goal');
    expect(result.alerts[0].alertType).toBe('live_event_freeze');
  });

  it('marks data delay when the last live snapshot is stale', () => {
    const result = reconcileLiveRiskState({
      now: 1_000_000,
      match: { id: 101, status: 'live', score: '0-0', liveMinute: 72 },
      market: {
        realTotalPool: 200,
        liabilities: { home: 240, draw: 80, away: 70 },
        pools: { home: 100, draw: 60, away: 40 },
        lastLiveSnapshot: { status: 'live', score: '0-0', liveMinute: 71, updatedAt: 990_000 },
      },
    });

    expect(result.nextRiskState.dataDelayFlag).toBe(true);
    expect(result.nextRiskState.action).toBe('suspend_match');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run:

```bash
npm test -- --runInBand src/lib/risk-refresh.test.ts
```

Expected:

```text
FAIL src/lib/risk-refresh.test.ts
Cannot find module './risk-refresh'
```

- [ ] **Step 3: 寫 live refresh helper，並接到 `/api/matches`**

```ts
// src/lib/risk-refresh.ts
import { buildAlert } from './risk-alerts';
import { DEFAULT_RISK_CONFIG, buildRiskSnapshot, evaluateRiskSnapshot } from './risk-supervisor';

export function reconcileLiveRiskState(params: {
  now: number;
  match: { id: number; status: string; score: string | null; liveMinute?: number };
  market: {
    realTotalPool: number;
    liabilities: { home: number; draw: number; away: number };
    pools?: { home: number; draw: number; away: number };
    lastLiveSnapshot?: { status?: string; score?: string | null; liveMinute?: number; updatedAt?: number };
  };
}) {
  const pools = params.market.pools || { home: 0, draw: 0, away: 0 };
  const previous = params.market.lastLiveSnapshot;
  const scoreChanged = previous?.score && params.match.score && previous.score !== params.match.score;
  const dataDelayFlag = !!previous?.updatedAt && params.now - previous.updatedAt > 8_000;
  const freezeReason = scoreChanged ? 'goal' : dataDelayFlag ? 'feed_delay' : null;

  const snapshot = buildRiskSnapshot({
    matchId: String(params.match.id),
    status: params.match.status === 'live' ? 'live' : 'upcoming',
    pools,
    liabilities: params.market.liabilities,
    eventFreezeFlag: !!freezeReason && freezeReason !== 'feed_delay',
    dataDelayFlag,
  });
  const evaluation = evaluateRiskSnapshot(snapshot, DEFAULT_RISK_CONFIG);

  return {
    nextRiskState: {
      ...evaluation,
      freezeReason,
      frozenUntil: freezeReason === 'goal' ? params.now + 15_000 : dataDelayFlag ? params.now + 8_000 : null,
      updatedAt: params.now,
    },
    nextLiveSnapshot: {
      status: params.match.status,
      score: params.match.score,
      liveMinute: params.match.liveMinute ?? 0,
      updatedAt: params.now,
    },
    alerts: freezeReason
      ? [
          buildAlert({
            matchId: String(params.match.id),
            alertType: freezeReason === 'feed_delay' ? 'feed_delay' : 'live_event_freeze',
            alertLevel: 'critical',
            triggerOutcome: 'none',
            currentAction: 'suspend_match',
          }),
        ]
      : [],
  };
}
```

```ts
// src/app/api/matches/route.ts inside the market refresh loop
const riskRefresh = reconcileLiveRiskState({
  now: Date.now(),
  match: {
    id: matchObj.id,
    status: matchObj.status,
    score: matchObj.score,
    liveMinute: matchObj.liveMinute,
  },
  market: mkt,
});

mkt.riskState = riskRefresh.nextRiskState;
mkt.lastLiveSnapshot = riskRefresh.nextLiveSnapshot;

const existingAlerts = loadRiskAlerts();
saveRiskAlerts([...existingAlerts, ...riskRefresh.alerts]);
```

- [ ] **Step 4: 重跑 live refresh 測試**

Run:

```bash
npm test -- --runInBand src/lib/risk-refresh.test.ts
```

Expected:

```text
PASS src/lib/risk-refresh.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/risk-refresh.ts src/lib/risk-refresh.test.ts src/app/api/matches/route.ts
git commit -m "feat: refresh match risk state from live feed"
```

### Task 5: 輸出 admin risk API 並接到後台

**Files:**
- Create: `src/app/api/admin/risk/route.ts`
- Test: `src/app/api/admin/risk/route.test.ts`
- Modify: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: 先寫失敗中的 admin risk route 測試**

```ts
/**
 * @jest-environment node
 */

import fs from 'fs';
import { GET } from './route';

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn((file: string) => {
      if (String(file).includes('market_db.json')) {
        return JSON.stringify({
          '101': {
            realTotalPool: 200,
            liabilities: { home: 560, draw: 90, away: 70 },
            pools: { home: 140, draw: 40, away: 20 },
            riskState: {
              riskLevel: 'critical',
              action: 'suspend_outcome',
              maxLiabilityOutcome: 'home',
              maxLiabilityRatio: 2.8,
              maxPoolShare: 0.7,
            },
          },
        });
      }
      if (String(file).includes('risk_alerts.json')) {
        return JSON.stringify([
          {
            alertId: 'a1',
            matchId: '101',
            alertType: 'liability_warning',
            alertLevel: 'critical',
            triggerOutcome: 'home',
            currentAction: 'suspend_outcome',
            dedupeKey: '101:liability_warning:home',
            createdAt: 1,
            lastSeenAt: 2,
          },
        ]);
      }
      return '{}';
    }),
  },
}));

describe('admin risk route', () => {
  it('returns summary counts, top liabilities, and recent alerts', async () => {
    const res = await GET();
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.summary.criticalMatches).toBe(1);
    expect(json.data.topLiability[0].matchId).toBe('101');
    expect(json.data.alerts[0].alertLevel).toBe('critical');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run:

```bash
npm test -- --runInBand src/app/api/admin/risk/route.test.ts
```

Expected:

```text
FAIL src/app/api/admin/risk/route.test.ts
Cannot find module './route'
```

- [ ] **Step 3: 實作 admin risk route 與 dashboard 狀態**

```ts
// src/app/api/admin/risk/route.ts
import { NextResponse } from 'next/server';
import { loadMarketDb } from '@/lib/marketDb';
import { loadRiskAlerts } from '@/lib/risk-alerts';

export async function GET() {
  const marketDb = loadMarketDb();
  const alerts = loadRiskAlerts().sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 20);
  const rows = Object.entries(marketDb).map(([matchId, market]) => ({
    matchId,
    action: market.riskState?.action || 'none',
    riskLevel: market.riskState?.riskLevel || 'normal',
    maxLiabilityOutcome: market.riskState?.maxLiabilityOutcome || null,
    maxLiabilityRatio: market.riskState?.maxLiabilityRatio || 0,
    maxPoolShare: market.riskState?.maxPoolShare || 0,
  }));

  const summary = {
    criticalMatches: rows.filter((row) => row.riskLevel === 'critical').length,
    dangerMatches: rows.filter((row) => row.riskLevel === 'danger').length,
    suspendedOutcomes: rows.filter((row) => row.action === 'suspend_outcome').length,
    suspendedMatches: rows.filter((row) => row.action === 'suspend_match').length,
  };

  return NextResponse.json({
    success: true,
    data: {
      summary,
      topLiability: rows.sort((a, b) => b.maxLiabilityRatio - a.maxLiabilityRatio).slice(0, 10),
      alerts,
    },
  });
}
```

```tsx
// src/components/admin/AdminDashboard.tsx
type RiskSummary = {
  criticalMatches: number;
  dangerMatches: number;
  suspendedOutcomes: number;
  suspendedMatches: number;
};

type RiskRow = {
  matchId: string;
  action: string;
  riskLevel: 'normal' | 'warning' | 'danger' | 'critical';
  maxLiabilityOutcome: 'home' | 'draw' | 'away' | null;
  maxLiabilityRatio: number;
  maxPoolShare: number;
};

type RiskAlert = {
  alertId: string;
  matchId: string;
  alertType: string;
  alertLevel: 'info' | 'warning' | 'danger' | 'critical';
  triggerOutcome: string;
  currentAction: string;
  lastSeenAt: number;
};

const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
const [topLiabilityRows, setTopLiabilityRows] = useState<RiskRow[]>([]);
const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);

useEffect(() => {
  const fetchRisk = async () => {
    const res = await fetch('/api/admin/risk');
    const json = await res.json();
    if (json.success) {
      setRiskSummary(json.data.summary);
      setTopLiabilityRows(json.data.topLiability);
      setRiskAlerts(json.data.alerts);
    }
  };
  fetchRisk();
  const interval = setInterval(fetchRisk, 5000);
  return () => clearInterval(interval);
}, []);
```

- [ ] **Step 4: 跑 route 測試，並做一次後台手動 smoke check**

Run:

```bash
npm test -- --runInBand src/app/api/admin/risk/route.test.ts
```

Expected:

```text
PASS src/app/api/admin/risk/route.test.ts
```

Manual smoke check:

```bash
npm run dev
```

Expected in `/admin`:

```text
- 出現 Critical / Danger / Suspended cards
- 出現 Top Liability Ratio 清單
- 出現 Recent Alerts 區塊
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/risk/route.ts src/app/api/admin/risk/route.test.ts src/components/admin/AdminDashboard.tsx
git commit -m "feat: surface risk supervisor data in admin dashboard"
```

### Task 6: 回歸測試、lint 與收尾

**Files:**
- Verify: `src/lib/risk-supervisor.ts`
- Verify: `src/lib/risk-alerts.ts`
- Verify: `src/lib/risk-refresh.ts`
- Verify: `src/app/api/bets/route.ts`
- Verify: `src/app/api/matches/route.ts`
- Verify: `src/app/api/admin/risk/route.ts`
- Verify: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: 跑完整的 targeted test suite**

Run:

```bash
npm test -- --runInBand \
  src/lib/risk-supervisor.test.ts \
  src/lib/risk-alerts.test.ts \
  src/lib/risk-refresh.test.ts \
  src/app/api/bets/route.test.ts \
  src/app/api/admin/risk/route.test.ts
```

Expected:

```text
PASS 5 test suites
```

- [ ] **Step 2: 對修改過的檔案跑 lint**

Run:

```bash
npx eslint \
  src/lib/risk-supervisor.ts \
  src/lib/risk-alerts.ts \
  src/lib/risk-refresh.ts \
  src/app/api/bets/route.ts \
  src/app/api/matches/route.ts \
  src/app/api/admin/risk/route.ts \
  src/components/admin/AdminDashboard.tsx
```

Expected:

```text
0 problems
```

- [ ] **Step 3: 手動驗證 3 個場景**

```text
1. single-sided 市場仍使用 initialOdds，且不被激進風控誤殺
2. 體驗金在單場累計達到 `下注前總池 15%` 後，新 bonus 訂單會回傳 `risk_trial_funds_cap`
3. multi-sided pre-match 市場在高負債下回傳 `risk_limit_stake` / `risk_suspend_outcome`
4. live 比賽比分變動後，market_db.json 出現 freeze 狀態，`/api/admin/risk` 可看到 critical alert
```

- [ ] **Step 4: 最終 commit**

```bash
git add src/lib/risk-supervisor.ts \
  src/lib/risk-supervisor.test.ts \
  src/lib/risk-alerts.ts \
  src/lib/risk-alerts.test.ts \
  src/lib/risk-refresh.ts \
  src/lib/risk-refresh.test.ts \
  src/lib/marketDb.ts \
  src/app/api/bets/route.ts \
  src/app/api/bets/route.test.ts \
  src/app/api/matches/route.ts \
  src/app/api/admin/risk/route.ts \
  src/app/api/admin/risk/route.test.ts \
  src/components/admin/AdminDashboard.tsx
git commit -m "feat: add three-way risk supervisor"
```

## Spec 覆蓋檢查

- `四層觸發順序`：Task 1 + Task 3 + Task 4
- `負債比 / pool share 門檻`：Task 1
- `單注衝擊`：Task 1 + Task 3
- `live freeze / feed delay`：Task 4
- `體驗金 <= 下注前總池 15%`：Task 3
- `後台告警與 summary cards`：Task 2 + Task 5
- `single-sided 保持原行為`：Task 3 + Task 6 手動驗證

## 風險與注意事項

- `src/app/api/matches/route.ts` 檔案很大，Task 4 只把風控同步邏輯抽到 `src/lib/risk-refresh.ts`，不要順手重構其他流程。
- `warning -> reprice` 在 v1 以狀態輸出與後台顯示為主，不要在這輪額外新增複雜的即時 quote API。
- `AdminDashboard.tsx` 已很大，Task 5 只新增 state、polling 與兩塊視覺區，不要展開全面 UI 重整。
