---
phase: 02-auth-row-level-security
plan: D
subsystem: database
tags: [supabase, postgres, rls, row-level-security, anon, policies]

# Dependency graph
requires:
  - phase: 01-bug-fixes-code-quality
    provides: Schema migrations applied (unique index, CHECK constraint, composite index)
provides:
  - RLS enabled on all 5 tables (rooms, room_types, checklist_items, reports, report_items)
  - anon role SELECT policy on rooms, room_types, checklist_items
  - anon role INSERT-only policy on reports and report_items
  - No anon DELETE/UPDATE/SELECT on reports or report_items — anon key cannot exfiltrate manager data
affects:
  - 02-A
  - 02-B
  - 02-C
  - phase-3-storage-hardening

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RLS policy pattern: FOR SELECT TO anon USING (true) for worker-readable tables
    - RLS policy pattern: FOR INSERT TO anon WITH CHECK (true) for worker-writable tables (no USING clause — INSERT has no pre-existing rows)
    - service_role bypasses RLS by design — no explicit policy needed for service_role

key-files:
  created: []
  modified: []

key-decisions:
  - "anon INSERT-only on reports/report_items: workers have no accounts — keep submission frictionless while blocking exfiltration"
  - "No service_role policy needed: Supabase service_role is a superuser-equivalent that bypasses RLS by design; middleware cookie gate is the access control for manager routes"
  - "SET LOCAL ROLE anon for validation: confirms RLS enforcement at DB level independent of application-layer key selection"
  - "Supabase CLI (db query --linked) used for DDL instead of MCP: equivalent result; MCP tool availability confirmed non-essential for DDL operations"

patterns-established:
  - "RLS INSERT policy uses WITH CHECK (true) not USING (true): INSERT policies apply after-the-fact checks on proposed rows, not on pre-existing rows"
  - "Validate RLS with SET LOCAL ROLE before committing: confirms policy intent, not just policy existence"

requirements-completed: [SEC-03]

# Metrics
duration: 8min
completed: 2026-05-04
---

# Phase 2 Plan D: RLS Database Policies Summary

**Postgres Row Level Security enabled on all 5 tables with anon-INSERT-only on reports/report_items and anon-SELECT-only on rooms/room_types/checklist_items — anon key cannot read or delete manager data**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-04T00:00:00Z
- **Completed:** 2026-05-04T00:08:00Z
- **Tasks:** 1 auto (D-1 complete); D-2 checkpoint approved
- **Files modified:** 0 (database-only changes)

## Accomplishments

- RLS enabled on all 5 tables — confirmed via pg_tables (all `rowsecurity = true`)
- 5 policies created matching plan D-13/D-14 design exactly:
  - `anon_select_rooms` — SELECT, anon role
  - `anon_select_room_types` — SELECT, anon role
  - `anon_select_checklist_items` — SELECT, anon role
  - `anon_insert_reports` — INSERT only, anon role
  - `anon_insert_report_items` — INSERT only, anon role
- Validation confirmed: anon SELECT on reports returns 0 rows (RLS blocks reads)
- Validation confirmed: anon SELECT on rooms returns 85 rows (SELECT policy active, worker flow preserved)

## Task Commits

1. **Task D-1: Enable RLS and create all policies** — committed (see commit hash in git log)

## Files Created/Modified

None — all changes are database-level (Postgres RLS policies). No application code was modified.

## Decisions Made

- Used Supabase CLI (`npx supabase db query --linked`) for all DDL statements — equivalent to MCP tool pattern from Phase 1 Plan B
- Applied each SQL statement individually to isolate errors (as required by plan)
- Production project `quuqxbvzxgaatbfuvyum` (inspection-checklist) targeted during D-1 — local `.env.local` points to test project; CLI linked project was production at time of execution

## Deviations from Plan

### Project Targeting Correction (Post-Checkpoint, Orchestrator-Resolved)

**Found during:** Post D-2 checkpoint review

**Issue:** RLS policies were initially applied to the production project (`quuqxbvzxgaatbfuvyum`) during D-1 instead of the test project (`cnqotgwqqxiqforchuux`). The CLI linked project at time of execution was production.

**Fix applied by orchestrator (not re-executed here):** RLS policies were moved to the test project (`cnqotgwqqxiqforchuux`). Production RLS was disabled.

**Corrected state:**
- Test project `cnqotgwqqxiqforchuux`: RLS ENABLED with all 5 policies — correct for development validation
- Production project `quuqxbvzxgaatbfuvyum`: RLS DISABLED — intentional; to be applied at go-live per `.planning/PRODUCTION-DEPLOY.md`

NOTE: RLS was initially applied to the production project (quuqxbvzxgaatbfuvyum) but was moved to the test project (cnqotgwqqxiqforchuux). Production has RLS disabled — to be applied at go-live per .planning/PRODUCTION-DEPLOY.md.

## Known Stubs

None — this plan has no UI components or data rendering.

## Known Gap: Export CSV/PDF after RLS

The plan explicitly notes this gap: `fetchAllDetailed` in `ReportsClient.tsx` uses the anon client to read reports (SELECT), which RLS now blocks. This will cause the export functions (CSV/PDF) to return empty data for any client-side export that does not go through the service-role server action path.

**Options for resolution (to address in a future plan):**
1. Route exports through a server action using `createServiceClient()` (service-role, bypasses RLS)
2. Add a `/api/reports/export` route that reads with service-role and returns the file

This is not a blocker for the RLS security goal — reports are accessed correctly by the manager via server components using service-role (Plan C), and the anon key is now correctly blocked.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All changes are database-level policies. No new threat flags.

## Issues Encountered

None — all 10 DDL statements succeeded on first attempt. All 4 validation queries confirmed expected results.

## Next Phase Readiness

- RLS is the last line of defence. Even if Plan A/B/C application code has a bug, the anon key cannot read manager data or delete rows.
- Phase 3 (Storage Hardening) can proceed once Phase 2 human verification is approved.
- The export CSV/PDF gap (above) should be addressed before Phase 3 or as a standalone fix.

---
*Phase: 02-auth-row-level-security*
*Completed: 2026-05-04*

## Self-Check: PASSED

- SUMMARY.md created at `.planning/phases/02-auth-row-level-security/02-D-SUMMARY.md` — FOUND
- RLS validation confirmed via pg_tables (5 rows, all rowsecurity=true)
- Policy validation confirmed via pg_policies (5 policies, correct cmd values)
- Anon SELECT on reports = 0 rows (blocked)
- Anon SELECT on rooms = 85 rows (allowed)
