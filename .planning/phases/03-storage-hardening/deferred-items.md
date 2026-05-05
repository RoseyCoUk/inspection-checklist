# Deferred Items — Phase 03 Storage Hardening

## Out-of-scope discoveries from 03-02

### getPublicUrl in ReportDetailClient.tsx

**File:** `app/reports/[id]/ReportDetailClient.tsx`
**Lines:** 42, 129, 173
**Discovery:** This file uses `supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p)` to render
photos in the single-report detail view. This pattern will break once storage RLS blocks public
URL access (STG-01/STG-02 requirements).
**Scope:** Outside 03-02 (which only modifies ReportsClient.tsx). Not fixed — left for a future plan.
**Priority:** High — same RLS issue as the export functions, affects individual report photo viewing.
