---
phase: 01-bug-fixes-code-quality
plan: A
subsystem: ui
tags: [react, supabase, typescript, i18n, canvas, photo-upload]

# Dependency graph
requires: []
provides:
  - "Double-submit-safe submit() function using useRef synchronous guard"
  - "Atomic bulk INSERT for report_items (single DB round-trip)"
  - "Compensating delete of orphan reports row on submission failure"
  - "Client-side photo resize to ≤1600px long edge at 0.7 JPEG quality"
  - "MAX_PHOTOS=5 cap with disabled input and always-visible counter"
  - "Empty-state message for zero-item room types (not infinite spinner)"
  - "submitError i18n key in en and ar locales"
  - "Runtime lang validation replacing unsafe type cast"
affects: [01-B, 01-C, 01-D]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef for synchronous mutation guards (before first await) alongside useState for UI feedback"
    - "Bulk insert pattern: resolve all uploads in parallel per item, then single supabase.from().insert(rows[])"
    - "Canvas blob resize helper at module scope for client-side image downsizing before upload"
    - "Compensating delete in catch block to maintain data integrity on partial submission failure"
    - "Runtime validation for localStorage values instead of type casts"

key-files:
  created: []
  modified:
    - app/check/[roomId]/page.tsx
    - lib/i18n.ts

key-decisions:
  - "useRef over useState for double-submit guard: ref mutation is synchronous and does not trigger re-render gap between two rapid taps"
  - "Canvas toBlob at module scope (not component): avoids closure state and is reusable"
  - "Compensating delete uses nested try/catch (not .catch()) because Supabase PostgREST builder does not expose a .catch() method"
  - "photo_path stored as newline-joined paths string to maintain backward compatibility with existing report_items schema"

patterns-established:
  - "Async mutation guard: set ref synchronously, set state immediately after for UI, clear both in finally/catch"
  - "i18n error display: always use t('key') in catch blocks, never expose raw Supabase error messages"

requirements-completed: [BUG-01, BUG-02, BUG-07, BUG-08, BUG-10, BUG-11]

# Metrics
duration: 3min
completed: 2026-05-04
---

# Phase 1 Plan A: Bug Fixes (Check Page + i18n) Summary

**Double-submit-safe, bulk-inserting, photo-resizing check page submission with i18n errors and validated lang reads**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-04T07:24:07Z
- **Completed:** 2026-05-04T07:27:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rewrote submit() to be atomic: useRef guard prevents double-tap races, bulk INSERT replaces N+1 loop, compensating delete cleans up orphan rows on failure
- Added client-side photo pipeline: resizePhoto() helper caps long edge at 1600px (0.7 JPEG quality), MAX_PHOTOS=5 enforced with disabled input and live counter
- Fixed i18n layer: submitError key in both locales, runtime lang validation replaces unsafe type cast, empty-state shown after load instead of infinite spinner

## Task Commits

1. **Task A-1: Add submitError i18n key and fix lang validation** - `692ddd4` (feat)
2. **Task A-2: Rewrite submit(), fix photo cap/resize/counter, fix empty-state** - `f43902b` (feat)

## Files Created/Modified

- `lib/i18n.ts` - Added submitError key in en+ar; replaced unsafe (localStorage.getItem("lang") as Lang) cast with runtime guard
- `app/check/[roomId]/page.tsx` - Full submission rewrite with useRef guard, bulk insert, compensating delete, resizePhoto helper, MAX_PHOTOS cap, loaded empty-state

## Decisions Made

- Used `useRef` for the double-submit guard (not `useState`) because ref mutation is synchronous — fires before the first `await`, closing the re-render gap that made the old state-based check ineffective
- Compensating delete uses nested `try/catch` instead of `.catch()` because the Supabase PostgREST `FilterBuilder` type does not expose a `.catch()` method; TypeScript enforced this
- `photo_path` continues to store newline-joined storage paths (unchanged schema) — maintaining compatibility with existing report readers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Supabase FilterBuilder has no .catch() method**
- **Found during:** Task A-2 (rewrite submit())
- **Issue:** Plan specified `supabase.from("reports").delete().eq("id", reportId).catch(() => {})` but the PostgREST builder type does not expose `.catch()` — TypeScript error TS2551
- **Fix:** Wrapped the compensating delete in a nested `try { await ... } catch { }` block instead; semantically identical behaviour
- **Files modified:** app/check/[roomId]/page.tsx
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** f43902b (Task A-2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript type constraint)
**Impact on plan:** Fix is semantically identical to the plan's intent. No scope change.

## Issues Encountered

None beyond the auto-fixed TypeScript deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan A complete. Plans B, C, D (wave 1, all parallel) can proceed independently.
- app/check/[roomId]/page.tsx and lib/i18n.ts are stable — Plans B/C/D touch different files.

## Self-Check: PASSED

- `lib/i18n.ts` modified — confirmed submitError in both locales, runtime lang guard present
- `app/check/[roomId]/page.tsx` modified — confirmed all 6 bug criteria (submittingRef x4, MAX_PHOTOS, resizePhoto, single bulk insert, compensating delete, t("submitError"), disabled cap, counter, loaded empty-state)
- Commits 692ddd4 and f43902b present in git log
- `npx tsc --noEmit` exits 0

---
*Phase: 01-bug-fixes-code-quality*
*Completed: 2026-05-04*
