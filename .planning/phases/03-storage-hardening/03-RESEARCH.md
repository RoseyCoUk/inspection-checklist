# Phase 3: Storage Hardening - Research

**Researched:** 2026-05-04
**Domain:** Supabase Storage (private buckets, signed URLs), Next.js 16 route handlers, jsPDF photo loading
**Confidence:** HIGH

---

## Summary

Phase 3 makes the `checklist-photos` bucket private and replaces all `getPublicUrl()` calls with time-limited signed URLs. The current bucket is public (`public: true` confirmed on test project) with three policies: anon INSERT, anon SELECT, anon DELETE. The plan has two independent tracks: (A) server-side signed URL generation for the manager-facing report pages, and (B) storage policy changes plus the critical gap fix for `fetchAllDetailed`.

The most important finding is about **where signed URLs must be generated**. For the manager report pages (server components already exist), signed URLs should be generated at render time in the server component and passed as props — this avoids any client-side storage calls for photo rendering. For PDF/CSV export, which runs browser-side using jsPDF, signed URLs must be fetched via a server route handler (`GET /api/export/[reportId]`) that returns pre-signed URLs alongside the report data, replacing the broken `fetchAllDetailed()` anon-client call in one shot.

The `createServiceClient()` (service role key) bypasses RLS entirely on Supabase Storage — no explicit storage policy is needed for the service role to call `createSignedUrl`. Only anon INSERT needs to remain for worker photo uploads. The anon SELECT and anon DELETE policies must be removed when making the bucket private.

**Primary recommendation:** Generate all signed URLs server-side via `createServiceClient()`. Never call `createSignedUrl` from a client component. Replace `fetchAllDetailed()` with a `GET /api/export` route handler using `createServiceClient()` that returns both report data and pre-signed photo URLs in one response.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Test project only:** All DB and storage changes apply to `cnqotgwqqxiqforchuux` only. Never touch `quuqxbvzxgaatbfuvyum` (production). Document every change in `.planning/PRODUCTION-DEPLOY.md`.
- **Next.js 16:** Middleware is `proxy.ts` with `export function proxy` (not `middleware.ts`). Route handlers use `app/api/**/route.ts`. `params` in dynamic routes is `Promise<{...}>` and must be awaited.
- **`cookies()` is async in Next.js 16:** Always `const cookieStore = await cookies()`.
- **Service role key never in client bundles:** `createServiceClient()` only in server components, server actions, and route handlers.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STG-01 | `checklist-photos` bucket set to private (dashboard + policy update) | SQL to update bucket `public` flag + drop anon SELECT/DELETE policies |
| STG-02 | All photo renders use `createSignedUrl` with 1-hour TTL instead of `getPublicUrl` | Server-side signed URL generation via `createServiceClient()`, pass as props |
| STG-03 | PDF export loads photos via signed URLs | Route handler returns pre-signed URLs; jsPDF `loadImg` uses them directly |
| STG-04 | CSV export uses signed URLs for photo column (or omits direct public paths) | Same route handler response includes signed URLs for CSV column |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bucket privacy toggle (STG-01) | Database / Storage | — | SQL UPDATE on `storage.buckets` + DROP POLICY on `storage.objects` |
| Storage RLS policies (STG-01) | Database / Storage | — | CREATE/DROP POLICY on `storage.objects` |
| Signed URL generation for report detail render (STG-02) | API / Backend (server component) | — | Must use service role key; runs at SSR time; passes signed URLs as props |
| Signed URL generation for reports list thumbnail (STG-02) | API / Backend (server component) | — | Same pattern; `reports/page.tsx` already fetches data server-side |
| Photo render display in client component (STG-02) | Browser / Client | — | Receives signed URL string as prop; renders `<img src={signedUrl}>` |
| PDF export photo loading (STG-03) | Browser / Client | API / Backend | jsPDF runs in browser; needs pre-fetched signed URLs from route handler |
| CSV export photo column (STG-04) | Browser / Client | API / Backend | Same export route handler provides signed URLs |
| Export data fetch — gap fix (STG-03, STG-04) | API / Backend (route handler) | — | Replaces broken `fetchAllDetailed()` anon client; uses service role |
| Worker photo upload (not in scope) | Browser / Client | — | Stays as-is: anon INSERT policy kept on `storage.objects` |

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.105.3 (installed: `^2.103.0`) | Storage `createSignedUrl`, `createSignedUrls` | Already the project's Supabase client |
| `createServiceClient()` | project utility | Signed URL generation server-side | Service role bypasses RLS — correct for server-side generation |

**No new libraries needed.** `createSignedUrl` and `createSignedUrls` are built into `@supabase/supabase-js`. `jsPDF` (4.2.1) already handles images via `loadImg`.

### Version verification
[VERIFIED: npm registry] — `@supabase/supabase-js` latest is 2.105.3; project has `^2.103.0` (compatible).

---

## Current Storage State (VERIFIED on test project)

[VERIFIED: npx supabase db query on cnqotgwqqxiqforchuux]

**Bucket:** `checklist-photos`
- `public: true` — currently a PUBLIC bucket
- Created: 2026-05-04

**Existing policies on `storage.objects`:**

| Policy Name | Operation | Role | Condition |
|-------------|-----------|------|-----------|
| `anon can upload photos` | INSERT | anon | `bucket_id = 'checklist-photos'` |
| `anyone can view photos` | SELECT | anon | `bucket_id = 'checklist-photos'` |
| `anon can delete photos` | DELETE | anon | `bucket_id = 'checklist-photos'` |

**Required changes for STG-01:**
1. `UPDATE storage.buckets SET public = false WHERE id = 'checklist-photos'` — makes bucket private
2. `DROP POLICY "anyone can view photos" ON storage.objects` — anon SELECT no longer allowed
3. `DROP POLICY "anon can delete photos" ON storage.objects` — anon delete was wrong anyway (Phase 2 deleteReportAction uses service role)
4. Keep `"anon can upload photos"` (INSERT) — worker photo uploads still use anon key

**Service role:** No storage policy needed. Service role bypasses all RLS automatically. [VERIFIED: supabase/discussions #23840]

---

## Architecture Patterns

### System Architecture Diagram

```
Worker (anon, browser)               Manager (authenticated, browser)
       |                                       |
  [Check Page]                         [Reports List / Detail]
  anon supabase client                 server component (SSR)
  - reads rooms/items (anon SELECT)    - createServiceClient()
  - uploads photos (anon INSERT)       - fetches report data
  - inserts reports/items (anon        - calls createSignedUrl() per photo path
    INSERT)                            - passes { signedUrls } as prop
       |                                       |
  Supabase Storage                    Client Component
  (private bucket)                    - renders <img src={signedUrl}>
  - accepts anon INSERT               - Export PDF/CSV buttons
  - rejects anon GET (403)                    |
  - service role: full access          [GET /api/export route handler]
                                       - verifies mgr-session cookie
                                       - createServiceClient()
                                       - fetches all report data
                                       - calls createSignedUrls() in batch
                                       - returns JSON { reports, signedUrlMap }
                                               |
                                       jsPDF in browser
                                       - loadImg(signedUrl) — no crossOrigin issues
                                       - canvas → addImage → save
```

### Recommended Project Structure additions

```
app/
├── api/
│   └── export/
│       └── route.ts      # GET handler — fetches data + generates signed URLs
├── reports/
│   ├── page.tsx          # server component — add signed URL generation
│   ├── ReportsClient.tsx # client component — remove fetchAllDetailed, use API route
│   └── [id]/
│       ├── page.tsx      # server component — add signed URL generation
│       └── ReportDetailClient.tsx  # client component — receives signed URLs as props
```

### Pattern 1: Server-Side Signed URL Generation (STG-02)

**What:** Server component fetches report data, calls `createSignedUrls()` for all photo paths, passes signed URLs as props to client component.

**When to use:** Any page that renders photos as part of SSR (report detail, reports list thumbnails).

```typescript
// In app/reports/[id]/page.tsx (server component)
// Source: Supabase JS reference + project pattern from lib/supabase.ts
import { createServiceClient, PHOTO_BUCKET } from "@/lib/supabase";

export default async function ReportDetailPage({ params }) {
  const { id } = await params;
  const db = createServiceClient();

  const { data } = await db
    .from("reports")
    .select("..., report_items(id, photo_path, ...)")
    .eq("id", id)
    .single();

  // Collect all photo paths across all items
  const allPaths: string[] = [];
  for (const item of data.report_items ?? []) {
    if (item.photo_path) {
      allPaths.push(...item.photo_path.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
    }
  }

  // Batch generate signed URLs — 1-hour TTL (3600 seconds)
  const signedUrlMap: Record<string, string> = {};
  if (allPaths.length > 0) {
    const { data: signed } = await db.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(allPaths, 3600);
    for (const item of signed ?? []) {
      if (item.signedUrl) signedUrlMap[item.path] = item.signedUrl;
    }
  }

  return <ReportDetailClient rep={data} signedUrlMap={signedUrlMap} />;
}
```

### Pattern 2: Export Route Handler — Gap Fix + STG-03/STG-04

**What:** `GET /api/export` route handler that verifies the session cookie, fetches all report data via service role, generates batch signed URLs, returns JSON. Replaces the broken `fetchAllDetailed()` in `ReportsClient.tsx`.

**When to use:** PDF/CSV export from the manager reports list (client-side jsPDF needs data + signed URLs).

```typescript
// app/api/export/route.ts
// Source: Next.js 16 route.md docs (params is Promise); project session pattern
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, PHOTO_BUCKET } from "@/lib/supabase";
import { verifySession, getSessionFromRequest } from "@/lib/session";

export async function GET(request: NextRequest) {
  // Verify session — same guard as deleteReportAction
  const token = getSessionFromRequest(request.cookies);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const valid = await verifySession(token);
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse report IDs from query param: ?ids=id1,id2,...
  const ids = request.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json({ reports: [], signedUrlMap: {} });

  const db = createServiceClient();
  const { data, error } = await db
    .from("reports")
    .select("id, worker_name, created_at, rooms(number), report_items(id, status, note, photo_path, checklist_items(label, category))")
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Collect all photo paths
  const allPaths: string[] = [];
  for (const r of data ?? []) {
    for (const item of r.report_items ?? []) {
      if (item.photo_path) {
        allPaths.push(...item.photo_path.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
      }
    }
  }

  // Batch generate signed URLs — 1-hour TTL
  const signedUrlMap: Record<string, string> = {};
  if (allPaths.length > 0) {
    const { data: signed } = await db.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(allPaths, 3600);
    for (const item of signed ?? []) {
      if (item.signedUrl) signedUrlMap[item.path] = item.signedUrl;
    }
  }

  return NextResponse.json({ reports: data ?? [], signedUrlMap });
}
```

### Pattern 3: Client Component Consuming Signed URLs

**What:** Client component receives `signedUrlMap: Record<string, string>` as a prop. Replaces all `supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl` calls.

```typescript
// In ReportDetailClient.tsx — replace getPublicUrl with prop lookup
// Before (broken after bucket goes private):
const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl;

// After (receives signedUrlMap from server component or export route):
const url = signedUrlMap[p] ?? ""; // empty string = image won't render (acceptable)
```

### Pattern 4: jsPDF Photo Loading with Signed URLs (STG-03)

**What:** `loadImg()` in jsPDF export already uses `img.crossOrigin = "anonymous"`. Signed URLs from Supabase Storage work with this pattern — no CORS issue.

**Why no CORS issue:** Supabase Storage signed URLs are served from `[project].supabase.co` with CORS headers that allow browser fetch/image loading. [VERIFIED: community research, multiple sources confirm `crossOrigin = "anonymous"` works with Supabase signed URLs]

**Change needed:** The `loadImg(url)` call in both `exportAllPdf` (ReportsClient) and `exportPdf` (ReportDetailClient) already works — just needs the URL source to change from `getPublicUrl` to the signed URL from the export API or prop.

### Anti-Patterns to Avoid

- **Calling `createSignedUrl` from a client component:** The anon key cannot call `createSignedUrl` on a private bucket without a SELECT policy. Even with a SELECT policy, signed URL generation from the client would expose the anon key's reach. Always generate server-side.
- **Adding a SELECT policy on `storage.objects` for anon:** This would allow any unauthenticated user to generate signed URLs — defeating the purpose of a private bucket. The SELECT policy must stay removed.
- **Using `getPublicUrl` after making bucket private:** Returns a URL that 403s. Must replace every call.
- **Calling `fetchAllDetailed()` with anon client after RLS:** RLS blocks anon reads on `reports`. This is the documented gap from Phase 2 Plan C — Phase 3 must fix it.
- **Keeping `"anon can delete photos"` policy:** Workers should not be able to delete photos. `deleteReportAction` uses service role. This policy is safe to drop.
- **Generating signed URLs one-by-one in a loop:** Use `createSignedUrls` (plural) for batch generation. A report with 200 items × 5 photos = 1000 paths; batch is essential.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Signed URL generation | Custom token signing/HMAC URL | `supabase.storage.from().createSignedUrls()` | Supabase handles signing, TTL, CORS headers |
| Batch signed URLs | N×1 `createSignedUrl` calls in a loop | `createSignedUrls(paths[], 3600)` | Single API call; avoids N database round-trips |
| Session verification in route handler | Re-implementing JWT checks | `getSessionFromRequest(request.cookies)` + `verifySession()` from `lib/session.ts` | Already tested pattern from Phase 2 |
| Export data fetch | New Supabase client with anon key | `createServiceClient()` in route handler | Anon key blocked by RLS after Phase 2 Plan D |

**Key insight:** All signed URL generation flows through `createServiceClient()` (service role). Zero additional auth config needed — service role bypasses RLS automatically.

---

## Common Pitfalls

### Pitfall 1: `getPublicUrl` Returns a URL That 403s After Bucket Goes Private

**What goes wrong:** `getPublicUrl()` always returns a URL string even if the bucket is private — it does not throw. The URL appears valid but returns 403 when fetched.
**Why it happens:** `getPublicUrl` is a client-side URL constructor (no API call), so it cannot detect bucket privacy.
**How to avoid:** Replace every `getPublicUrl` call before making the bucket private. Search the codebase for `getPublicUrl` — currently 4 locations: `ReportsClient.tsx` (CSV + PDF), `ReportDetailClient.tsx` (render + CSV + PDF).
**Warning signs:** Photos render blank, PDF/CSV photo columns are broken URLs.

### Pitfall 2: `fetchAllDetailed()` Breaks After Plan D RLS

**What goes wrong:** `fetchAllDetailed()` in `ReportsClient.tsx` uses the public anon `supabase` client to query `reports`. Phase 2 Plan D applied RLS that blocks anon SELECT on `reports`. Export buttons silently fail or throw.
**Why it happens:** Documented known gap from Phase 2 Plan C — the gap closure was deferred to Phase 3.
**How to avoid:** Replace `fetchAllDetailed()` with a fetch call to `GET /api/export?ids=...` which uses the service role client.
**Warning signs:** Export buttons show an error or produce empty CSV/PDF.

### Pitfall 3: Signed URLs Expire — Short TTL Causes Broken Images in Long Sessions

**What goes wrong:** A manager opens the reports page, leaves for 2 hours, comes back — the signed URLs (1-hour TTL) have expired, images 404.
**Why it happens:** Signed URLs are static strings passed as SSR props; they don't auto-refresh.
**How to avoid:** 3600 seconds (1 hour) is the requirement from STG-02 and is appropriate. The page is SSR — each navigation regenerates fresh signed URLs. For the export route handler, signed URLs are generated at request time, so export flows are always fresh. No special refresh mechanism needed.
**Warning signs:** `<img>` tags show broken image after a long session without navigation.

### Pitfall 4: Route Handler in Next.js 16 — `params` Must Be Awaited

**What goes wrong:** `const { id } = context.params` in a route handler causes a TypeScript error or runtime crash.
**Why it happens:** Next.js 16 makes `params` a `Promise<{...}>` in route handlers, same as page components.
**How to avoid:** Use `const { id } = await params` in route handler context.
**Warning signs:** TypeScript compile error on `params.id` access.

### Pitfall 5: Route Handler Session Check — Must Use `request.cookies` Not `next/headers`

**What goes wrong:** Calling `cookies()` from `next/headers` in a route handler may not behave as expected in Next.js 16 (it works in server components but the `proxy.ts` already shows this distinction).
**Why it happens:** The project's established pattern (`getSessionFromRequest(request.cookies)`) exists precisely because `next/headers` isn't always available in middleware-like contexts.
**How to avoid:** Use `getSessionFromRequest(request.cookies)` + `verifySession()` — the same pattern as `proxy.ts`.
**Warning signs:** Session verification always returns false despite valid cookie.

### Pitfall 6: `createSignedUrls` Return Shape — `item.path` vs `item.signedUrl`

**What goes wrong:** Code assumes `data[i]` is just a string URL; actually it's an object with `{ path, signedUrl, error }`.
**Why it happens:** The plural method returns an array of objects, not an array of strings.
**How to avoid:** Iterate `for (const item of signed ?? []) { if (item.signedUrl) map[item.path] = item.signedUrl; }`.
**Warning signs:** `signedUrlMap` is populated with undefined values; TypeScript errors on string indexing.

### Pitfall 7: Proxy Matcher Gates Worker Routes

**What goes wrong:** The `proxy.ts` matcher currently gates ALL routes (including `/check/*`, `/rooms`) — not just `/reports/*`. This means workers need a valid `mgr-session` cookie to access the check pages.
**Why it happens:** The proxy matcher is `/((?!login|_next/static|...).*)`  — it matches everything.
**How to avoid:** Phase 3 does NOT need to fix this (out of scope), but the planner should be aware: worker check pages are currently behind the manager auth gate (this may be intentional for the app's deployment context). Do not add new route patterns to the proxy matcher as part of Phase 3.
**Warning signs:** Workers get redirected to `/login` — this pre-exists Phase 3.

---

## Code Examples

### STG-01: Make Bucket Private (SQL)

```sql
-- Source: [VERIFIED] Supabase discussion #23840 + current bucket state on cnqotgwqqxiqforchuux

-- 1. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'checklist-photos';

-- 2. Remove anon SELECT (anyone can view photos) — no longer valid for private bucket
DROP POLICY IF EXISTS "anyone can view photos" ON storage.objects;

-- 3. Remove anon DELETE — server action uses service role; workers should not delete
DROP POLICY IF EXISTS "anon can delete photos" ON storage.objects;

-- 4. Keep INSERT policy — workers still upload photos via anon key
-- "anon can upload photos" policy on storage.objects stays unchanged
```

### STG-02: `createSignedUrls` — Batch Generation

```typescript
// Source: Supabase JS reference (storage-from-createsignedurls)
// Returns: Array<{ path: string, signedUrl: string, error: string | null }>
const { data: signed, error } = await db.storage
  .from(PHOTO_BUCKET)
  .createSignedUrls(allPaths, 3600); // 3600 = 1 hour

const signedUrlMap: Record<string, string> = {};
for (const item of signed ?? []) {
  if (item.signedUrl) signedUrlMap[item.path] = item.signedUrl;
}
// Usage: signedUrlMap["reports/abc/item-0.jpg"] === "https://...?token=..."
```

### STG-02: Replacing `getPublicUrl` in Client Components

**Before (4 locations to replace):**
```typescript
// ReportsClient.tsx line 146 (CSV), lines 265 (PDF)
// ReportDetailClient.tsx line 43 (CSV), line 129 (PDF render), line 173 (img tag)
const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl;
```

**After:**
```typescript
// signedUrlMap received as prop from server component or export API response
const url = signedUrlMap[p] ?? "";
```

### ReportDetailClient.tsx — New Props Interface

```typescript
// Add signedUrlMap prop; remove supabase import (no longer needed for photo URLs)
export default function ReportDetailClient({
  rep,
  signedUrlMap,
}: {
  rep: Detail;
  signedUrlMap: Record<string, string>;
}) { ... }
```

### ReportsClient.tsx — Export Flow Change

```typescript
// Replace fetchAllDetailed() with API route call
async function fetchExportData(): Promise<{ reports: any[]; signedUrlMap: Record<string, string> }> {
  const ids = filtered.map((r) => r.id);
  if (ids.length === 0) return { reports: [], signedUrlMap: {} };
  const res = await fetch(`/api/export?ids=${ids.join(",")}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

## Gap Fix: `fetchAllDetailed` + Export (Known Phase 2 Gap)

This is the primary architectural change in Phase 3 beyond the storage policy update.

**Current state (broken after RLS):**
- `fetchAllDetailed()` in `ReportsClient.tsx` uses the anon `supabase` client
- Anon key cannot `SELECT` from `reports` after Phase 2 Plan D RLS
- `getPublicUrl()` calls break after STG-01 makes bucket private

**Fix:** Create `app/api/export/route.ts` as a `GET` route handler that:
1. Verifies `mgr-session` cookie
2. Accepts `?ids=id1,id2,...` query param
3. Uses `createServiceClient()` to fetch full report data (bypasses RLS)
4. Calls `createSignedUrls()` for all photo paths (service role, no policy needed)
5. Returns `{ reports, signedUrlMap }` JSON

**Why route handler over server action:** Server actions are `POST`-only and meant for form/mutation flows. An export endpoint is a `GET` request returning structured data — route handler is the correct Next.js primitive. [CITED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md]

**Why not pass data from server component:** `ReportsClient.tsx` only receives the summary `ReportRow[]` (no `report_items` detail). Fetching all item detail for 200 reports at SSR time is memory-intensive and unnecessary for most page views. On-demand fetch from the export button is the right pattern.

---

## Storage Policy Change Impact on Worker Upload

Worker uploads in `app/check/[roomId]/page.tsx` use:
```typescript
await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: true });
```

This is an INSERT operation. The `"anon can upload photos"` policy (INSERT, anon role) is kept. **Worker uploads continue to work after STG-01.** [VERIFIED: current policy state on test project]

The `delete-report.ts` server action uses `createServiceClient()` for storage removes. **Report deletion continues to work after dropping the anon DELETE policy.** [VERIFIED: delete-report.ts code]

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is code and storage config changes only. No new external tools or services required beyond what Phase 1-2 already use.

---

## Validation Architecture

Step 4: SKIPPED — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not changed by this phase |
| V3 Session Management | yes | Existing `mgr-session` cookie verified in route handler (same as server actions) |
| V4 Access Control | yes | Private bucket + service role key only for signed URL generation |
| V5 Input Validation | yes | `ids` query param sanitized (split on comma, filter empty strings) |
| V6 Cryptography | no | Supabase handles URL signing; no custom crypto |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated export endpoint | Elevation of Privilege | `getSessionFromRequest` + `verifySession` as first check in route handler |
| `ids` query param injection (SQL `IN` clause) | Tampering | Supabase client uses parameterized queries; `.in("id", ids)` is safe |
| Signed URL leakage via CSV/PDF download | Information Disclosure | 1-hour TTL limits exposure window; acceptable for internal tool |
| Anon key still allows storage SELECT via URL bypass | Information Disclosure | DROP `"anyone can view photos"` policy; private bucket returns 403 on direct URL |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crossOrigin = "anonymous"` works with Supabase signed URLs for canvas operations (jsPDF) | Code Examples | PDF export photos fail with tainted canvas error; mitigation: proxy image through route handler |
| A2 | The proxy.ts matcher intentionally gates worker check pages (by design, not a bug) | Common Pitfalls #7 | Workers cannot access check pages; fix would require changing proxy matcher — out of scope for Phase 3 |
| A3 | `createSignedUrls` (plural) response shape is `{ path, signedUrl, error }[]` | Code Examples | signedUrlMap would be wrong; verify with `@supabase/supabase-js` TypeScript types at implementation time |

---

## Open Questions

1. **Does the proxy.ts matcher intentionally block worker check pages?**
   - What we know: The matcher `/((?!login|_next/static|...).*)`  catches `/check/*` and `/rooms`
   - What's unclear: Whether this is a Phase 2 design intent or an oversight. The Phase 2 CONTEXT says "Gate `/reports` and `/reports/*`" but the implemented matcher is broader.
   - Recommendation: Do not change this in Phase 3 — it's pre-existing. Note for post-project review.

2. **Report list photos — does the reports list (`/reports`) show photos?**
   - What we know: `ReportsClient.tsx` shows a table of reports with no thumbnail — no photo render in the list view. `ReportRow` type has no `photo_path`.
   - What's unclear: Whether STG-02 requires signed URLs in the list view or only in detail view and exports.
   - Recommendation: STG-02 only applies where photos are actually rendered. The list view has no photos — only report detail and exports need signed URLs.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npx supabase db query cnqotgwqqxiqforchuux] — current bucket `public: true`, 3 policies confirmed
- [VERIFIED: npm registry] — `@supabase/supabase-js` 2.105.3
- [CITED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md] — Route Handler API, `params` as Promise
- [CITED: app/actions/delete-report.ts] — `createServiceClient()` pattern for server-side storage ops
- [CITED: proxy.ts] — `getSessionFromRequest()` pattern for route handler session verification
- [CITED: lib/supabase.ts] — `createServiceClient()` implementation

### Secondary (MEDIUM confidence)
- [Supabase Docs — Storage Serving Downloads](https://supabase.com/docs/guides/storage/serving/downloads) — private bucket requires signed URL or JWT-auth download
- [Supabase JS Reference — createSignedUrls](https://supabase.com/docs/reference/javascript/storage-from-createsignedurls) — batch API, parameters, return shape
- [Supabase Discussion #23840](https://github.com/orgs/supabase/discussions/23840) — service_role bypasses RLS; no explicit storage policy needed for service role; "unless you add a policy to public, anon or authenticated, they will have NO access"

### Tertiary (LOW confidence — see Assumptions Log)
- Multiple community sources on `crossOrigin = "anonymous"` with Supabase signed URLs for canvas operations

---

## Metadata

**Confidence breakdown:**
- Storage policy changes: HIGH — confirmed current state via SQL query on test project
- `createSignedUrl` / `createSignedUrls` API: HIGH — official JS reference verified
- Service role bypasses RLS: HIGH — multiple official sources confirm
- CORS / canvas / jsPDF: MEDIUM — community-verified but not tested in this project
- Route handler session pattern: HIGH — based on existing `proxy.ts` + `getSessionFromRequest` in project

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (30-day estimate; Supabase Storage API is stable)
