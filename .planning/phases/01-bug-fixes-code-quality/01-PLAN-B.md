---
phase: 01-bug-fixes-code-quality
plan: B
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/schema.sql
autonomous: true
requirements:
  - BUG-03
  - BUG-05
  - BUG-06
  - BUG-12

must_haves:
  truths:
    - "A unique index on report_items(report_id, checklist_item_id) exists in the live database — duplicate inserts are rejected at the DB level"
    - "A CHECK constraint on checklist_items.category accepts only the 8 valid values including wallpaper, aluminum, and hk"
    - "A composite index on reports(room_id, created_at DESC) exists for the hot-path query"
    - "supabase/schema.sql reflects all three migrations accurately"
    - "Deleting a report via the app also deletes its storage objects from checklist-photos before the DB row is removed"
  artifacts:
    - path: "supabase/schema.sql"
      provides: "Updated schema baseline with unique index, CHECK constraint, composite index, and storage-delete comment"
      contains: "report_items_report_item_uniq"
    - path: "app/reports/page.tsx"
      provides: "Storage objects deleted before report DB row delete (BUG-06)"
      contains: "PHOTO_BUCKET"
  key_links:
    - from: "Supabase MCP migration"
      to: "report_items table"
      via: "UNIQUE INDEX report_items_report_item_uniq"
      pattern: "report_items_report_item_uniq"
    - from: "Delete button onClick"
      to: "supabase.storage.from(PHOTO_BUCKET).remove()"
      via: "fetch photo_paths then delete storage objects before DB row"
      pattern: "storage.*remove|PHOTO_BUCKET.*remove"
---

<objective>
Apply all three schema migrations to the live Supabase database via the MCP client, then patch the report delete handler to clean up storage objects before removing the DB row. Also update supabase/schema.sql to reflect the final state.

Purpose: The unique index prevents silent duplicate report_items from double-submit races at the DB layer (defence-in-depth behind BUG-01). The CHECK constraint makes category drift a hard DB error. The composite index removes a full-table scan on the hot "latest report per room" query. The storage delete prevents orphan files accumulating in the checklist-photos bucket.

Output: Three applied migrations in the live DB, supabase/schema.sql updated, delete handler in reports page fixed.
</objective>

<execution_context>
@C:/Users/watkb/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/watkb/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-bug-fixes-code-quality/01-CONTEXT.md
@supabase/schema.sql
</context>

<interfaces>
<!-- Current schema (supabase/schema.sql) relevant excerpts: -->

```sql
-- checklist_items has: category text not null default 'other'
-- No CHECK constraint on category yet.

-- report_items has: report_id uuid, checklist_item_id uuid
-- No UNIQUE constraint on (report_id, checklist_item_id) yet.

-- Existing indexes:
--   reports_created_idx ON reports (created_at desc)
--   report_items_report_idx ON report_items (report_id)
-- Missing: composite index on reports(room_id, created_at desc)
```

Delete handler in app/reports/page.tsx (lines 433-436 current):
```typescript
const { error } = await supabase.from("reports").delete().eq("id", r.id);
if (error) { alert(error.message); return; }
setRows((rs) => rs.filter((x) => x.id !== r.id));
// BUG-06: No storage cleanup before DB delete
```

report_items has `on delete cascade` from reports, so DB rows are cleaned up when a report is deleted.
But storage objects are NOT deleted — they live in checklist-photos bucket forever.

Photo paths are stored in report_items.photo_path as newline-separated strings.
PHOTO_BUCKET constant is already exported from lib/supabase.ts.
</interfaces>

<tasks>

<task type="auto">
  <name>Task B-1: [BLOCKING] Apply schema migrations via Supabase MCP</name>
  <files>supabase/schema.sql</files>
  <read_first>
    - supabase/schema.sql — read before applying so you know the current baseline and can write the correct SQL
    - .planning/phases/01-bug-fixes-code-quality/01-CONTEXT.md — re-read D-07, D-08, D-09 migration order requirements
  </read_first>
  <action>
This task uses the Supabase MCP (`mcp__supabase__*` tools) — NOT the CLI and NOT manual SQL paste by the user.

**Step 0: Identify the active Supabase project**
Call `mcp__supabase__list_projects` to get the project ID. Use the project named "resort-checklist" or the one matching the NEXT_PUBLIC_SUPABASE_URL env var.

**Step 1: Pre-check for violating rows (per D-08)**

Run via `mcp__supabase__execute_sql`:

```sql
-- Pre-check 1: duplicate (report_id, checklist_item_id) pairs that would violate the unique index
SELECT report_id, checklist_item_id, COUNT(*) AS cnt
FROM report_items
GROUP BY report_id, checklist_item_id
HAVING COUNT(*) > 1;

-- Pre-check 2: checklist_items with categories outside the 8 allowed values
SELECT id, category FROM checklist_items
WHERE category NOT IN ('paint','wallpaper','aluminum','hk','mechanical','plumbing','electrical','furniture','cleaning','other');
```

Record the results. If duplicates exist, run a cleanup DELETE that keeps only the lowest `id` per pair:
```sql
DELETE FROM report_items
WHERE id NOT IN (
  SELECT MIN(id) FROM report_items GROUP BY report_id, checklist_item_id
);
```

If invalid categories exist, update them to 'other':
```sql
UPDATE checklist_items
SET category = 'other'
WHERE category NOT IN ('paint','wallpaper','aluminum','hk','mechanical','plumbing','electrical','furniture','cleaning','other');
```

**Step 2: Apply all three migrations in a single transaction (per D-09)**

Run via `mcp__supabase__execute_sql`:

```sql
BEGIN;

-- Section 1: Unique index on report_items to prevent duplicate rows (BUG-03)
CREATE UNIQUE INDEX IF NOT EXISTS report_items_report_item_uniq
  ON report_items (report_id, checklist_item_id);

-- Section 2: CHECK constraint on checklist_items.category for valid values (BUG-05)
ALTER TABLE checklist_items
  ADD CONSTRAINT checklist_items_category_check
  CHECK (category IN ('paint','wallpaper','aluminum','hk','mechanical','plumbing','electrical','furniture','cleaning','other'));

-- Section 3: Composite index for hot-path "latest report per room" query (BUG-12)
CREATE INDEX IF NOT EXISTS reports_room_created_idx
  ON reports (room_id, created_at DESC);

COMMIT;
```

If the MCP client does not support multi-statement transactions, run each statement individually but in the same session in the order above. If any statement fails, stop and report the error — do NOT proceed.

**Step 3: Update supabase/schema.sql**

After confirmed successful migration, update `supabase/schema.sql` to reflect the final state. Add the following after the existing index lines at the bottom of the file:

```sql
-- BUG-03: Unique index prevents duplicate report_items from double-submit races
create unique index if not exists report_items_report_item_uniq
  on report_items (report_id, checklist_item_id);

-- BUG-05: CHECK constraint enforces valid category values across TS, SQL, and UI
alter table checklist_items
  add constraint checklist_items_category_check
  check (category in ('paint','wallpaper','aluminum','hk','mechanical','plumbing','electrical','furniture','cleaning','other'));

-- BUG-12: Composite index for hot-path "latest report per room" query
create index if not exists reports_room_created_idx
  on reports (room_id, created_at desc);
```
  </action>
  <verify>
    <automated>mcp__supabase__execute_sql — run: SELECT indexname FROM pg_indexes WHERE indexname IN ('report_items_report_item_uniq','reports_room_created_idx') AND tablename IN ('report_items','reports'); — expect 2 rows returned</automated>
  </verify>
  <acceptance_criteria>
    - MCP query `SELECT indexname FROM pg_indexes WHERE indexname = 'report_items_report_item_uniq'` returns 1 row
    - MCP query `SELECT indexname FROM pg_indexes WHERE indexname = 'reports_room_created_idx'` returns 1 row
    - MCP query `SELECT conname FROM pg_constraint WHERE conname = 'checklist_items_category_check'` returns 1 row
    - `supabase/schema.sql` contains `report_items_report_item_uniq` (the unique index)
    - `supabase/schema.sql` contains `checklist_items_category_check` (the CHECK constraint)
    - `supabase/schema.sql` contains `reports_room_created_idx` (the composite index)
  </acceptance_criteria>
  <done>Three migrations applied to live DB and reflected in schema.sql; pre-checks ran with no unresolved violations</done>
</task>

<task type="auto">
  <name>Task B-2: Fix report delete to purge storage objects first (BUG-06)</name>
  <files>app/reports/page.tsx</files>
  <read_first>app/reports/page.tsx — read the full file, especially the delete button onClick handler and the Row type definition, so you understand where photo_path lives and how to fetch it before deleting</read_first>
  <action>
The current delete handler (inside the table row button onClick) deletes the DB row without first removing storage objects. Fix this in `app/reports/page.tsx`.

The Row type (lines 9-16) does not include `photo_path` on items — it only has `bad_items`. The delete handler needs to fetch the photo paths for the report being deleted, then remove the storage objects, then remove the DB row.

Replace the current delete button `onClick` handler:

```typescript
// BEFORE (BUG-06: no storage cleanup):
onClick={async () => {
  if (!confirm("Delete this report?")) return;
  const { error } = await supabase.from("reports").delete().eq("id", r.id);
  if (error) { alert(error.message); return; }
  setRows((rs) => rs.filter((x) => x.id !== r.id));
}}
```

With the fixed version:

```typescript
onClick={async () => {
  if (!confirm("Delete this report?")) return;

  // Step 1: Fetch photo_paths for all items in this report
  const { data: items, error: fetchErr } = await supabase
    .from("report_items")
    .select("photo_path")
    .eq("report_id", r.id);

  if (fetchErr) { alert(fetchErr.message); return; }

  // Step 2: Collect all storage object paths
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

  // Step 3: Delete storage objects before DB row
  if (storagePaths.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(storagePaths);
    if (storageErr) {
      // Log but do not block — orphan files are preferable to stuck UI
      console.warn("Storage delete partial failure:", storageErr.message);
    }
  }

  // Step 4: Delete the DB row (cascade removes report_items)
  const { error } = await supabase.from("reports").delete().eq("id", r.id);
  if (error) { alert(error.message); return; }
  setRows((rs) => rs.filter((x) => x.id !== r.id));
}}
```

`PHOTO_BUCKET` is already imported at the top of the file via `import { supabase, PHOTO_BUCKET } from "@/lib/supabase";` — no new import needed.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `app/reports/page.tsx` contains `supabase.storage.from(PHOTO_BUCKET).remove(storagePaths)` inside the delete onClick handler
    - `app/reports/page.tsx` contains `from("report_items").select("photo_path").eq("report_id", r.id)` — the pre-delete photo path fetch
    - The storage remove call appears BEFORE the `from("reports").delete()` call in the handler
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Deleting a report now removes its storage objects from checklist-photos before removing the DB row; TypeScript compiles clean</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Supabase DB | Schema migrations applied with elevated privileges via MCP |
| Storage bucket | Object deletion performed by anon client before row delete |
| report_items | Unique constraint now enforced at DB level |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01B-01 | Tampering | Duplicate report_items from double-submit | mitigate | Unique index on (report_id, checklist_item_id) rejects duplicates at DB layer — defence-in-depth behind BUG-01 ref guard (BUG-03) |
| T-01B-02 | Tampering | Invalid category values bypass TS type system via DB | mitigate | CHECK constraint on checklist_items.category at DB layer enforces the 8 valid values (BUG-05) |
| T-01B-03 | Information Disclosure | Orphan storage objects accumulate after report delete | mitigate | Delete handler fetches photo_paths and calls storage.remove() before DB delete; storage error is logged not blocked to prevent stuck UI (BUG-06) |
| T-01B-04 | Elevation of Privilege | Migration applied to wrong Supabase project | mitigate | Executor must verify project ID from list_projects before running any SQL; pre-check queries run first |
</threat_model>

<verification>
1. Supabase MCP: `SELECT indexname FROM pg_indexes WHERE indexname = 'report_items_report_item_uniq'` — 1 row
2. Supabase MCP: `SELECT indexname FROM pg_indexes WHERE indexname = 'reports_room_created_idx'` — 1 row
3. Supabase MCP: `SELECT conname FROM pg_constraint WHERE conname = 'checklist_items_category_check'` — 1 row
4. `grep -c "report_items_report_item_uniq" supabase/schema.sql` — returns ≥ 1
5. `grep -c "storage.*remove\|remove.*storagePaths" app/reports/page.tsx` — returns ≥ 1
6. `npx tsc --noEmit` — exits 0
</verification>

<success_criteria>
- All three migrations confirmed live in Supabase via MCP verification queries
- supabase/schema.sql updated to reflect all three
- Delete handler removes storage objects before DB row
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/phases/01-bug-fixes-code-quality/01-B-SUMMARY.md` using the summary template.
</output>
