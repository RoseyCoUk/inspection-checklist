---
phase: "03-storage-hardening"
plan: "02"
subsystem: "export-api"
tags: ["storage", "signed-urls", "export", "auth", "rls"]
dependency_graph:
  requires: []
  provides: ["authenticated-export-api", "signed-url-batch-generation"]
  affects: ["app/reports/ReportsClient.tsx", "app/api/export/route.ts"]
tech_stack:
  added: ["GET /api/export route handler"]
  patterns: ["service-role-client-in-route-handler", "batch-signed-url-generation", "request.cookies-session-pattern"]
key_files:
  created:
    - app/api/export/route.ts
  modified:
    - app/reports/ReportsClient.tsx
decisions:
  - "Use request.cookies (not next/headers) for session in route handler — consistent with proxy.ts pattern"
  - "Batch all photo paths across all reports before calling createSignedUrls — single API call, not per-report"
  - "Null-guard on item.path in createSignedUrls result — Supabase type allows null path"
  - "PHOTO_BUCKET import retained in ReportsClient.tsx (unused) — TypeScript does not enforce noUnusedLocals"
metrics:
  duration: "12min"
  completed: "2026-05-05"
  tasks_completed: 2
  files_modified: 2
---

# Phase 3 Plan 02: Authenticated Export API + Signed URL Batch Generation Summary

Authenticated GET /api/export route using service role client and batch createSignedUrls(3600s), replacing broken anon-client fetchAllDetailed() and getPublicUrl() calls in ReportsClient.tsx.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create GET /api/export route handler | 3e9524c | app/api/export/route.ts (new) |
| 2 | Replace fetchAllDetailed + getPublicUrl in ReportsClient | 536ce74 | app/reports/ReportsClient.tsx |
| 2a | Remove fetchAllDetailed from comment | 17ca297 | app/reports/ReportsClient.tsx |

## What Was Built

### app/api/export/route.ts (new)

A Next.js GET route handler that:
1. Verifies `mgr-session` cookie via `getSessionFromRequest` + `verifySession` (returns 401 if missing/invalid)
2. Parses `?ids=id1,id2,...` query param
3. Fetches full report data via `createServiceClient()` (bypasses RLS)
4. Collects all photo paths across all report items
5. Calls `createSignedUrls(allPaths, 3600)` once for the entire batch (1-hour TTL)
6. Returns `{ reports, signedUrlMap }` JSON

### app/reports/ReportsClient.tsx (modified)

- Removed `supabase` anon client from import (was blocked by RLS)
- Replaced `fetchAllDetailed()` with `fetchExportData()` which calls `fetch('/api/export?ids=...')`
- Replaced `supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl` with `signedUrlMap[p] ?? ""` in both `exportAllCsv` and `exportAllPdf`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: Type 'null' cannot be used as an index type**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `signedUrlMap[item.path]` — Supabase's `createSignedUrls` return type allows `path: string | null`, causing TS2538
- **Fix:** Added `&& item.path` null guard: `if (item.signedUrl && item.path)`
- **Files modified:** app/api/export/route.ts
- **Commit:** Included in 3e9524c

**2. [Rule 1 - Bug] fetchAllDetailed appeared in comment in ReportsClient.tsx**
- **Found during:** Task 2 acceptance criteria check
- **Issue:** The STG comment I wrote included the old function name, causing `grep "fetchAllDetailed"` to return a match
- **Fix:** Reworded comment to remove the old function name
- **Files modified:** app/reports/ReportsClient.tsx
- **Commit:** 17ca297

## Known Stubs

None — all export functions are fully wired to the new authenticated API route.

## Deferred Items

**getPublicUrl in ReportDetailClient.tsx** (out of scope for 03-02):
- File: `app/reports/[id]/ReportDetailClient.tsx` lines 42, 129, 173
- Uses `supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p)` for single-report photo display
- Will break when storage RLS blocks public URL access
- Logged to `.planning/phases/03-storage-hardening/deferred-items.md`
- Not fixed — requires a separate plan or inclusion in 03-03

## Threat Surface Scan

T-03B-01 (Elevation of Privilege) mitigated: `getSessionFromRequest + verifySession` are the first two operations in the handler before any DB query — exactly as specified in the threat register.

No new threat surfaces introduced beyond what was planned.

## Self-Check: PASSED

- [x] `app/api/export/route.ts` exists: confirmed
- [x] commit 3e9524c exists: `git log --oneline | grep 3e9524c`
- [x] commit 536ce74 exists: `git log --oneline | grep 536ce74`
- [x] commit 17ca297 exists: `git log --oneline | grep 17ca297`
- [x] `npx tsc --noEmit` exits 0
- [x] Zero `getPublicUrl` in `app/reports/ReportsClient.tsx`
- [x] Zero `fetchAllDetailed` in `app/reports/ReportsClient.tsx`
- [x] `fetchExportData` appears 3 times (declaration + CSV call + PDF call)
- [x] `signedUrlMap[p]` appears 2 times (CSV + PDF photo columns)
