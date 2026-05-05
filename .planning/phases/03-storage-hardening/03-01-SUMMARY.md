---
phase: 03-storage-hardening
plan: "01"
subsystem: storage
tags: [storage, rls, security, supabase]
dependency_graph:
  requires: []
  provides: [private-bucket-checklist-photos, anon-select-policy-removed, anon-delete-policy-removed]
  affects: [signed-url-generation, worker-photo-uploads]
tech_stack:
  added: []
  patterns: [private-supabase-storage-bucket, storage-policy-removal]
key_files:
  created: []
  modified:
    - .planning/PRODUCTION-DEPLOY.md
decisions:
  - Dropped anon SELECT policy — redundant on private bucket; signed URLs will replace direct access
  - Dropped anon DELETE policy — deleteReportAction already uses service role; workers should not delete
  - Retained anon INSERT policy — worker uploads from check page use the anon key
metrics:
  duration: "2 minutes"
  completed: "2026-05-05"
  tasks_completed: 1
  files_modified: 1
requirements:
  - STG-01
---

# Phase 3 Plan 01: Storage Hardening — Private Bucket + Policy Cleanup Summary

**One-liner:** Made checklist-photos bucket private and removed anon SELECT/DELETE storage policies, eliminating direct public URL access to inspection photos.

## What Was Built

The `checklist-photos` Supabase Storage bucket on the test project (`cnqotgwqqxiqforchuux`) was made private by setting `public = false`. Two storage object policies that were only valid for a public bucket were dropped: the anon SELECT policy ("anyone can view photos") and the anon DELETE policy ("anon can delete photos"). The anon INSERT policy ("anon can upload photos") was retained so workers can still upload photos from the check page using the anon key.

All changes are documented in `.planning/PRODUCTION-DEPLOY.md` under the new "Phase 3: Storage Hardening" section (DB-02) with full SQL, verification queries, and rollback instructions for the production deployment team.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Make bucket private and remove anon SELECT/DELETE policies | 16519a8 | .planning/PRODUCTION-DEPLOY.md |

## Verification Results

| Check | Result |
|-------|--------|
| `SELECT public FROM storage.buckets WHERE id = 'checklist-photos'` | `false` |
| Policy count on `storage.objects` | 1 (only INSERT remains) |
| Remaining policy name | `"anon can upload photos"` |
| Remaining policy cmd | `INSERT` |
| PRODUCTION-DEPLOY.md contains `DB-02` | Yes |
| PRODUCTION-DEPLOY.md contains `STG-01` | Yes |
| PRODUCTION-DEPLOY.md contains `✅ Test \| ⏳ Production` | Yes |

## Security Impact

| Threat ID | Threat | Status |
|-----------|--------|--------|
| T-03A-01 | Information Disclosure via public bucket URLs | Mitigated — bucket is now private, direct URLs return 403 |
| T-03A-02 | Elevation of Privilege via anon DELETE policy | Mitigated — DELETE policy dropped |
| T-03A-03 | Information Disclosure via anon SELECT policy | Mitigated — SELECT policy dropped |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new threat surface introduced. This plan removes existing threat surface.

## Self-Check: PASSED

- Commit `16519a8` exists: confirmed
- `.planning/PRODUCTION-DEPLOY.md` contains "DB-02": confirmed
- `.planning/PRODUCTION-DEPLOY.md` contains "STG-01": confirmed
- `.planning/PRODUCTION-DEPLOY.md` contains "Phase 3": confirmed
- Test project bucket `public = false`: confirmed via verification query
- Only one storage policy remains (INSERT): confirmed via verification query
