---
phase: 02-auth-row-level-security
plan: C
subsystem: auth
tags: [nextjs, server-components, server-actions, supabase, rls, security]

# Dependency graph
requires:
  - phase: 02-auth-row-level-security/A
    provides: getSession() in lib/session.ts and createServiceClient() in lib/supabase.ts

provides:
  - app/actions/delete-report.ts — server action with session verification, service-role delete
  - app/reports/page.tsx — async server component fetching reports via service-role client
  - app/reports/ReportsClient.tsx — client component with all interactive logic and deleteReportAction wired
  - app/reports/[id]/page.tsx — async server component fetching single report via service-role client
  - app/reports/[id]/ReportDetailClient.tsx — client component with CSV/PDF export, photo rendering

affects: [02-D-rls, 03-storage-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server component fetches data via createServiceClient(), passes as props to client component"
    - "Server action verifies getSession() before any DB mutation (D-12 pattern)"
    - "Inline error display via setErr() for delete failures (D-11 pattern)"
    - "confirm() browser dialog preserved before destructive delete (D-10 pattern)"
    - "Next.js 16 dynamic route params: params: Promise<{ id: string }> — must await"

key-files:
  created:
    - app/actions/delete-report.ts
    - app/reports/ReportsClient.tsx
    - app/reports/[id]/ReportDetailClient.tsx
  modified:
    - app/reports/page.tsx
    - app/reports/[id]/page.tsx

key-decisions:
  - "Client-side supabase.delete() replaced with deleteReportAction server action — session verified inside action because server actions are reachable via direct POST even without proxy gate"
  - "fetchAllDetailed in ReportsClient uses public anon client for now — this is a known gap (Plan D RLS will break it)"
  - "Canvas/Image/jsPDF browser APIs kept in ReportDetailClient (client component) — cannot run on server"
  - "Delete error display uses setErr() inline rather than alert() to improve UX (D-11)"

patterns-established:
  - "Server/client split: server component owns data fetch, client component owns interactivity"
  - "Service-role client (createServiceClient) used only in server components and server actions — never client components"

requirements-completed: [SEC-04, SEC-03]

# Metrics
duration: 15min
completed: 2026-05-04
---

# Phase 2 Plan C: Reports Server-Component Conversion Summary

**Removed client-side supabase delete (SEC-04); converted reports pages to async server components using service-role client with full interactive extraction to client components**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-04T00:00:00Z
- **Completed:** 2026-05-04T00:15:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created `deleteReportAction` server action that verifies `mgr-session` JWT before any DB mutation — eliminates the primary security hole (SEC-04: client-side anon-key delete)
- Converted `app/reports/page.tsx` to an async server component using `createServiceClient()` (service-role key, never bundled to client)
- Created `app/reports/ReportsClient.tsx` with all interactive logic verbatim: filters, sort, CSV/PDF export, and the new delete handler wired to `deleteReportAction`
- Converted `app/reports/[id]/page.tsx` to an async server component with Next.js 16 `await params` pattern
- Created `app/reports/[id]/ReportDetailClient.tsx` with all rendering, CSV/PDF export, and photo display (browser APIs kept client-side)

## Task Commits

1. **Task C-1: Create deleteReportAction server action** - `79cdbf3` (feat)
2. **Task C-2: Convert reports/page.tsx + create ReportsClient.tsx** - `e974050` (feat)
3. **Task C-3: Convert reports/[id]/page.tsx + create ReportDetailClient.tsx** - `bde0b71` (feat)

## Files Created/Modified

- `app/actions/delete-report.ts` — server action: verifies getSession(), deletes storage objects, then DB row; returns `{ ok: true }` or `{ error: string }`
- `app/reports/page.tsx` — rewritten as async server component: no "use client", no useState/useEffect, uses createServiceClient()
- `app/reports/ReportsClient.tsx` — new "use client" component: all filter/sort/export state, handleDelete calls deleteReportAction
- `app/reports/[id]/page.tsx` — rewritten as async server component: awaits Promise<{ id }> params, uses createServiceClient()
- `app/reports/[id]/ReportDetailClient.tsx` — new "use client" component: rendering with CSV/PDF/photo export verbatim from old page.tsx

## Decisions Made

- `deleteReportAction` calls `getSession()` as first check — server actions are reachable via direct POST independently of the proxy gate, so session must be verified inside the action itself
- Storage delete before DB row delete (consistent with Phase 1 BUG-06 pattern); storage errors are non-blocking (orphan files preferred over stuck UI)
- `confirm()` dialog kept in `handleDelete` (D-10); error shown inline via `setErr()` not `alert()` (D-11)
- `fetchAllDetailed` in `ReportsClient.tsx` retains the anon supabase client — known gap documented below

## Known Gap: CSV/PDF Export Will Break After Plan D RLS

`fetchAllDetailed()` in `app/reports/ReportsClient.tsx` uses the public anon `supabase` client to query `reports`. After Plan D applies RLS that blocks anon-key reads on the `reports` table, this function will fail (empty result or error).

**Impact:** Export CSV / Export PDF buttons will stop working after Plan D.

**Resolution options for Plan D or gap closure:**
1. Move export to a server route handler (`/api/reports/export`) that uses `createServiceClient()` and streams the response
2. Pass all report detail data from the server component (memory-intensive for 200 reports)
3. Add a separate authenticated export endpoint

Plan D's success criteria includes validating this gap. A gap closure plan may be needed.

## Deviations from Plan

None — plan executed exactly as written. The known gap in `fetchAllDetailed` is explicitly documented in the plan as acceptable for this phase.

## Issues Encountered

None — TypeScript compiled clean after each task (`npx tsc --noEmit` exits 0).

## Threat Surface

No new threat surface introduced beyond what was planned. The `deleteReportAction` mitigates T-02C-01 (session verification before mutation). The `createServiceClient()` usage in server components mitigates T-02C-02 (service-role key never in client bundle). Both are as designed.

## Next Phase Readiness

- Plan D (RLS policies) can now be applied safely — no client-side delete remains
- After Plan D: the CSV/PDF export gap must be addressed (see Known Gap section)
- All server components use service-role client — RLS on anon key will not break page loads

---
*Phase: 02-auth-row-level-security*
*Completed: 2026-05-04*
