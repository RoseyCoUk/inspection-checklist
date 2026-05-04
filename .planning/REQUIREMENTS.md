# Requirements — inspection-checklist Fix Pass

## v1 Requirements

### Phase 1 — Bug Fixes & Code Quality

- [x] **BUG-01:** Double-submit race — `useRef` guard set synchronously before first `await` prevents two `INSERT`s from a fast double-tap
- [x] **BUG-02:** Non-atomic submission — compensating delete of parent `reports` row on any mid-flow failure
- [x] **BUG-03:** Unique index on `report_items(report_id, checklist_item_id)` prevents silent duplicate rows
- [ ] **BUG-04:** 200-report cap — UI shows "most recent 200" notice when the limit is hit
- [ ] **BUG-05:** Category drift — `ItemCategory` TS type widened to include `wallpaper`, `aluminum`, `hk`; CHECK constraint added to schema; seed updated with categories *(DB CHECK applied in 01-B; TS type widening pending 01-D)*
- [x] **BUG-06:** Orphan photos — storage objects deleted before the DB row on report delete
- [x] **BUG-07:** N+1 writes replaced — single bulk `insert` for `report_items`, `Promise.all` for uploads within each item
- [x] **BUG-08:** Photo uploads resized client-side (canvas, 1600px long edge, 0.7 JPEG quality, max 5 per item)
- [ ] **BUG-09:** Date filter timezone — `dateFrom` parsed as local `T00:00:00` to match `dateTo T23:59:59`
- [x] **BUG-10:** Empty checklist items — `loaded` flag shows an empty-state message instead of an infinite spinner
- [x] **BUG-11:** `localStorage` lang cast validated as `"en" | "ar"` before use
- [x] **BUG-12:** Composite index on `reports(room_id, created_at desc)` for the hot-path "latest report per room" query
- [ ] **BUG-13:** Floor grouping uses all-but-last-two digits as key (e.g. `"1001"` → floor `"10"`, not `"1"`)
- [ ] **BUG-14:** Google Fonts `@import` replaced with `next/font`; `robots: noindex` added to layout metadata

### Phase 2 — Auth & Row-Level Security

- [ ] **SEC-01:** Manager login page using Supabase Auth magic link (email input → sends link → session established)
- [ ] **SEC-02:** Next.js `middleware.ts` redirects unauthenticated requests to `/reports` and `/reports/*` to the login page
- [ ] **SEC-03:** RLS enabled on all 5 tables — `rooms`, `room_types`, `checklist_items`: anon `select` only; `reports`, `report_items`: anon `insert` only; authenticated role: full access; deletes: service role via server action only
- [ ] **SEC-04:** Report delete extracted to a Next.js server action; client-side `supabase.from("reports").delete()` removed

### Phase 3 — Storage Hardening

- [ ] **STG-01:** `checklist-photos` bucket set to private (dashboard + policy update)
- [ ] **STG-02:** All photo renders (check page, report detail, reports list) use `createSignedUrl` with a 1-hour TTL instead of `getPublicUrl`
- [ ] **STG-03:** PDF export loads photos via signed URLs
- [ ] **STG-04:** CSV export uses signed URLs for the photo column (or omits direct public paths)

## Out of Scope

- New features (worker accounts, rooms management UI) — not in scope of this fix pass
- Full test suite — deferred
- `alert()` → toast UI — cosmetic, deferred

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 – BUG-14 | Phase 1 | Pending |
| SEC-01 – SEC-04 | Phase 2 | Pending |
| STG-01 – STG-04 | Phase 3 | Pending |
