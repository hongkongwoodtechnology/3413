# World Cup Seed Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local World Cup 2026 seed fallback so `/api/matches` returns World Cup fixtures when the upstream feed currently resolves to zero World Cup matches.

**Architecture:** Keep `/api/matches` as the only frontend match source, but move the fallback decision into a small helper module so the seed loading, duplicate protection, and malformed-entry filtering can be tested without depending on the full LiveScore route. The route continues to prefer live data and only appends seed fixtures after its existing pipeline produces zero `worldcup` matches.

**Tech Stack:** Next.js route handlers, TypeScript, Jest with `ts-jest`, Node `fs` / `path`

---

## File Map

- Create: `data/worldcup_schedule_2026.json`
  - Static World Cup 2026 seed fixtures used only as a fallback source.
- Create: `src/lib/worldcup-seed.ts`
  - Reads the seed file, validates seed entries, transforms them into frontend-compatible match objects, and injects them only when no World Cup matches exist.
- Create: `src/lib/worldcup-seed.test.ts`
  - Covers no-live-data injection, existing-live-data bypass, malformed entry skipping, and category preservation.
- Modify: `src/lib/types.ts`
  - Expands `Match.id` and `Match.category` so the seed fallback remains type-safe in frontend consumers.
- Modify: `src/app/api/matches/route.ts`
  - Calls the helper immediately before returning `validMatches`.

### Task 1: Add the World Cup seed helper with tests

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\worldcup-seed.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\types.ts`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\worldcup-seed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */

import fs from 'fs';
import { applyWorldCupSeedFallback } from './worldcup-seed';

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    readFileSync: jest.fn(),
  },
}));

describe('applyWorldCupSeedFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injects seed fixtures when no worldcup matches exist', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      {
        id: 'wc-2026-group-a-001',
        home: 'Mexico',
        away: 'Japan',
        league: 'World Cup 2026',
        category: 'worldcup',
        date: '2026-06-11 20:00',
        timestamp: 1781131200000,
        status: 'upcoming',
        score: '',
      },
    ]));

    const result = applyWorldCupSeedFallback([
      {
        id: 101,
        league: 'Premier League',
        category: 'england',
        home: 'Arsenal',
        away: 'Chelsea',
        date: '2026-05-20 20:00',
        timestamp: 1779307200000,
        pools: { home: 0, draw: 0, away: 0 },
        status: 'upcoming',
        score: null,
      } as any,
    ]);

    expect(result.some(match => match.category === 'worldcup')).toBe(true);
    expect(result.find(match => String(match.id) === 'wc-2026-group-a-001')?.home).toBe('Mexico');
  });

  it('does not inject seed fixtures when live worldcup matches already exist', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      {
        id: 'wc-2026-group-a-001',
        home: 'Mexico',
        away: 'Japan',
        league: 'World Cup 2026',
        category: 'worldcup',
        date: '2026-06-11 20:00',
        timestamp: 1781131200000,
        status: 'upcoming',
        score: '',
      },
    ]));

    const result = applyWorldCupSeedFallback([
      {
        id: 202,
        league: 'World Cup Qualifiers',
        category: 'worldcup',
        home: 'Brazil',
        away: 'Argentina',
        date: '2026-06-01 20:00',
        timestamp: 1780344000000,
        pools: { home: 0, draw: 0, away: 0 },
        status: 'upcoming',
        score: null,
      } as any,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].home).toBe('Brazil');
  });

  it('skips malformed seed entries and keeps valid worldcup entries', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      {
        id: 'wc-2026-group-a-001',
        home: 'Mexico',
        away: 'Japan',
        league: 'World Cup 2026',
        category: 'worldcup',
        date: '2026-06-11 20:00',
        timestamp: 1781131200000,
        status: 'upcoming',
        score: '',
      },
      {
        id: 'broken-record',
        home: 'Broken Only',
      },
    ]));

    const result = applyWorldCupSeedFallback([]);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('worldcup');
    expect(result[0].away).toBe('Japan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/worldcup-seed.test.ts --runInBand
```

Expected: FAIL with `Cannot find module './worldcup-seed'` or `applyWorldCupSeedFallback is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/types.ts
export interface MatchPools {
  home: number;
  draw: number;
  away: number;
}

export interface Match {
  id: string | number;
  league: string;
  category: 'worldcup' | 'all' | 'europe' | 'england' | 'asia' | 'americas' | 'others';
  home: string;
  away: string;
  homeOriginal?: string;
  awayOriginal?: string;
  leagueOriginal?: string;
  homeLogo?: string;
  awayLogo?: string;
  date: string;
  timestamp?: number;
  liveMinute?: number;
  pools: MatchPools;
  status: 'upcoming' | 'live' | 'finished';
  score: string | null;
}

// src/lib/worldcup-seed.ts
import fs from 'fs';
import path from 'path';
import type { Match } from '@/lib/types';

type MatchLike = Match;

type WorldCupSeedEntry = {
  id: string;
  home: string;
  away: string;
  league: string;
  category: 'worldcup';
  date: string;
  timestamp: number;
  status: 'upcoming' | 'live' | 'finished';
  score: string;
  homeLogo?: string;
  awayLogo?: string;
};

const WORLD_CUP_SEED_PATH = path.join(process.cwd(), 'data', 'worldcup_schedule_2026.json');

function isValidSeedEntry(value: unknown): value is WorldCupSeedEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' &&
    typeof entry.home === 'string' &&
    typeof entry.away === 'string' &&
    typeof entry.league === 'string' &&
    entry.category === 'worldcup' &&
    typeof entry.date === 'string' &&
    typeof entry.timestamp === 'number' &&
    (entry.status === 'upcoming' || entry.status === 'live' || entry.status === 'finished') &&
    typeof entry.score === 'string';
}

export function loadWorldCupSeed(): MatchLike[] {
  try {
    const raw = fs.readFileSync(WORLD_CUP_SEED_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidSeedEntry)
      .map((entry) => ({
        id: entry.id,
        league: entry.league,
        category: 'worldcup',
        home: entry.home,
        away: entry.away,
        date: entry.date,
        timestamp: entry.timestamp,
        pools: { home: 0, draw: 0, away: 0 },
        status: entry.status,
        score: entry.score || null,
        homeLogo: entry.homeLogo || '',
        awayLogo: entry.awayLogo || '',
      }));
  } catch {
    return [];
  }
}

export function applyWorldCupSeedFallback<T extends MatchLike>(matches: T[]): T[] | MatchLike[] {
  const hasWorldCupMatch = matches.some((match) => match.category === 'worldcup');
  if (hasWorldCupMatch) return matches;

  const seedMatches = loadWorldCupSeed();
  if (seedMatches.length === 0) return matches;

  return [...matches, ...seedMatches];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/lib/worldcup-seed.test.ts --runInBand
```

Expected: PASS with `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/worldcup-seed.ts src/lib/worldcup-seed.test.ts
git commit -m "feat: add world cup seed fallback helper"
```

### Task 2: Add the seed data file

**Files:**
- Create: `c:\Users\USER\Documents\trae_projects\GAMBLE\data\worldcup_schedule_2026.json`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\worldcup-seed.test.ts`

- [ ] **Step 1: Write the failing test data expectation**

Add this test to `src/lib/worldcup-seed.test.ts`:

```ts
  it('preserves worldcup category and reserved ids from the real seed file', () => {
    jest.unmock('fs');
    const { loadWorldCupSeed } = require('./worldcup-seed');

    const result = loadWorldCupSeed();

    expect(result.length).toBeGreaterThan(0);
    expect(String(result[0].id).startsWith('wc-2026-')).toBe(true);
    expect(result.every((match: any) => match.category === 'worldcup')).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/worldcup-seed.test.ts --runInBand
```

Expected: FAIL because `data/worldcup_schedule_2026.json` does not exist yet or returns an empty seed list.

- [ ] **Step 3: Write minimal implementation**

Create `data/worldcup_schedule_2026.json` with an initial seed set like:

```json
[
  {
    "id": "wc-2026-group-a-001",
    "home": "Mexico",
    "away": "Japan",
    "league": "World Cup 2026",
    "category": "worldcup",
    "date": "2026-06-11 20:00",
    "timestamp": 1781131200000,
    "status": "upcoming",
    "score": ""
  },
  {
    "id": "wc-2026-group-b-002",
    "home": "Spain",
    "away": "Morocco",
    "league": "World Cup 2026",
    "category": "worldcup",
    "date": "2026-06-12 20:00",
    "timestamp": 1781217600000,
    "status": "upcoming",
    "score": ""
  },
  {
    "id": "wc-2026-group-c-003",
    "home": "Brazil",
    "away": "Serbia",
    "league": "World Cup 2026",
    "category": "worldcup",
    "date": "2026-06-13 20:00",
    "timestamp": 1781304000000,
    "status": "upcoming",
    "score": ""
  }
]
```

Use the real tournament schedule for the full file during implementation, but keep the same shape and reserved id strategy for every entry.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/lib/worldcup-seed.test.ts --runInBand
```

Expected: PASS and the new test confirms the seed file loads and all entries stay in `worldcup`.

- [ ] **Step 5: Commit**

```bash
git add data/worldcup_schedule_2026.json src/lib/worldcup-seed.test.ts
git commit -m "feat: add world cup seed schedule data"
```

### Task 3: Integrate the helper into `/api/matches`

**Files:**
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\matches\route.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\worldcup-seed.ts`
- Modify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\types.ts`
- Test: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\worldcup-seed.test.ts`

- [ ] **Step 1: Write the failing integration-oriented test**

Add this test to `src/lib/worldcup-seed.test.ts`:

```ts
  it('appends seed fixtures after non-worldcup matches without disturbing existing order', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([
      {
        id: 'wc-2026-group-a-001',
        home: 'Mexico',
        away: 'Japan',
        league: 'World Cup 2026',
        category: 'worldcup',
        date: '2026-06-11 20:00',
        timestamp: 1781131200000,
        status: 'upcoming',
        score: '',
      },
    ]));

    const result = applyWorldCupSeedFallback([
      {
        id: 999,
        league: 'Premier League',
        category: 'england',
        home: 'Arsenal',
        away: 'Chelsea',
        date: '2026-05-20 20:00',
        timestamp: 1779307200000,
        pools: { home: 0, draw: 0, away: 0 },
        status: 'upcoming',
        score: null,
      } as any,
    ]);

    expect(result[0].id).toBe(999);
    expect(String(result[1].id)).toBe('wc-2026-group-a-001');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/worldcup-seed.test.ts --runInBand
```

Expected: FAIL if the helper mutates order or replaces the original matches.

- [ ] **Step 3: Write minimal route integration**

At the top of `src/app/api/matches/route.ts`, add:

```ts
import { applyWorldCupSeedFallback } from '@/lib/worldcup-seed';
```

Near the final success return, replace:

```ts
    return NextResponse.json(validMatches);
```

with:

```ts
    const responseMatches = applyWorldCupSeedFallback(validMatches as any[]);
    return NextResponse.json(responseMatches);
```

Then remove the temporary `as any[]` by aligning the route-local match shape with `Match` from `src/lib/types.ts` or by declaring the helper to accept the exact route output shape. Do not keep a permanent `any` cast in the final code.

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```bash
npm test -- src/lib/worldcup-seed.test.ts --runInBand
```

Expected: PASS with the helper still proving:

- no injection when live worldcup matches exist
- injection when none exist
- malformed seed entries are skipped
- appended order is preserved

- [ ] **Step 5: Commit**

```bash
git add src/app/api/matches/route.ts src/lib/types.ts src/lib/worldcup-seed.ts src/lib/worldcup-seed.test.ts
git commit -m "feat: wire world cup seed fallback into matches api"
```

### Task 4: Final verification and handoff

**Files:**
- Verify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\app\api\matches\route.ts`
- Verify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\types.ts`
- Verify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\worldcup-seed.ts`
- Verify: `c:\Users\USER\Documents\trae_projects\GAMBLE\data\worldcup_schedule_2026.json`
- Verify: `c:\Users\USER\Documents\trae_projects\GAMBLE\src\lib\worldcup-seed.test.ts`

- [ ] **Step 1: Run the full targeted test set**

Run:

```bash
npm test -- src/lib/worldcup-seed.test.ts src/app/api/bets/route.test.ts --runInBand
```

Expected: PASS and no regressions from the new helper module.

- [ ] **Step 2: Run lint or diagnostics on touched files**

Run:

```bash
npm run lint -- src/app/api/matches/route.ts src/lib/types.ts src/lib/worldcup-seed.ts src/lib/worldcup-seed.test.ts
```

Expected: No new lint or TypeScript issues in the touched files.

- [ ] **Step 3: Manual product verification**

Check this behavior in the app:

```text
1. Open the homepage.
2. Click the World Cup category.
3. Confirm seed fixtures appear when the live feed has no worldcup matches.
4. Confirm non-worldcup categories are unchanged.
5. Confirm seed-only fixtures do not imply a ready betting market unless a real market exists.
```

- [ ] **Step 4: Commit**

```bash
git add data/worldcup_schedule_2026.json src/app/api/matches/route.ts src/lib/types.ts src/lib/worldcup-seed.ts src/lib/worldcup-seed.test.ts
git commit -m "test: verify world cup seed fallback flow"
```

## Self-Review

### Spec coverage

- Fallback source is local JSON: covered in Task 2.
- `/api/matches` stays the single source: covered in Task 3.
- Inject only when zero `worldcup` matches exist: covered in Task 1 and Task 3.
- Skip malformed entries and fail soft: covered in Task 1.
- Keep frontend consumers type-safe for string seed ids and `worldcup` category: covered in Task 1 and Task 3 via `src/lib/types.ts`.
- Preserve current frontend behavior and ordering: covered in Task 3 and Task 4.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes exact files, exact commands, and concrete code snippets.
- The only intentional open content is the full tournament schedule population, but the required JSON shape and id strategy are fixed and explicit.

### Type consistency

- `applyWorldCupSeedFallback()` is the only integration function name used throughout the plan.
- The helper consistently returns frontend-compatible match objects with `category = 'worldcup'`.
- `Match.id` is widened to `string | number` before the route integration lands.
- Seed entry keys remain `id`, `home`, `away`, `league`, `category`, `date`, `timestamp`, `status`, and `score` across tests and implementation.
