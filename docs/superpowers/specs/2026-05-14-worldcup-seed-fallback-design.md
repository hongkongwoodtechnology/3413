# World Cup Seed Fallback Design

## Summary

This spec defines a controlled fallback for the World Cup category so that users do not see an empty screen when they click the World Cup section and the upstream live matches feed does not currently return World Cup fixtures.

The chosen approach is:

- keep `/api/matches` as the single source of frontend match data
- add a local JSON seed file for World Cup 2026 fixtures
- inject the seed data only when the API result contains no World Cup matches

This is intentionally a fallback design, not a replacement for the live feed.

## Problem

The homepage already exposes a dedicated `worldcup` category, but the current data flow depends on the upstream match feed returning World Cup fixtures at the right time.

When that does not happen:

- users can click the World Cup category
- the category renders successfully
- but the match list is empty

This creates a product bug because the user expects the World Cup section to contain scheduled matches, not a blank result caused by feed timing or cache gaps.

## Confirmed Product Decision

- Use a fallback seed rather than changing the frontend to a separate World Cup request flow.
- Store the fallback source as a local JSON file in the project.
- Keep live feed data as the preferred source whenever it is available.
- Use the local JSON only when the resolved `/api/matches` payload has no World Cup fixtures.
- Limit the first version to World Cup 2026 fixtures only.

## Approaches Considered

### Recommended: local JSON fallback injected by `/api/matches`

Keep the existing frontend behavior and add a controlled fallback inside the matches API.

Why this is recommended:

- smallest user-facing change
- preserves one match-loading pipeline
- avoids frontend branching or duplicated requests
- isolates the fallback to the exact empty-category failure mode

### Alternative: embed the schedule directly in the route file

This would be faster to type but is not recommended because:

- it mixes content data with server logic
- it is harder to maintain or update
- it makes the route file even larger

### Alternative: always merge live feed and seed data

Rejected because:

- it increases the chance of duplicate fixtures
- it creates source-of-truth ambiguity once live World Cup data becomes available
- the request only needs a fallback, not a permanent merge strategy

## Affected Area

Primary backend area:

- `src/app/api/matches/route.ts`

New data artifact:

- `data/worldcup_schedule_2026.json`

Behavioral area affected:

- homepage match categories that rely on `/api/matches`
- especially the `worldcup` category and its league grouping

## Design

### 1. Data source shape

Add a dedicated local JSON seed file for World Cup 2026 fixtures.

The seed should contain only the minimum fields needed to create frontend-compatible match records:

- `id`
- `home`
- `away`
- `timestamp`
- `league`
- `category`
- `status`
- `score`
- optional stage metadata such as `group` or `round`

Requirements:

- `category` is always `worldcup`
- `league` uses a stable World Cup label
- `id` uses a reserved seed prefix such as `wc-2026-...` so it cannot collide with upstream numeric event ids

### 2. Injection point

The fallback is applied inside `/api/matches` after the normal upstream fetch, translation, league mapping, market merge, and filtering pipeline has produced its final candidate match list.

The route then checks whether the resulting payload contains any World Cup match:

- if yes, do nothing
- if no, transform the local JSON seed into the same match object shape and append those records

This keeps the frontend fully unaware of the fallback source.

### 3. Source priority

Source priority is strict:

1. live feed result
2. local World Cup seed fallback

The seed must never override an existing live World Cup match.

This ensures that once the live provider starts returning World Cup fixtures, the API naturally goes back to live data without requiring a frontend change.

### 4. Match object compatibility

Injected seed matches should match the existing `Match` response contract closely enough that all current frontend behavior keeps working:

- category filters
- search
- league grouping
- time sorting
- time-range filters

Seed matches should use safe defaults for fields that do not exist yet:

- `status`: `upcoming`
- `score`: empty string
- `marketData`: omitted or empty-safe, depending on current route conventions
- logos: optional and empty by default

### 5. Betting behavior

This design is for display continuity first.

If a seed-only World Cup match does not yet have a corresponding market entry, existing order-placement protections must continue to prevent invalid betting flows from treating a display-only fallback match as a fully initialized market.

This means the fallback does not create or simulate markets on its own.

## Data Flow

### Normal case

1. `/api/matches` fetches and resolves upstream feed data.
2. The route builds the final match list.
3. If at least one World Cup match exists, the response is returned unchanged.

### Fallback case

1. `/api/matches` fetches and resolves upstream feed data.
2. The route builds the final match list.
3. The route detects that no `worldcup` matches are present.
4. The route loads `data/worldcup_schedule_2026.json`.
5. The seed fixtures are transformed into the normal response shape.
6. The transformed fixtures are appended to the response.

## Error Handling

- If the local JSON file cannot be read or parsed, the API should fail soft and continue returning the original non-World Cup result rather than crashing the entire matches endpoint.
- If a seed record is malformed, the route should skip that record rather than rejecting the full response.
- If the route already has live World Cup fixtures, seed loading should not run.

## Edge Cases

### Duplicate protection

The seed is injected only when the final resolved result has zero World Cup fixtures.

This avoids:

- double rendering of the same tournament
- mixed live and seed versions of the same fixture
- confusing counts in category badges and league groups

### Time behavior

Seed fixture timestamps must be stored in a format that can be converted into the same timestamp value used by the current frontend sorting and time filters.

This ensures the fallback fixtures automatically participate in:

- earliest-first sorting
- live / 1day / 3days / 7days / all filters

### Future expansion

The first version is intentionally limited to World Cup 2026.

If future tournaments also need seeded fallbacks, each tournament should get its own clearly named data source rather than growing one mixed fallback file with unrelated competitions.

## Testing

Recommended focused coverage:

- verify that `/api/matches` injects World Cup seed fixtures when the resolved payload contains no World Cup matches
- verify that `/api/matches` does not inject seed fixtures when live World Cup matches already exist
- verify malformed seed entries are skipped safely
- verify seed matches preserve `category = worldcup`

Manual verification:

- open the homepage
- click the World Cup category
- confirm the category no longer renders empty when the feed lacks World Cup fixtures
- confirm the same page still prefers live World Cup data once it becomes available

## Scope

In scope:

- add one World Cup seed JSON file
- add API fallback logic in `/api/matches`
- preserve current frontend category behavior

Out of scope:

- creating betting markets automatically from the seed file
- redesigning the homepage category UI
- replacing the live feed as the primary source
- adding seed fallbacks for every competition
