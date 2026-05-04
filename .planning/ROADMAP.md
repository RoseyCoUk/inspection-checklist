# Roadmap — inspection-checklist Fix Pass

**3 phases** | **22 requirements** | All review findings covered ✓

---

## Phase 1: Bug Fixes & Code Quality

**Goal:** Fix all data integrity, correctness, and code quality issues from the review. No new features, no auth. Ship a clean codebase.

**Requirements:** BUG-01 through BUG-14

**Plans:** 4 plans (all Wave 1 — fully parallel)

Plans:
- [ ] 01-PLAN-A.md — Submission flow hardening: useRef guard, atomic submit with compensating delete, bulk insert, photo resize/cap/counter, empty-state, lang validation, i18n submitError key
- [ ] 01-PLAN-B.md — Database schema migrations (Supabase MCP): unique index BUG-03, CHECK constraint BUG-05, composite index BUG-12, storage-delete-before-DB-row BUG-06
- [ ] 01-PLAN-C.md — Reports page fixes: 200-cap notice BUG-04, dateFrom timezone fix BUG-09, floor grouping fix BUG-13
- [ ] 01-PLAN-D.md — Foundation & tooling: next/font migration + robots noindex BUG-14, ItemCategory type widening BUG-05 (TS side)

**Success criteria:**
1. Submitting a report from a slow phone never creates duplicate entries in `reports` or `report_items`
2. A failed mid-submission leaves no orphan `reports` row in the database
3. Deleting a report removes its storage objects — bucket does not accumulate orphan files
4. Photos uploaded from a modern iPhone are ≤400KB each and capped at 5 per item
5. Date filters on the reports page return the correct day's results regardless of the user's timezone
6. A room type with zero checklist items shows an empty-state message, not an infinite spinner

**Cross-cutting constraint:** Plan B and Plan C both touch `app/reports/page.tsx` (different sections). Execute sequentially or read the file fresh before each edit.

**Status:** Ready to execute

---

## Phase 2: Auth & Row-Level Security

**Goal:** Gate `/reports` behind manager auth and lock down the Supabase tables with RLS so the anon key can no longer read all data or delete rows.

**Requirements:** SEC-01 through SEC-04

**Success criteria:**
1. `curl https://resort-checklist.vercel.app/reports` returns a redirect to login, not HTTP 200
2. An unauthenticated request cannot delete a report — no client-side delete path exists
3. A direct Supabase query with the anon key cannot read `reports` or `report_items` rows
4. A manager can log in via magic link email and access `/reports` within 60 seconds
5. Worker submission (anon insert) still works after RLS is enabled

**Status:** Pending

---

## Phase 3: Storage Hardening

**Goal:** Make the photo storage bucket private so photo URLs are not guessable or permanently public.

**Requirements:** STG-01 through STG-04

**Dependencies:** Phase 2 (auth session needed to call `createSignedUrl` on private bucket)

**Success criteria:**
1. Direct object URLs for `checklist-photos` return 403 — bucket is not public
2. Photos render correctly in the check page, report detail, and reports list
3. PDF exports include photos loaded via signed URLs with no CORS failures
4. Signed URLs in the app expire within 1 hour

**Status:** Pending

---

## Summary

| Phase | Focus | Requirements | Complexity |
|-------|-------|--------------|------------|
| 1 | Bug fixes & code quality | BUG-01 – BUG-14 | Low–Medium |
| 2 | Auth & RLS | SEC-01 – SEC-04 | High |
| 3 | Storage hardening | STG-01 – STG-04 | Medium |
