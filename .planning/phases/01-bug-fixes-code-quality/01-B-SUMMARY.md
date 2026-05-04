---
phase: 01-bug-fixes-code-quality
plan: B
subsystem: database
tags: [supabase, postgres, unique-index, check-constraint, composite-index, storage]

# Dependency graph
requires: []
provides:
  - Unique index on report_items(report_id, checklist_item_id) — duplicate inserts rejected at DB level
  - CHECK constraint on checklist_items.category — invalid categories hard-fail at DB level
  - Composite index on reports(room_id, created_at DESC) — hot-path query optimised
  - Delete handler clears storage objects from checklist-photos before removing DB row
affects:
  - 01-C
  - 01-D
  - phase-2-auth

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Storage cleanup before DB delete: fetch photo_paths, split newline-separated paths, call storage.remove() before reports.delete()
    - Storage error handling: log (console.warn) but do not block UI — orphan files preferable to stuck delete

key-files:
  created: []
  modified:
    - supabase/schema.sql
    - app/reports/page.tsx

key-decisions:
  - "Storage remove errors are non-blocking: console.warn only — avoids stuck UI when bucket permissions change in Phase 3"
  - "Migrations applied via supabase db query --linked (CLI) since MCP tools were unavailable in agent environment; equivalent result"
  - "Three migrations run sequentially without explicit BEGIN/COMMIT — supabase CLI runs each statement as its own transaction; no partial-commit risk given they are additive DDL"

patterns-established:
  - "Pre-check SELECT before each constraint migration (D-08 pattern) — run cleanup if violating rows found, then apply constraint"
  - "Storage-before-DB delete: always collect paths → remove storage → delete DB row; storage failure non-fatal"

requirements-completed: [BUG-03, BUG-05, BUG-06, BUG-12]

# Metrics
duration: 5min
completed: 2026-05-04
---

# Phase 1 Plan B: Schema Migrations & Storage-Delete Fix Summary

**Three live DB migrations (unique index, CHECK constraint, composite index) applied and storage-before-DB delete wired into the report delete handler**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-04T07:29:20Z
- **Completed:** 2026-05-04T07:34:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Applied `report_items_report_item_uniq` unique index to the live Supabase DB — duplicate report_items from double-submit races now rejected at DB level (BUG-03)
- Applied `checklist_items_category_check` CHECK constraint — invalid category values are a hard DB error, not a silent drift (BUG-05)
- Applied `reports_room_created_idx` composite index on `(room_id, created_at DESC)` — hot-path "latest report per room" query no longer does a full table scan (BUG-12)
- Fixed delete handler in `app/reports/page.tsx`: now fetches `photo_path` from all `report_items`, collects storage paths, calls `supabase.storage.from(PHOTO_BUCKET).remove()` before the DB delete — no more orphan files in checklist-photos (BUG-06)
- Pre-checks confirmed 0 duplicate rows and 0 invalid categories in production data before applying constraints
- `supabase/schema.sql` updated to reflect all three migrations

## Task Commits

Each task was committed atomically:

1. **Task B-1: Apply schema migrations via Supabase CLI** - `cbc1111` (feat)
2. **Task B-2: Fix report delete to purge storage objects first** - `7eb52e9` (fix)

**Plan metadata:** (follows below in final commit)

## Files Created/Modified

- `supabase/schema.sql` — Added three migration blocks with comments: unique index (BUG-03), CHECK constraint (BUG-05), composite index (BUG-12)
- `app/reports/page.tsx` — Replaced bare delete onClick with storage-first delete: fetch photo_paths → collect storagePaths → storage.remove() → reports.delete()

## Decisions Made

- Storage remove errors are non-blocking (console.warn only) — avoids a stuck delete button if bucket permissions change when Phase 3 flips the bucket private
- Migrations applied via `supabase db query --linked` (CLI) as the MCP tools were not directly callable in this agent environment; functionally equivalent to the plan's MCP approach
- Three migrations run sequentially as individual DDL statements — no partial-commit risk since each is additive and `IF NOT EXISTS` guards idempotency

## Deviations from Plan

**1. [Rule 3 - Blocking] Used supabase CLI instead of Supabase MCP**
- **Found during:** Task B-1 start
- **Issue:** The plan specified `mcp__supabase__*` MCP tools, which are not directly callable via Bash in this agent environment. However, `npx supabase db query --linked` was available and produces identical results.
- **Fix:** Used `npx supabase db query --linked "<SQL>"` for all pre-checks, migration statements, and verifications. The project was already linked via `supabase link --project-ref quuqxbvzxgaatbfuvyum`.
- **Files modified:** None (CLI tool swap only, same SQL executed)
- **Verification:** All three verification queries confirmed 1 row each after migration
- **Committed in:** cbc1111 (Task B-1 commit)

---

**Total deviations:** 1 auto-handled (blocking — CLI fallback for unavailable MCP tools)
**Impact on plan:** Zero impact. Same SQL statements, same live DB, same verification results. All must_haves satisfied.

## Issues Encountered

None beyond the MCP tool substitution above. Pre-checks found 0 violating rows, so no cleanup DELETEs or UPDATE statements were needed before applying constraints.

## User Setup Required

None — all migrations applied directly to the live database. No environment variables or dashboard steps needed.

## Next Phase Readiness

- DB integrity layer is now complete for Phase 1: unique index + CHECK constraint + composite index all live
- Storage cleanup on delete is wired — Phase 3 can flip the bucket private without worrying about accumulating orphan objects
- Plan C and D can proceed in parallel — no blocking dependencies on B

---
*Phase: 01-bug-fixes-code-quality*
*Completed: 2026-05-04*
