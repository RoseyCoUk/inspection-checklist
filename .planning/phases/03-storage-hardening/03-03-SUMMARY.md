---
plan: 03-03
phase: 03-storage-hardening
status: complete
completed: 2026-05-05
commits:
  - fe0c72d
  - 3fdcf97
---

## Summary

Migrated the report detail page from `getPublicUrl` (broken after bucket was made private) to server-side signed URLs with a 1-hour TTL.

## What Was Built

**Task 1 — Server component (`app/reports/[id]/page.tsx`):**
After the existing report data fetch, collects all `photo_path` values from `report_items`, splits newline-joined paths, and batch-generates signed URLs via `createServiceClient().storage.createSignedUrls(allPaths, 3600)`. Builds a `signedUrlMap: Record<string, string>` and passes it as a new prop to `ReportDetailClient`.

**Task 2 — Client component (`app/reports/[id]/ReportDetailClient.tsx`):**
- Removed `supabase` and `PHOTO_BUCKET` import (anon client no longer needed)
- Added `signedUrlMap: Record<string, string>` to the component props type
- Replaced all three `getPublicUrl` call sites with `signedUrlMap[p] ?? ""`:
  1. `exportCsv` — Photo column in CSV export
  2. `exportPdf` — Photo loading loop in PDF export
  3. JSX render — `photoUrls` array for bad-item photo display

## Verification

- `grep -rn "getPublicUrl" app/reports/` → zero matches (all call sites eliminated)
- `grep -c "supabase" app/reports/[id]/ReportDetailClient.tsx` → 0
- `grep -c "createSignedUrls" app/reports/[id]/page.tsx` → 1
- `grep -c "signedUrlMap" app/reports/[id]/ReportDetailClient.tsx` → 5 (prop type + 3 usage sites + 1 destructure)
- `npx tsc --noEmit` → clean (exit 0)

## Requirements Met

- STG-02: Report detail page photos served via signed URLs (1-hour TTL)

## Self-Check: PASSED

All acceptance criteria satisfied. No getPublicUrl calls remain in app/reports/.
