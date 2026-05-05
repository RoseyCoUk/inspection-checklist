---
phase: 02-auth-row-level-security
plan: D
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements:
  - SEC-03

must_haves:
  truths:
    - "A direct Supabase query with the anon key cannot read any rows from the reports table"
    - "A direct Supabase query with the anon key cannot read any rows from the report_items table"
    - "A direct Supabase query with the anon key cannot delete any rows from any of the 5 tables"
    - "A direct Supabase query with the anon key CAN select from rooms, room_types, and checklist_items (worker flow requires this)"
    - "A direct Supabase query with the anon key CAN insert into reports and report_items (worker submission requires this)"
    - "The service-role client has full access to all 5 tables (bypasses RLS by design)"
  artifacts:
    - path: "supabase (database)"
      provides: "RLS enabled on all 5 tables with correct per-operation policies"
      contains: "RLS policies: rooms=anon_select, room_types=anon_select, checklist_items=anon_select, reports=anon_insert+service_full, report_items=anon_insert+service_full"
  key_links:
    - from: "anon key client (lib/supabase.ts supabase singleton)"
      to: "reports table"
      via: "RLS policy: anon role — INSERT only"
      pattern: "n/a — database policy"
    - from: "service-role client (createServiceClient)"
      to: "all 5 tables"
      via: "service-role bypasses RLS"
      pattern: "n/a — database policy"
---

<objective>
Enable Row Level Security on all 5 Supabase tables and create the correct per-table, per-operation policies using the Supabase MCP tool. No code files are modified — all changes are database-level.

Purpose: RLS is the last line of defence. Even if application code has a bug, the anon key cannot read manager data or delete rows. This satisfies SEC-03 and closes the direct-API-key attack vector.

Output: All 5 tables have RLS enabled with policies matching D-13 and D-14.
</objective>

<execution_context>
@C:/Users/watkb/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/watkb/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-auth-row-level-security/02-CONTEXT.md

AGENTS.md note: Use the Supabase MCP tool (`mcp__supabase__*`) for all database operations in this plan. This is the same approach used in Phase 1 Plan B (01-PLAN-B.md) for schema migrations. Execute each SQL statement individually via the MCP tool.

RLS Policy design (D-13, D-14):
- `rooms`, `room_types`, `checklist_items`: anon role can SELECT (worker needs to read rooms/items to fill out the checklist)
- `reports`, `report_items`: anon role can INSERT only (worker submits reports but cannot read or delete them)
- No anon DELETE on any table
- service_role bypasses RLS by design (no policy needed for service_role)

Supabase RLS notes:
- `enable row level security` on a table blocks ALL access until policies are added
- The default Supabase anon key maps to the `anon` role in Postgres
- `service_role` is a superuser-equivalent that bypasses RLS — no explicit policy needed
- Policy syntax: `CREATE POLICY "name" ON table FOR operation TO role USING (expression);`
- For INSERT policies, use `WITH CHECK (true)` instead of `USING (true)` since INSERT has no existing rows to check
</context>

<interfaces>
<!-- Supabase MCP tool usage (same pattern as Phase 1 Plan B used) -->
```
Tool: mcp__supabase__execute_sql
Parameters:
  project_id: (get from mcp__supabase__list_projects if not known)
  query: "SQL statement here"

Run each statement individually. Do NOT batch multiple ALTER TABLE or CREATE POLICY
statements in a single call — execute them one at a time to isolate errors.
```

<!-- SQL statements to execute (execute in this order) -->

-- Step 1: Enable RLS on all 5 tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_items ENABLE ROW LEVEL SECURITY;

-- Step 2: Worker-readable tables (anon SELECT only)
CREATE POLICY "anon_select_rooms" ON rooms FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_room_types" ON room_types FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_checklist_items" ON checklist_items FOR SELECT TO anon USING (true);

-- Step 3: Worker-writable tables (anon INSERT only — no SELECT, no DELETE, no UPDATE)
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_report_items" ON report_items FOR INSERT TO anon WITH CHECK (true);

-- Step 4: Verify (run as validation queries)
SELECT schemaname, tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('rooms','room_types','checklist_items','reports','report_items');

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('rooms','room_types','checklist_items','reports','report_items')
ORDER BY tablename, policyname;
</interfaces>

<tasks>

<task type="auto">
  <name>Task D-1: Enable RLS and create all policies via Supabase MCP</name>
  <files></files>
  <read_first>
  - .planning/phases/01-bug-fixes-code-quality/01-PLAN-B.md — read how Phase 1 used Supabase MCP for DDL statements; follow the same pattern
  - .planning/phases/02-auth-row-level-security/02-CONTEXT.md — sections D-13 and D-14 for the exact policy intent
  </read_first>
  <action>
Use the Supabase MCP tool to apply all RLS changes. Execute each SQL statement as an individual MCP call. Follow this sequence exactly:

**Step 1 — Identify the project**
Call `mcp__supabase__list_projects` to get the project_id if not already known from Phase 1 work.

**Step 2 — Enable RLS on all 5 tables (5 individual calls)**

Execute each as a separate `mcp__supabase__execute_sql` call:

```sql
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
```
```sql
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
```
```sql
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
```
```sql
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
```
```sql
ALTER TABLE report_items ENABLE ROW LEVEL SECURITY;
```

Verify each succeeds before proceeding.

**Step 3 — Create SELECT policies for worker-readable tables (3 calls)**

```sql
CREATE POLICY "anon_select_rooms"
ON rooms FOR SELECT TO anon
USING (true);
```
```sql
CREATE POLICY "anon_select_room_types"
ON room_types FOR SELECT TO anon
USING (true);
```
```sql
CREATE POLICY "anon_select_checklist_items"
ON checklist_items FOR SELECT TO anon
USING (true);
```

**Step 4 — Create INSERT-only policies for worker submission tables (2 calls)**

Note: INSERT policies use `WITH CHECK (true)` not `USING (true)` — INSERT has no pre-existing rows.

```sql
CREATE POLICY "anon_insert_reports"
ON reports FOR INSERT TO anon
WITH CHECK (true);
```
```sql
CREATE POLICY "anon_insert_report_items"
ON report_items FOR INSERT TO anon
WITH CHECK (true);
```

**Step 5 — Validate: confirm RLS is enabled on all 5 tables**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('rooms', 'room_types', 'checklist_items', 'reports', 'report_items')
ORDER BY tablename;
```

Expected result: all 5 rows have `rowsecurity = true`.

**Step 6 — Validate: confirm all 7 policies exist with correct commands**

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('rooms', 'room_types', 'checklist_items', 'reports', 'report_items')
ORDER BY tablename, policyname;
```

Expected result:
| tablename | policyname | roles | cmd |
|---|---|---|---|
| checklist_items | anon_select_checklist_items | {anon} | SELECT |
| report_items | anon_insert_report_items | {anon} | INSERT |
| reports | anon_insert_reports | {anon} | INSERT |
| room_types | anon_select_room_types | {anon} | SELECT |
| rooms | anon_select_rooms | {anon} | SELECT |

**Step 7 — Validate: confirm anon key cannot read reports**

```sql
-- Test as anon role: should return 0 rows (RLS blocks read)
SET LOCAL ROLE anon;
SELECT COUNT(*) FROM reports;
RESET ROLE;
```

Expected: count = 0 (policy blocks SELECT; even if rows exist, anon cannot read them).

**Step 8 — Validate: confirm anon key CAN select from rooms**

```sql
SET LOCAL ROLE anon;
SELECT COUNT(*) FROM rooms;
RESET ROLE;
```

Expected: count = actual number of rooms (policy allows SELECT).
  </action>
  <verify>
    <automated>echo "Validation done via Supabase MCP query in Step 6 above — check pg_policies output"</automated>
  </verify>
  <acceptance_criteria>
    - MCP Step 5 validation returns 5 rows all with `rowsecurity = true`
    - MCP Step 6 validation returns exactly 5 policies: anon_select_rooms, anon_select_room_types, anon_select_checklist_items, anon_insert_reports, anon_insert_report_items
    - `reports` and `report_items` policies are cmd=INSERT only — no SELECT, UPDATE, DELETE policies for anon role exist on these tables
    - `rooms`, `room_types`, `checklist_items` policies are cmd=SELECT only — no INSERT, UPDATE, DELETE policies for anon role
    - MCP Step 7 anon SELECT on reports returns 0 rows or a policy error (confirms RLS blocks read)
    - MCP Step 8 anon SELECT on rooms returns the actual row count (confirms worker flow still works)
  </acceptance_criteria>
  <done>RLS enabled on all 5 tables; 5 policies created matching D-13/D-14; anon key blocked from reading reports; worker flow (anon insert + anon select rooms/items) still permitted</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
  RLS applied to all 5 tables via Supabase MCP. The anon key can no longer read reports or delete rows. Worker submission (anon insert on reports/report_items, anon select on rooms/room_types/checklist_items) should still work.
  </what-built>
  <how-to-verify>
  1. Open the live app: https://resort-checklist.vercel.app
  2. Navigate to any room's check page (e.g., /check/[roomId]) — it should LOAD normally (rooms and checklist_items are still readable by anon)
  3. Submit a test inspection — it should SUCCEED (anon insert on reports/report_items is allowed)
  4. Navigate to /reports — the proxy.ts gate redirects to /login if not authenticated; log in with the manager password and confirm reports load (service-role via server component)
  5. Open a Supabase query tool (dashboard → SQL editor) and run:
     `SELECT COUNT(*) FROM reports;` — should return actual count (you are authenticated as service role in the dashboard)
  6. Test the anon block (OPTIONAL but recommended): Use the Supabase JS client with the anon key in a browser console or script and run:
     `supabase.from('reports').select('*').limit(1)` — should return an empty array or RLS error, not actual reports

  Note: Export CSV/PDF from the reports page may now fail because `fetchAllDetailed` in ReportsClient.tsx uses the anon client to read reports (which RLS now blocks). This is an expected known gap documented in Plan C's SUMMARY. Do NOT mark as a blocker for this verification — the core security goal (anon cannot read reports or delete) is the acceptance criterion.
  </how-to-verify>
  <resume-signal>Type "approved" if worker submission works and RLS blocks anon reads. Describe any unexpected failures.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Supabase anon key → database | Public API key used by workers; must be restricted by RLS |
| Supabase service-role key → database | Used only by server components/actions; bypasses RLS by design |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02D-01 | Information Disclosure | reports table — anon read | mitigate | RLS policy: no SELECT policy for anon on reports; all anon reads return empty result |
| T-02D-02 | Tampering | reports/report_items — anon delete | mitigate | No DELETE policy for anon on any table; RLS blocks all anon delete attempts at DB level |
| T-02D-03 | Tampering | reports/report_items — anon update | mitigate | No UPDATE policy for anon on any table; RLS blocks all anon update attempts |
| T-02D-04 | Availability | Worker submission blocked by RLS | mitigate | Explicit INSERT policy for anon on reports and report_items; SELECT policy on rooms/room_types/checklist_items; worker flow preserved |
| T-02D-05 | Elevation of Privilege | service_role key exposed to client | mitigate | createServiceClient() uses SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix); only imported in server components; never in client bundle |
</threat_model>

<verification>
All verification is via Supabase MCP SQL queries (executed in Task D-1 Steps 5-8):
1. `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('rooms','room_types','checklist_items','reports','report_items')` — all 5 rows show rowsecurity=true
2. `SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('rooms','room_types','checklist_items','reports','report_items') ORDER BY tablename` — exactly 5 policies, correct commands
3. Anon role SELECT on reports returns 0 (blocked by RLS)
4. Anon role SELECT on rooms returns actual row count (allowed by SELECT policy)
5. Human verification checkpoint: worker submission succeeds end-to-end after RLS is applied
</verification>

<success_criteria>
- RLS enabled on: rooms, room_types, checklist_items, reports, report_items (all 5)
- Policies in place:
  - rooms: anon SELECT only
  - room_types: anon SELECT only
  - checklist_items: anon SELECT only
  - reports: anon INSERT only
  - report_items: anon INSERT only
- No anon DELETE policy on any table
- service_role bypasses RLS (no change needed — default Supabase behavior)
- Worker flow (check page submit) still works after RLS enabled
- Human verification checkpoint approved
</success_criteria>

<output>
After completion, create `.planning/phases/02-auth-row-level-security/02-D-SUMMARY.md` using the summary template.

Note in SUMMARY if the export CSV/PDF functions in ReportsClient.tsx fail after RLS. This is a known gap from Plan C. Record it so the next phase or gap closure can address it (options: route exports through a server action that uses service-role client, or add a /api/reports/export route).
</output>
