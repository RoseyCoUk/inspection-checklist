---
phase: 02-auth-row-level-security
plan: C
type: execute
wave: 2
depends_on: [A]
files_modified:
  - app/reports/page.tsx
  - app/reports/ReportsClient.tsx
  - app/reports/[id]/page.tsx
  - app/actions/delete-report.ts
autonomous: true
requirements:
  - SEC-04
  - SEC-03

must_haves:
  truths:
    - "app/reports/page.tsx is an async server component — no 'use client' directive, no useEffect, no useState"
    - "app/reports/[id]/page.tsx is an async server component — no 'use client' directive, no useEffect, no useState"
    - "All Supabase queries in the reports pages use createServiceClient() (service-role key), not the anon supabase singleton"
    - "The delete button calls deleteReportAction(id) server action — no client-side supabase.from('reports').delete() call remains"
    - "deleteReportAction verifies the mgr-session cookie before executing any delete"
    - "A delete failure shows an inline error matching the setErr() pattern from app/check/[roomId]/page.tsx"
    - "The browser confirm() dialog still appears before delete (D-10)"
    - "Export CSV and Export PDF buttons still work — they live in a 'use client' component with their own supabase calls using the public client"
  artifacts:
    - path: "app/reports/page.tsx"
      provides: "Async server component — fetches reports via service-role client, renders ReportsClient with data"
      contains: "createServiceClient"
    - path: "app/reports/ReportsClient.tsx"
      provides: "Client component — all filter state, sort state, CSV/PDF export, delete button"
      contains: "use client"
    - path: "app/reports/[id]/page.tsx"
      provides: "Async server component — fetches single report via service-role client"
      contains: "createServiceClient"
    - path: "app/actions/delete-report.ts"
      provides: "deleteReportAction server action — verifies session, deletes storage objects, then DB row"
      contains: "deleteReportAction"
  key_links:
    - from: "app/reports/page.tsx (server)"
      to: "createServiceClient() query"
      via: "direct await in async server component body"
      pattern: "createServiceClient"
    - from: "ReportsClient delete button"
      to: "deleteReportAction(r.id)"
      via: "onClick handler — replaces the current client-side supabase.delete()"
      pattern: "deleteReportAction"
    - from: "deleteReportAction"
      to: "getSession() from lib/session.ts"
      via: "session check before any DB mutation"
      pattern: "getSession"
---

<objective>
Convert `app/reports/page.tsx` and `app/reports/[id]/page.tsx` from `"use client"` components to async server components that fetch data via the service-role client. Extract all interactive UI into `app/reports/ReportsClient.tsx` (a new `"use client"` file). Create `app/actions/delete-report.ts` as the server action that replaces the current client-side delete.

Purpose: Server components can use SUPABASE_SERVICE_ROLE_KEY securely. The client-side delete path using the anon key must be completely removed — it is the primary security hole (SEC-04). RLS in Plan D will block anon-key deletes at the DB level as defence-in-depth.

Output: Two async server component pages, one new ReportsClient client component, and the deleteReportAction server action.
</objective>

<execution_context>
@C:/Users/watkb/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/watkb/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-auth-row-level-security/02-CONTEXT.md

AGENTS.md note: Next.js 16 async server component patterns. `params` in dynamic routes is `Promise<{ id: string }>` — must be awaited. See `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` lines 39-55:
```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
```

Server components: no `useState`, no `useEffect`, no `'use client'` directive, no event handlers. All of these must be in the extracted ReportsClient.tsx client component.

`cookies()` from `next/headers` is async in Next.js 16.
</context>

<interfaces>
<!-- Current app/reports/page.tsx — key sections for migration -->

Types in scope (copy to ReportsClient.tsx):
```typescript
type BadItem = { category: string; label: string };
type Row = {
  id: string;
  worker_name: string;
  created_at: string;
  rooms: { number: string } | null;
  bad_count: number;
  bad_items: BadItem[];
};
const CATEGORY_LABELS: Record<string, string> = { paint, wallpaper, aluminum, electrical, hk, mechanical, plumbing, furniture, cleaning, other };
```

Current data fetch (lines 305-332 of app/reports/page.tsx) — move to server component:
```typescript
const { data, error } = await supabase
  .from("reports")
  .select("id, worker_name, created_at, rooms(number), report_items(status, checklist_items(label, category))")
  .order("created_at", { ascending: false })
  .limit(200);
```

Current delete logic (lines 437-474 of app/reports/page.tsx) — replace with deleteReportAction call:
```typescript
// Current (client-side, must be removed):
const { error } = await supabase.from("reports").delete().eq("id", r.id);
if (error) { alert(error.message); return; }
```

<!-- app/reports/[id]/page.tsx — current fetch to move to server component -->
```typescript
const { data, error } = await supabase
  .from("reports")
  .select("id, worker_name, created_at, rooms(number), report_items(id, status, note, photo_path, checklist_items(label))")
  .eq("id", id)
  .single();
```

<!-- createServiceClient signature (from Plan A, lib/supabase.ts) -->
```typescript
export function createServiceClient(): SupabaseClient
// Returns a fresh Supabase client using SUPABASE_SERVICE_ROLE_KEY
// Import in server components only: import { createServiceClient } from "@/lib/supabase"
```

<!-- getSession signature (from Plan A, lib/session.ts) -->
```typescript
export async function getSession(): Promise<boolean>
// Returns true if mgr-session cookie is valid, false otherwise
// Used in deleteReportAction to verify auth before delete
```

<!-- setErr() pattern from app/check/[roomId]/page.tsx (D-11) -->
```typescript
const [err, setErr] = useState<string | null>(null);
// ...
{err && <p style={{ color: "var(--red)" }}>{err}</p>}
// On delete failure: setErr(result.error)
```

<!-- deleteReportAction return shape (D-11, D-12) -->
```typescript
// Returns:
{ error: string }   // on auth failure or delete failure — caller calls setErr()
{ ok: true }         // on success — caller removes row from local state
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task C-1: Create app/actions/delete-report.ts server action</name>
  <files>app/actions/delete-report.ts</files>
  <read_first>
  - app/reports/page.tsx — read the full delete button onClick handler (lines 437-474) to understand what the action must replicate
  - lib/session.ts — confirm getSession() function signature (created in Plan A)
  - lib/supabase.ts — confirm createServiceClient() function and PHOTO_BUCKET exports (from Plan A)
  - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md — lines 37-55 for 'use server' at file top pattern
  </read_first>
  <action>
Create `app/actions/delete-report.ts` (new file):

```typescript
"use server";

import { getSession } from "@/lib/session";
import { createServiceClient, PHOTO_BUCKET } from "@/lib/supabase";

export type DeleteResult = { error: string } | { ok: true };

export async function deleteReportAction(reportId: string): Promise<DeleteResult> {
  // D-12: Verify session before any mutation.
  // proxy.ts already blocked unauthenticated access to the page,
  // but server actions are reachable via direct POST — always verify inside.
  const authenticated = await getSession();
  if (!authenticated) {
    return { error: "Session expired — please log in again." };
  }

  const db = createServiceClient();

  // Step 1: Fetch photo_paths for all items in this report
  const { data: items, error: fetchErr } = await db
    .from("report_items")
    .select("photo_path")
    .eq("report_id", reportId);

  if (fetchErr) {
    return { error: fetchErr.message };
  }

  // Step 2: Collect all storage object paths (same logic as current client-side code)
  const storagePaths: string[] = [];
  for (const item of items ?? []) {
    if (item.photo_path) {
      const paths = item.photo_path
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      storagePaths.push(...paths);
    }
  }

  // Step 3: Delete storage objects before the DB row (BUG-06 pattern from Phase 1)
  if (storagePaths.length > 0) {
    const { error: storageErr } = await db.storage
      .from(PHOTO_BUCKET)
      .remove(storagePaths);
    if (storageErr) {
      // Non-blocking — orphan files preferable to stuck UI (Phase 1 decision)
      console.warn("Storage delete partial failure:", storageErr.message);
    }
  }

  // Step 4: Delete the DB row (cascade removes report_items)
  const { error: deleteErr } = await db
    .from("reports")
    .delete()
    .eq("id", reportId);

  if (deleteErr) {
    return { error: deleteErr.message };
  }

  return { ok: true };
}
```
  </action>
  <verify>
    <automated>grep -c "deleteReportAction" app/actions/delete-report.ts && grep -c "getSession" app/actions/delete-report.ts</automated>
  </verify>
  <acceptance_criteria>
    - `app/actions/delete-report.ts` exists and starts with `"use server"` as the first line
    - File exports `deleteReportAction` function and `DeleteResult` type
    - File imports `getSession` from `"@/lib/session"`
    - File imports `createServiceClient` from `"@/lib/supabase"` (not the anon `supabase` singleton)
    - File calls `getSession()` before any Supabase mutation
    - File returns `{ error: "Session expired — please log in again." }` when session is invalid
    - File returns `{ error: deleteErr.message }` on DB delete failure
    - File returns `{ ok: true }` on success
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>app/actions/delete-report.ts created as a server action that verifies session, deletes storage objects, then deletes the DB row</done>
</task>

<task type="auto">
  <name>Task C-2: Convert reports/page.tsx to server component and create ReportsClient.tsx</name>
  <files>app/reports/page.tsx, app/reports/ReportsClient.tsx</files>
  <read_first>
  - app/reports/page.tsx — read the FULL file (498 lines) before writing anything. This is a complete rewrite of the page and an extraction of most logic into ReportsClient.tsx
  - app/reports/[id]/page.tsx — read this too, as it also moves to a server component (Task C-3)
  - app/actions/delete-report.ts — confirm deleteReportAction and DeleteResult type (created in Task C-1)
  - lib/supabase.ts — confirm createServiceClient() export
  - node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md — lines 34-76 for the server/client component composition pattern
  </read_first>
  <action>
This task involves two writes:

**1. Rewrite app/reports/page.tsx as an async server component:**

The new server component fetches reports via service-role client and passes them as props to `ReportsClient`.

```typescript
// app/reports/page.tsx — async server component (no "use client")
import { createServiceClient } from "@/lib/supabase";
import ReportsClient from "./ReportsClient";

type BadItem = { category: string; label: string };
export type ReportRow = {
  id: string;
  worker_name: string;
  created_at: string;
  rooms: { number: string } | null;
  bad_count: number;
  bad_items: BadItem[];
};

export default async function ReportsPage() {
  const db = createServiceClient();
  const { data, error } = await db
    .from("reports")
    .select("id, worker_name, created_at, rooms(number), report_items(status, checklist_items(label, category))")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <main>
        <div className="card">
          <p style={{ color: "var(--red)" }}>Error loading reports: {error.message}</p>
        </div>
      </main>
    );
  }

  const rows: ReportRow[] = (data ?? []).map((r: any) => {
    const bad = (r.report_items ?? [])
      .filter((i: any) => i.status === "bad")
      .map((i: any) => ({
        category: i.checklist_items?.category ?? "other",
        label: i.checklist_items?.label ?? "",
      }));
    return {
      id: r.id,
      worker_name: r.worker_name,
      created_at: r.created_at,
      rooms: r.rooms,
      bad_count: bad.length,
      bad_items: bad,
    };
  });

  return <ReportsClient initialRows={rows} />;
}
```

**2. Create app/reports/ReportsClient.tsx as a client component:**

This file takes everything that was previously in `app/reports/page.tsx` that requires client-side interactivity: all useState, useMemo, filter logic, sort logic, export functions (CSV/PDF), and the delete button. The key changes:

- Delete button calls `deleteReportAction(r.id)` instead of `supabase.from("reports").delete()`
- Delete error shown via `setErr()` pattern (D-11) — inline `<p style={{ color: "var(--red)" }}>` below the table, not `alert()`
- Keep the `confirm("Delete this report?")` browser dialog (D-10)
- Export functions (CSV/PDF) still use the public `supabase` client for `getPublicUrl` — these do not need service-role access for read-only URL generation

```typescript
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, PHOTO_BUCKET } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import LangToggle from "../LangToggle";
import { deleteReportAction } from "@/app/actions/delete-report";
import type { ReportRow } from "./page";

type BadItem = { category: string; label: string };

const CATEGORY_LABELS: Record<string, string> = {
  paint: "Paint",
  wallpaper: "Wallpaper",
  aluminum: "Aluminum",
  electrical: "Electrical",
  hk: "HK",
  mechanical: "Mechanical",
  plumbing: "Plumbing",
  furniture: "Furniture",
  cleaning: "Cleaning",
  other: "Other",
};

export default function ReportsClient({ initialRows }: { initialRows: ReportRow[] }) {
  const [rows, setRows] = useState<ReportRow[]>(initialRows);
  const [err, setErr] = useState<string | null>(null);           // D-11: inline delete error
  const [exporting, setExporting] = useState<null | "csv" | "pdf">(null);
  const [progress, setProgress] = useState(0);
  const [filterRoom, setFilterRoom] = useState("");
  const [filterWorker, setFilterWorker] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "clean" | "issues">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<"date" | "room" | "worker" | "issues">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterIssue, setFilterIssue] = useState("");
  const t = useT();

  // --- Copy all useMemo, filter, sort, CSV/PDF export logic verbatim from current page.tsx ---
  // (fetchAllDetailed, exportAllCsv, exportAllPdf, rooms, workers, issueLabels,
  //  matchingBadCount, categoryOptions, filtered, toggleSort, clearFilters, photoPathsFor,
  //  itemPassesFilter — all move here unchanged from the current page.tsx)
  //
  // IMPORTANT: fetchAllDetailed uses the public `supabase` client — this is fine because
  // it only reads data and the proxy gate already verified the manager session.
  // The RLS policy for reports will allow service-role reads; public reads of reports
  // will be blocked by RLS (Plan D). Since the export functions run client-side behind
  // the proxy gate (authenticated browser session), they need the anon key for URL generation
  // only. Actually fetchAllDetailed does a Supabase query — after Plan D RLS is applied,
  // anon key cannot read reports. THEREFORE: fetchAllDetailed must use a fetch call to
  // a server route, or the export must be refactored.
  //
  // PRACTICAL RESOLUTION for this plan: Keep fetchAllDetailed using the anon supabase client
  // for now — it will break when Plan D RLS is applied. Plan D's success criteria includes
  // validating this. The executor should note this dependency in the SUMMARY and it will
  // be addressed in Plan D or as a gap closure. The primary goal of THIS plan is removing
  // the client-side DELETE and converting the page to a server component.
  //
  // THEREFORE: Copy fetchAllDetailed, exportAllCsv, exportAllPdf verbatim from page.tsx.

  // DELETE button handler — replaces client-side supabase.delete() (D-10, D-11, D-12)
  async function handleDelete(id: string) {
    // D-10: Keep confirm() browser dialog
    if (!confirm("Delete this report?")) return;
    setErr(null);

    const result = await deleteReportAction(id);
    if ("error" in result) {
      // D-11: Inline error, not alert()
      setErr(result.error);
      return;
    }
    // On success: remove row from local state
    setRows((rs) => rs.filter((x) => x.id !== id));
  }

  // Render: copy JSX from current page.tsx, replacing:
  // 1. The onClick delete handler → call handleDelete(r.id) instead of the inline async fn
  // 2. Add inline error display below the card (D-11):
  //    {err && <p style={{ color: "var(--red)", marginTop: 8 }}>{err}</p>}
  // 3. Remove the loading/err state from the top-level (server component handles errors now)
  // 4. Remove the useEffect that fetched data (data comes as props now)
  //
  // Return the full JSX from current page.tsx, adapted as described above.
}
```

IMPORTANT EXECUTOR INSTRUCTION: Copy the body of the useMemo hooks, filter logic, sort logic, and CSV/PDF export functions verbatim from the current `app/reports/page.tsx`. Do not rewrite logic — only restructure. The delete handler is the primary behavioral change. After writing `ReportsClient.tsx`, ensure `app/reports/page.tsx` is the minimal async server component shown above — not a hybrid.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `app/reports/page.tsx` does NOT contain `"use client"` directive
    - `app/reports/page.tsx` does NOT contain `useState`, `useEffect`, `useMemo`, `useT`
    - `app/reports/page.tsx` contains `import { createServiceClient }` from `"@/lib/supabase"`
    - `app/reports/page.tsx` contains `export default async function ReportsPage()`
    - `app/reports/ReportsClient.tsx` exists and starts with `"use client"`
    - `app/reports/ReportsClient.tsx` contains `import { deleteReportAction }` from `"@/app/actions/delete-report"`
    - `app/reports/ReportsClient.tsx` does NOT contain `supabase.from("reports").delete()` — the client-side delete call is gone
    - `app/reports/ReportsClient.tsx` contains `deleteReportAction(` call
    - `app/reports/ReportsClient.tsx` contains `setErr` for inline error display (D-11)
    - `app/reports/ReportsClient.tsx` contains `confirm("Delete this report?")` browser dialog (D-10)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>app/reports/page.tsx is an async server component; ReportsClient.tsx handles all interactivity; client-side supabase delete removed and replaced with deleteReportAction</done>
</task>

<task type="auto">
  <name>Task C-3: Convert app/reports/[id]/page.tsx to async server component</name>
  <files>app/reports/[id]/page.tsx</files>
  <read_first>
  - app/reports/[id]/page.tsx — read the FULL file (233 lines) before writing. All export functions (CSV/PDF) and photo rendering use the public client — keep these in a client component.
  - node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md — lines 39-55 for `params: Promise<{ id: string }>` async params pattern
  - lib/supabase.ts — confirm createServiceClient() export
  </read_first>
  <action>
Rewrite `app/reports/[id]/page.tsx` as an async server component + extract client-side detail view.

The current file is 233 lines with export CSV/PDF functions using Canvas, Image, and jsPDF — these are browser APIs that CANNOT run on the server. The pattern is:
- Server component (`ReportDetailPage`): fetches report data using service-role client, passes to client component
- Client component (`ReportDetailClient`, inline in same file using the split-file pattern, OR extracted to `app/reports/[id]/ReportDetailClient.tsx`): renders the UI with export buttons

APPROACH: Use a separate client component file `app/reports/[id]/ReportDetailClient.tsx` — the detail page has substantial client-only code (PDF/CSV export with canvas). This keeps the server component clean.

For `app/reports/[id]/page.tsx`:
```typescript
// app/reports/[id]/page.tsx — async server component (no "use client")
import { createServiceClient } from "@/lib/supabase";
import ReportDetailClient from "./ReportDetailClient";

type Detail = {
  id: string;
  worker_name: string;
  created_at: string;
  rooms: { number: string } | null;
  report_items: {
    id: string;
    status: "good" | "bad";
    note: string | null;
    photo_path: string | null;
    checklist_items: { label: string } | null;
  }[];
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;   // Next.js 16: params is a Promise, must await
}) {
  const { id } = await params;

  const db = createServiceClient();
  const { data, error } = await db
    .from("reports")
    .select("id, worker_name, created_at, rooms(number), report_items(id, status, note, photo_path, checklist_items(label))")
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <main>
        <div className="card">
          <p style={{ color: "var(--red)" }}>
            Error loading report: {error?.message ?? "Not found"}
          </p>
        </div>
      </main>
    );
  }

  return <ReportDetailClient rep={data as unknown as Detail} />;
}
```

For `app/reports/[id]/ReportDetailClient.tsx` (new file):
Copy the entire rendering logic from the current `app/reports/[id]/page.tsx` verbatim, with these changes:
1. Add `"use client"` at the top
2. Replace `const { id } = useParams<{ id: string }>()` + `useEffect` fetch with `{ rep }` props received from server
3. Remove `useState` for `rep` and `err` (data comes as props, errors handled by server)
4. Keep `useParams` removed — id comes from `rep.id` if needed
5. Keep all export CSV/PDF functions unchanged — they still use `supabase.storage.from(PHOTO_BUCKET).getPublicUrl()` which is fine for public read URL generation (no auth needed for URL construction)

```typescript
"use client";
import Link from "next/link";
import { supabase, PHOTO_BUCKET } from "@/lib/supabase";

type Detail = {
  id: string;
  worker_name: string;
  created_at: string;
  rooms: { number: string } | null;
  report_items: {
    id: string;
    status: "good" | "bad";
    note: string | null;
    photo_path: string | null;
    checklist_items: { label: string } | null;
  }[];
};

export default function ReportDetailClient({ rep }: { rep: Detail }) {
  // Copy all code from current page.tsx below the useState declarations:
  // - bad, good filtered arrays
  // - photoPathsFor helper
  // - roomNum, dateStr, fileBase
  // - exportCsv function (verbatim)
  // - exportPdf function (verbatim)
  // - return JSX (verbatim)
  // DO NOT include useEffect, useState for rep/err, useParams — those are removed
}
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `app/reports/[id]/page.tsx` does NOT contain `"use client"` directive
    - `app/reports/[id]/page.tsx` does NOT contain `useEffect`, `useState`, `useParams`
    - `app/reports/[id]/page.tsx` contains `params: Promise<{ id: string }>` and `await params`
    - `app/reports/[id]/page.tsx` contains `createServiceClient()`
    - `app/reports/[id]/page.tsx` contains `export default async function ReportDetailPage`
    - `app/reports/[id]/ReportDetailClient.tsx` exists and starts with `"use client"`
    - `app/reports/[id]/ReportDetailClient.tsx` accepts `{ rep }` prop (not useParams/useEffect fetch)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>app/reports/[id]/page.tsx is an async server component using createServiceClient(); ReportDetailClient.tsx handles rendering with CSV/PDF export</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ReportsClient browser → deleteReportAction | reportId from client is untrusted — action verifies session before operating |
| Server component → createServiceClient() | Service-role key used server-side only; never bundled to client |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02C-01 | Elevation of Privilege | deleteReportAction | mitigate | getSession() verifies mgr-session JWT before any DB mutation; unauthenticated call returns { error } not a delete |
| T-02C-02 | Information Disclosure | createServiceClient in server component | mitigate | SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix — cannot be accessed from client bundle; only used in async server components |
| T-02C-03 | Tampering | Client-side reportId manipulation | accept | RLS in Plan D will block anon-key deletes at DB level; deleteReportAction also verifies session; attacker with a valid session can only delete their own visible reports |
| T-02C-04 | Information Disclosure | Export CSV/PDF using public client | accept | Exports run in authenticated browser session (proxy gate verified); public URL generation for photos does not expose additional data; blocked if RLS applied |
</threat_model>

<verification>
1. `grep -c '"use client"' app/reports/page.tsx` — returns 0 (server component, no use client)
2. `grep -c 'createServiceClient' app/reports/page.tsx` — returns ≥ 1
3. `grep -c '"use client"' app/reports/ReportsClient.tsx` — returns 1
4. `grep -c 'supabase.from.*reports.*delete' app/reports/ReportsClient.tsx` — returns 0 (client-side delete gone)
5. `grep -c 'deleteReportAction' app/reports/ReportsClient.tsx` — returns ≥ 1
6. `grep -c '"use client"' app/reports/[id]/page.tsx` — returns 0
7. `grep -c 'await params' app/reports/[id]/page.tsx` — returns 1
8. `grep -c 'createServiceClient' app/actions/delete-report.ts` — returns ≥ 1
9. `grep -c 'getSession' app/actions/delete-report.ts` — returns ≥ 1
10. `npx tsc --noEmit` — exits 0
</verification>

<success_criteria>
- Both reports pages are async server components using createServiceClient() — no useState/useEffect
- All client interactivity (filters, delete, exports) lives in "use client" components
- deleteReportAction exists as a server action that verifies session before deleting
- No client-side supabase.from("reports").delete() call anywhere in the codebase
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/phases/02-auth-row-level-security/02-C-SUMMARY.md` using the summary template.

Note in SUMMARY: The CSV/PDF export `fetchAllDetailed()` function in ReportsClient.tsx uses the anon supabase client. After Plan D applies RLS (anon cannot read reports), these export functions will fail. This is a known gap — Plan D must either address it or a gap closure plan is needed for export functionality with service-role access.
</output>
