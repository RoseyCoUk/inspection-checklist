# Phase 1: Bug Fixes & Code Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 01-bug-fixes-code-quality
**Areas discussed:** Submission failure UX, Photo limit enforcement, Schema migration safety

---

## Submission Failure UX (BUG-02)

### Q1: After a failed submit, what should the worker see?

| Option | Description | Selected |
|--------|-------------|----------|
| Error + keep answers | Show error, leave answers intact for retry | ✓ |
| Error + reset form | Show error and clear all answers | |
| Error + redirect | Send worker back to room list | |

**User's choice:** Error + keep answers (recommended)
**Notes:** None — accepted recommendation.

### Q2: What should the error message say?

| Option | Description | Selected |
|--------|-------------|----------|
| "Submission failed — please try again" | Plain, actionable | ✓ |
| "Network error — check your connection and retry" | Suggests a cause | |
| Let Claude decide | Match existing i18n tone | |

**User's choice:** "Submission failed — please try again"
**Notes:** None — accepted recommendation.

### Q3: Should the error message be translated?

| Option | Description | Selected |
|--------|-------------|----------|
| Add to i18n — both English and Arabic | Consistent with all other UI strings | ✓ |
| English-only for now | Simpler, translate later | |

**User's choice:** Add to i18n
**Notes:** None — accepted recommendation.

---

## Photo Limit Enforcement (BUG-08)

### Q1: When worker has 5 photos and tries to add more?

| Option | Description | Selected |
|--------|-------------|----------|
| Disable the Add Photo button at 5 | Self-evident on mobile, no error needed | ✓ |
| Show inline warning | Input stays active, shows error, discards extra | |
| Silently cap at 5 | Accept selection, keep first 5, discard rest | |

**User's choice:** Disable the Add Photo button at 5 (recommended)
**Notes:** User first asked if the cap could be raised. Explained the two reasons: storage cost (up to 100MB/inspection uncapped) and upload speed on mobile. User accepted the cap and recommended option. Photo resize (1600px, 0.7 JPEG) is the bigger quality-of-life win.

### Q2: Should there be a photo counter?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show count near the button | "3 / 5 photos" — workers know slots remaining | ✓ |
| No — just disable at 5 | Less UI, list implies count | |

**User's choice:** Yes — show counter
**Notes:** None — accepted recommendation.

---

## Schema Migration Safety (BUG-03, BUG-05)

### Q1: Live production database or dev/test?

| Option | Description | Selected |
|--------|-------------|----------|
| Live — real data, handle carefully | Cleanup step first, then constraints | ✓ |
| Dev/test — data can be wiped | Simple migration, constraints directly | |

**User's choice:** Live — real data
**Notes:** User flagged that live DB is also a testing challenge. Addressed with: (1) Vercel preview deployments for code changes, (2) Supabase SQL editor for pre-check queries, (3) MCP for direct migration execution.

### Q2: How to deliver the migration SQL?

| Option | Description | Selected |
|--------|-------------|----------|
| One file with pre-check + cleanup + constraints | Single migration.sql with commented sections | ✓ |
| Separate files per step | pre-check.sql, cleanup.sql, migration.sql | |

**User's choice:** One file (recommended)
**Notes:** User asked if Supabase MCP could be used instead of writing files for manual paste. Confirmed yes — `mcp__supabase__*` is available. Decision updated: executor agent uses MCP to run migrations directly in-session. No manual SQL files needed by user.

---

## Claude's Discretion

- Font migration (BUG-14): Keep both Cormorant Garamond and Inter; move from `globals.css @import` to `next/font/google` in `layout.tsx`
- `robots: noindex`: Add `robots: { index: false }` to existing metadata in `app/layout.tsx`
- All other BUG fixes are mechanical per REQUIREMENTS.md

## Deferred Ideas

- Raising the 5-photo cap — deferred until storage costs and mobile upload speeds are better understood
- Toast notifications instead of alert() — explicitly out of scope (cosmetic, per PROJECT.md)
- Test suite — out of scope (per PROJECT.md)
