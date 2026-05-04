# inspection-checklist — Fix Pass

## What This Is

A targeted fix pass on Hazem's resort room inspection checklist app. The app is a Next.js/Supabase tool used internally by resort staff to log room issues and for managers to review reports. It's functional end-to-end but has security holes (fully public /reports, no RLS) and a collection of data integrity and code quality bugs surfaced in a code review.

## Core Value

Reports are only accessible to authorised managers, and submissions are reliable — no duplicates, no partial writes, no data loss.

## Context

- **Repo:** github.com/RoseyCoUk/inspection-checklist
- **Live:** https://resort-checklist.vercel.app
- **Stack:** Next.js 16 App Router, React 19, Supabase, jsPDF, Tailwind v4
- **Review source:** PR #1 (REVIEW.md) — 20 findings across security, data integrity, perf, and UX
- **Status:** App works end-to-end. Fixing prioritised findings in 3 phases.

## Requirements

### Validated

- ✓ Room inspection flow (worker name → pick room → tick items → upload photos → submit) — existing
- ✓ Manager report view with filters, sort, CSV/PDF export — existing
- ✓ Arabic/RTL toggle — existing

### Active

**Phase 1 — Bug fixes & code quality**
- [ ] Double-submit race fixed (useRef synchronous guard)
- [ ] Non-atomic submission: compensating delete on failure
- [ ] Duplicate report_items prevented (unique index)
- [ ] 200-report cap communicated to user
- [ ] Category type consistent across TS, SQL, UI, and seed
- [ ] Orphan storage objects deleted when a report is deleted
- [ ] N+1 writes replaced with bulk insert + parallel uploads
- [ ] Photo uploads resized client-side (≤1600px, max 5 per item)
- [ ] Date filter parses from/to dates in the same timezone
- [ ] Empty checklist items shows a message, not an infinite spinner
- [ ] localStorage lang value validated before use
- [ ] Hot-path index on reports(room_id, created_at desc)
- [ ] Floor grouping handles double-digit floors
- [ ] Google Fonts replaced with next/font; noindex added to metadata

**Phase 2 — Auth & Row-Level Security**
- [ ] Manager login via Supabase Auth magic link
- [ ] /reports/* gated behind middleware auth check
- [ ] RLS enabled on all 5 tables with correct per-role policies
- [ ] Report delete moved to a server action (anon key cannot delete)

**Phase 3 — Storage Hardening**
- [ ] checklist-photos bucket flipped to private
- [ ] All photo renders use createSignedUrl instead of getPublicUrl
- [ ] PDF/CSV exports use signed URLs

### Out of Scope

- New features (worker accounts, room management UI) — not in scope of this fix pass
- Test suite — codebase too small to justify now
- alert() → toast replacement — cosmetic, deferred

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Magic link auth for managers | No password management needed for internal tool | — Pending |
| Anon insert-only on reports/items | Workers have no accounts — keep submission frictionless | — Pending |
| Server action for delete | Removes anon-key delete risk without a full auth refactor | — Pending |
| Phase storage hardening separately | Requires auth signed URLs — can't go private until auth exists | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

---
*Last updated: 2026-05-03 after initialisation*
