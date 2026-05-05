# Production Deployment Guide

**Project:** inspection-checklist  
**Production Supabase:** `quuqxbvzxgaatbfuvyum` (inspection-checklist, West Europe London)  
**Test Supabase:** `cnqotgwqqxiqforchuux` (inspection-checklist-test, West Europe London)  
**Vercel project:** resort-checklist.vercel.app

---

## How This Works

All database changes during development are applied to the **test project only**.
Changes are documented here with full SQL and instructions.
When ready to go to production, run every pending section in order.

**Supabase CLI commands:**
```bash
# Apply to test
npx supabase link --project-ref cnqotgwqqxiqforchuux
npx supabase db query --linked "SQL HERE"

# Apply to production (when ready)
npx supabase link --project-ref quuqxbvzxgaatbfuvyum
npx supabase db query --linked "SQL HERE"
```

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ Test | Applied and verified on test project |
| ⏳ Production | Pending — not yet applied to production |
| ✅ Production | Applied to production |

---

## Phase 2: Auth & Row-Level Security

### DB-01 — Row Level Security on all 5 tables

**Status:** ✅ Test | ⏳ Production  
**Phase:** 02  
**Requirement:** SEC-03  
**Applied to test:** 2026-05-04  

**Purpose:** Lock down the Supabase tables so the anon key (public API key used by workers) cannot read or delete manager data. The service-role client bypasses RLS by design.

**Policy design:**
- `rooms`, `room_types`, `checklist_items` — anon can SELECT (worker check pages need to read these)
- `reports`, `report_items` — anon can INSERT only (worker submission), no SELECT/DELETE/UPDATE
- No anon DELETE on any table
- service_role bypasses RLS automatically — no explicit policy needed

**SQL to apply to production when ready:**

```sql
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
```

**Verification query (run after applying):**
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('rooms','room_types','checklist_items','reports','report_items')
ORDER BY tablename;
-- Expected: all 5 rows rowsecurity=true

SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('rooms','room_types','checklist_items','reports','report_items')
ORDER BY tablename;
-- Expected: 5 policies — 3 SELECT, 2 INSERT

SET LOCAL ROLE anon;
SELECT COUNT(*) FROM reports;
RESET ROLE;
-- Expected: 0 (RLS blocks anon read)
```

**Rollback if needed:**
```sql
DROP POLICY IF EXISTS "anon_select_rooms" ON rooms;
DROP POLICY IF EXISTS "anon_select_room_types" ON room_types;
DROP POLICY IF EXISTS "anon_select_checklist_items" ON checklist_items;
DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
DROP POLICY IF EXISTS "anon_insert_report_items" ON report_items;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE room_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE report_items DISABLE ROW LEVEL SECURITY;
```

---

## Phase 3: Storage Hardening

### DB-02 — Make checklist-photos bucket private + remove anon SELECT/DELETE policies

**Status:** ✅ Test | ⏳ Production
**Phase:** 03
**Requirement:** STG-01
**Applied to test:** 2026-05-04

**Purpose:** Make the checklist-photos bucket private so direct object URLs return 403. Remove the anon SELECT and DELETE storage policies — neither is valid for a private bucket. The anon INSERT policy is kept for worker photo uploads.

**SQL to apply to production when ready:**

```sql
-- 1. Make bucket private (direct URLs return 403)
UPDATE storage.buckets SET public = false WHERE id = 'checklist-photos';

-- 2. Remove anon SELECT — "anyone can view photos"
DROP POLICY IF EXISTS "anyone can view photos" ON storage.objects;

-- 3. Remove anon DELETE — "anon can delete photos"
-- (deleteReportAction uses service role; workers should not delete photos)
DROP POLICY IF EXISTS "anon can delete photos" ON storage.objects;

-- NOTE: Keep "anon can upload photos" (INSERT) — worker uploads use anon key
```

**Verification query (run after applying):**
```sql
SELECT id, public FROM storage.buckets WHERE id = 'checklist-photos';
-- Expected: public = false

SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
-- Expected: only "anon can upload photos" (INSERT) remains
```

**Rollback if needed:**
```sql
UPDATE storage.buckets SET public = true WHERE id = 'checklist-photos';
CREATE POLICY "anyone can view photos" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'checklist-photos');
CREATE POLICY "anon can delete photos" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'checklist-photos');
```

---

## Environment Variables Required on Production (Vercel)

These must be added to Vercel before deploying Phase 2 code:

| Variable | Where | Notes |
|----------|-------|-------|
| `SESSION_SECRET` | Vercel env → Production | Min 32 chars. Generate: `openssl rand -base64 32` |
| `MANAGER_PASSWORD` | Vercel env → Production | Shared manager password — keep private |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env → Production | From Supabase project settings → API → service_role key. **Never NEXT_PUBLIC_** |

---

## Checklist: Production Go-Live

When ready to ship Phase 2 to production, complete in this order:

- [ ] Add `SESSION_SECRET` to Vercel production env vars
- [ ] Add `MANAGER_PASSWORD` to Vercel production env vars
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel production env vars (from production project `quuqxbvzxgaatbfuvyum`)
- [ ] Apply DB-01 (RLS) SQL to production Supabase (commands above)
- [ ] Verify RLS with validation queries above
- [ ] Deploy Phase 2 code to production via Vercel
- [ ] Test: visit `/reports` → redirected to `/login`
- [ ] Test: log in with MANAGER_PASSWORD → access reports
- [ ] Test: worker check page still loads and submits normally
- [ ] Monitor Vercel logs for any runtime errors on first day
