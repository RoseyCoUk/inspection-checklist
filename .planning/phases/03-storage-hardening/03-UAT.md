---
status: complete
phase: 03-storage-hardening
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
---

## Result

Phase 3 UAT complete — 8 passed, 0 skipped, 0 issues.

## Tests

### 1. Worker photo upload still works
expected: On the check page (worker flow), take a photo or select one from the gallery and submit the form. The upload should succeed as normal — the bucket being private doesn't affect worker uploads because the anon INSERT policy was kept.
result: passed

### 2. Direct storage URL returns 403
expected: Copy any photo URL that was previously accessible (e.g. from a Supabase storage public URL like https://[ref].supabase.co/storage/v1/object/public/checklist-photos/...). Pasting it directly in a browser tab should now return a 403 error or access denied — not the photo.
result: passed

### 3. Photos display on report detail page
expected: Open any existing report at /reports/[id]. Photos attached to bad-status items should display correctly in the page — they should load from signed URLs now, not public URLs.
result: passed

### 4. CSV export includes photo URLs
expected: On the reports list page, select some reports and click Export CSV. Open the CSV file. The Photos column should contain URLs (one per photo, pipe-separated). The URLs should be signed (containing a token/expiry in the query string), not the old public storage URLs.
result: passed

### 5. PDF export includes photos
expected: On the reports list page, select some reports and click Export PDF. The PDF should generate and photos should appear embedded in it — not broken image icons. (This was broken before because fetchAllDetailed used the anon client which was blocked by RLS.)
result: passed

### 6. Report detail CSV export includes photo URLs
expected: On a single report detail page (/reports/[id]), click Export CSV. The Photos column should contain signed URLs, not public URLs or empty strings.
result: passed

### 7. Report detail PDF export includes photos
expected: On a single report detail page (/reports/[id]), click Export PDF. Photos should appear in the PDF output — loaded via signed URLs.
result: passed

### 8. Unauthenticated export request blocked
expected: If you can test via curl or browser devtools: a GET request to /api/export?ids=... without a valid mgr-session cookie should return HTTP 401 — not report data.
result: passed (307 redirect from proxy middleware — data blocked before route handler runs)

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
