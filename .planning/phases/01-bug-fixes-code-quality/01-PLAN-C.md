---
phase: 01-bug-fixes-code-quality
plan: C
type: execute
wave: 1
depends_on: []
files_modified:
  - app/reports/page.tsx
autonomous: true
requirements:
  - BUG-04
  - BUG-09
  - BUG-13

must_haves:
  truths:
    - "When the DB returns exactly 200 rows, a notice appears telling the manager they are seeing 'most recent 200 reports'"
    - "dateFrom filter compares against local midnight (T00:00:00) not UTC midnight — day boundaries are correct in any timezone"
    - "Floor grouping on the rooms page uses all-but-last-two digits as the floor key (room 1001 → floor 10, room 201 → floor 2)"
    - "The date filter fix does not break the existing dateTo T23:59:59 behaviour"
  artifacts:
    - path: "app/reports/page.tsx"
      provides: "200-cap notice, timezone-correct dateFrom filter, correct floor key extraction"
      contains: "most recent 200"
  key_links:
    - from: "rows.length === 200 check"
      to: "notice element in JSX"
      via: "conditional render near filter panel"
      pattern: "rows\\.length.*200|most recent 200"
    - from: "dateFrom filter comparison"
      to: "T00:00:00 suffix"
      via: "string concat in filter function"
      pattern: "dateFrom.*T00:00:00"
    - from: "floor grouping key"
      to: "slice(0, -2)"
      via: "all-but-last-two digit extraction"
      pattern: "slice.*-2"
---

<objective>
Fix three isolated bugs in `app/reports/page.tsx`: surface the 200-report cap to managers, fix date filter timezone alignment, and fix floor grouping for double-digit floors. All three are self-contained logic changes with no dependencies on other plans.

Purpose: Managers currently see silently truncated data, wrong-day results when filtering across timezone boundaries, and incorrect floor groupings for multi-floor resorts.

Output: Updated `app/reports/page.tsx` with all three fixes.
</objective>

<execution_context>
@C:/Users/watkb/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/watkb/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-bug-fixes-code-quality/01-CONTEXT.md
</context>

<interfaces>
<!-- Key code from app/reports/page.tsx the executor needs before editing: -->

**200-row limit (line 311 in current file):**
```typescript
.limit(200);
// After fetch: setRows(mapped) — no UI notice when exactly 200 rows returned
```

**dateFrom filter (line 75 in current file):**
```typescript
if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
// BUG-09: new Date("2025-01-15") parses as UTC midnight, not local midnight.
// Worker submissions in UTC+3 timezone created on 2025-01-15 local time
// have created_at like "2025-01-14T21:00:00Z" — excluded by UTC comparison.
// Fix: parse dateFrom as local T00:00:00 to match local day boundary.
```

**dateTo filter (line 76 in current file) — already correct, preserve it:**
```typescript
if (dateTo && new Date(r.created_at) > new Date(dateTo + "T23:59:59")) return false;
// This correctly appends T23:59:59 (local). Mirror this for dateFrom.
```

**Floor grouping — NOTE: The reports page does NOT contain floor grouping.**
After reading the codebase, floor grouping lives in `app/rooms/page.tsx`, not reports. BUG-13 targets wherever the grouping logic lives. The executor must check `app/rooms/page.tsx` — if the floor key logic is there, that file must be added to files_modified and edited.
</interfaces>

<tasks>

<task type="auto">
  <name>Task C-1: 200-cap notice and dateFrom timezone fix in reports page</name>
  <files>app/reports/page.tsx</files>
  <read_first>app/reports/page.tsx — read the full file to confirm the exact lines for the limit call, the dateFrom filter, and the JSX filter panel where the notice should appear</read_first>
  <action>
Two changes to `app/reports/page.tsx`:

**Change 1 — BUG-04: Show "most recent 200" notice when limit is hit**

After the existing fetch in `useEffect` sets `setRows(mapped)`, the UI already shows filter counts. Add a conditional notice rendered near the filter controls. The `rows` state already has the fetched data — when `rows.length === 200`, the DB may have more.

In the JSX, inside the `!loading && !err && rows.length > 0` block, add a notice element just above the filter card (before `<div className="card" style={{ marginBottom: 12, padding: 14 }}>...`):

```tsx
{rows.length === 200 && (
  <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
    Showing most recent 200 reports. Use filters to narrow results.
  </p>
)}
```

**Change 2 — BUG-09: Fix dateFrom to parse as local midnight**

In the `filtered` useMemo, the dateFrom comparison (currently line 75) reads:
```typescript
if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
```

Replace with:
```typescript
if (dateFrom && new Date(r.created_at) < new Date(dateFrom + "T00:00:00")) return false;
```

This mirrors the existing `dateTo + "T23:59:59"` pattern already in the file. The `T00:00:00` suffix forces the Date constructor to parse as local time rather than UTC midnight, aligning both filter bounds to the user's local timezone.

Do NOT change the dateTo line — it is already correct.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `app/reports/page.tsx` contains `rows.length === 200` conditional render
    - `app/reports/page.tsx` contains `most recent 200 reports` in a JSX string
    - `app/reports/page.tsx` contains `dateFrom + "T00:00:00"` (not bare `new Date(dateFrom)`)
    - `app/reports/page.tsx` still contains `dateTo + "T23:59:59"` unchanged
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>200-cap notice renders when DB returns exactly 200 rows; dateFrom parses as local midnight matching the existing dateTo pattern</done>
</task>

<task type="auto">
  <name>Task C-2: Fix floor grouping key (BUG-13)</name>
  <files>app/rooms/page.tsx</files>
  <read_first>app/rooms/page.tsx — read the full file to find the floor grouping logic and understand the current key extraction pattern before editing</read_first>
  <action>
BUG-13: Floor grouping uses the wrong key extraction. Current code likely produces the first digit(s) in a way that groups room 1001 as floor "1" instead of floor "10".

The correct algorithm: **all digits except the last two** form the floor key.

Examples:
- Room "1001" → floor key "10" (rooms 1000-1099 are floor 10)
- Room "201" → floor key "2" (rooms 200-299 are floor 2)
- Room "101" → floor key "1"
- Room "1101" → floor key "11"

Find the grouping code in `app/rooms/page.tsx`. It will look something like:
```typescript
const floor = roomNumber.slice(0, -2);  // correct
// OR
const floor = roomNumber[0];            // wrong — only first char
// OR
const floor = roomNumber.slice(0, roomNumber.length - 2);  // also correct
```

Locate the wrong extraction and replace with:
```typescript
const floor = room.number.slice(0, -2);
```

Where `room.number` is the room number string. The exact variable name depends on what the file calls it — adapt accordingly after reading.

If the floor key is used as a group label (e.g., "Floor 10"), the grouping key change is the only edit needed — the label already reads from the key.

Apply the fix in-place without changing anything else in the file. If the file already uses `slice(0, -2)` or an equivalent producing the same result, confirm it is correct and make no changes (note this in the summary).
  </action>
  <verify>
    <automated>grep -n "slice\|floor\|Floor" app/rooms/page.tsx | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `app/rooms/page.tsx` contains `slice(0, -2)` OR an equivalent expression that takes all-but-last-two characters for the floor key
    - `app/rooms/page.tsx` does NOT contain a single-character floor extraction like `[0]` or `charAt(0)` or `slice(0, 1)` used as the floor group key
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Floor grouping correctly uses all-but-last-two digits as the floor key; room 1001 groups to floor "10" not "1"</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Manager browser → Supabase query | Date filter values come from UI date inputs |
| Client-side filter | dateFrom/dateTo comparison runs in browser with local timezone |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01C-01 | Information Disclosure | 200-row cap silently hides older reports | mitigate | UI notice informs manager when cap is hit; no data loss, just visibility (BUG-04) |
| T-01C-02 | Tampering | Date filter timezone mismatch excludes valid records | mitigate | Appending T00:00:00 forces local-time parse, consistent with T23:59:59 on dateTo (BUG-09) |
| T-01C-03 | Information Disclosure | Wrong floor grouping mixes rooms from different floors | mitigate | all-but-last-two digit key correctly groups rooms into their floor (BUG-13) |
</threat_model>

<verification>
1. `grep -n "most recent 200" app/reports/page.tsx` — shows the notice string
2. `grep -n 'dateFrom.*T00:00:00' app/reports/page.tsx` — shows the fix
3. `grep -n 'dateTo.*T23:59:59' app/reports/page.tsx` — still present (unchanged)
4. `grep -n "slice.*-2" app/rooms/page.tsx` — shows floor key extraction
5. `npx tsc --noEmit` — exits 0
</verification>

<success_criteria>
- 200-cap notice rendered in reports page JSX when rows.length === 200
- dateFrom filter parses as local midnight (T00:00:00 suffix)
- Floor grouping uses slice(0, -2) or equivalent
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/phases/01-bug-fixes-code-quality/01-C-SUMMARY.md` using the summary template. Note if the floor grouping was already correct or required a fix.
</output>
