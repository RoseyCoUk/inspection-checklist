---
phase: 01-bug-fixes-code-quality
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/check/[roomId]/page.tsx
  - lib/i18n.ts
  - supabase/schema.sql
  - app/reports/page.tsx
  - app/rooms/page.tsx
  - app/layout.tsx
  - app/globals.css
  - lib/types.ts
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Eight files from the Phase 1 bug-fix pass were reviewed. The submission-flow hardening, bulk insert, and photo cap changes are structurally sound. The most serious bugs are a date-filter timezone mismatch that silently filters out valid records based on the user's local timezone, and a null-dereference in `resizePhoto` that can crash the photo upload flow on some devices. The schema `ALTER TABLE` statement is not idempotent and will break re-deployment on an existing database. Several `any` escape-hatches indicate incomplete type integration, and the `useT`/`useLang` hook architecture creates redundant subscriptions on every component mount.

---

## Critical Issues

### CR-01: Date filter appends bare local-time suffix — silently drops valid records in non-UTC timezones

**File:** `app/reports/page.tsx:75-76`

**Issue:** `dateFrom` and `dateTo` are `<input type="date">` values (e.g. `"2024-01-15"`). The filter constructs `new Date("2024-01-15T00:00:00")` and `new Date("2024-01-15T23:59:59")`. Without a `Z` or explicit offset, the ECMAScript spec parses these as **local time**. Meanwhile `r.created_at` from Supabase is a UTC ISO string, so `new Date(r.created_at)` is UTC. In UTC+3 (the resort's likely timezone), records created at `00:00–02:59 UTC` on the selected day fall before the local midnight boundary and are wrongly excluded. In UTC-5 they would incorrectly include records from the previous day. The fix is to append `Z` to the boundary strings so both sides are evaluated in UTC.

**Fix:**
```ts
if (dateFrom && new Date(r.created_at) < new Date(dateFrom + "T00:00:00Z")) return false;
if (dateTo   && new Date(r.created_at) > new Date(dateTo   + "T23:59:59Z")) return false;
```

---

### CR-02: `getContext("2d")` null-assertion crashes on devices that cannot allocate a canvas context

**File:** `app/check/[roomId]/page.tsx:34`

**Issue:** `canvas.getContext("2d")!` uses a non-null assertion. `getContext` returns `null` when the browser cannot provide a 2D rendering context (hardware acceleration unavailable, context limit exceeded, or low-memory device). The `!` assertion bypasses this check and calling `.drawImage()` on `null` throws an uncaught `TypeError`, preventing photo upload for the entire item. The fallback `img.onerror` does not cover this path.

**Fix:**
```ts
const ctx = canvas.getContext("2d");
if (!ctx) { resolve(file); return; }
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
```

---

## Warnings

### WR-01: `ALTER TABLE ... ADD CONSTRAINT` has no idempotency guard — re-running schema.sql fails

**File:** `supabase/schema.sql:47-49`

**Issue:** Every other DDL statement in the file uses `IF NOT EXISTS`, but the `ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_category_check ...` statement at line 47 has no such guard. Re-executing the schema (e.g. during CI, a fresh staging deployment against a pre-seeded DB, or a developer reproducing the setup) will throw `ERROR: constraint "checklist_items_category_check" already exists` and halt the script.

**Fix:**
```sql
alter table checklist_items
  drop constraint if exists checklist_items_category_check;

alter table checklist_items
  add constraint checklist_items_category_check
  check (category in ('paint','wallpaper','aluminum','hk','mechanical','plumbing','electrical','furniture','cleaning','other'));
```

---

### WR-02: `submittingRef.current` is never reset on the success path — submit is permanently locked if navigation is delayed

**File:** `app/check/[roomId]/page.tsx:157-229`

**Issue:** `submittingRef.current` is set to `true` at line 159 and reset to `false` only in the `catch` block at line 227. On the happy path the code calls `router.replace("/rooms?done=1")` at line 214, which navigates away. If `router.replace` is slow, fails silently, or the user navigates back via the browser history before the new page loads, the component is still mounted with `submittingRef.current === true`, and the submit button is permanently disabled (the `disabled` attr on the button uses `submitting` state, but future calls to `submit()` return immediately on the ref check). Adding a `finally` block that resets both guards is defensive and correct.

**Fix:**
```ts
// Replace the catch-only reset with a finally block:
} finally {
  submittingRef.current = false;
  setSubmitting(false);
}
// Remove the duplicate resets inside the catch block.
```

---

### WR-03: `useT()` instantiates a second independent `useLang()` — double event listener and double state per component

**File:** `lib/i18n.ts:194-197`

**Issue:** `useT()` calls `useLang()` internally (line 195). Every component that calls `useT()` therefore mounts two independent `useLang()` hook instances — one from the direct call in the component (e.g. `check/[roomId]/page.tsx` line 67) and one inside `useT()`. Each instance registers its own `langchange` `CustomEvent` listener and owns its own React state. This means four `addEventListener` calls on a single component mount (two `useLang` + two from `useT`), and language-change events trigger four `setState` calls causing extra re-renders. The fix is to accept a `Lang` argument in `useT` and not call `useLang` inside it.

**Fix:**
```ts
// lib/i18n.ts
export function useT(lang?: Lang): (k: Key) => string {
  const [currentLang] = useLang();
  const resolved = lang ?? currentLang;
  return (k: Key) => dict[resolved][k];
}

// In components: call useLang() once, pass lang to useT:
const [lang, setLang] = useLang();
const t = useT(lang);
```

---

### WR-04: `<html lang="en">` is hardcoded — screen readers and crawlers always see English language attribute

**File:** `app/layout.tsx:30`

**Issue:** The `<html>` element has `lang="en"` hardcoded at server-render time. `useLang()` correctly updates `document.documentElement.lang` on the client when language is switched (line 174), but the initial HTML delivered to the browser — and the only version seen by crawlers or screen readers that do not execute JavaScript — always declares English. Arabic users get incorrect language semantics until client hydration completes.

This is partially inherent to the client-side lang approach and cannot be fully fixed without server-side lang detection. A minimal mitigation is to mark the lang as empty/neutral at the layout level and rely entirely on the client-side update, or to read a cookie for SSR.

**Fix (minimal):** Accept that the robots.txt already has `noindex: true` so crawler impact is low. As a runtime hardening, add `suppressHydrationWarning` to the `<html>` element to prevent React hydration mismatches when the client updates `lang`:
```tsx
<html lang="en" suppressHydrationWarning className={...}>
```

---

### WR-05: `fetchAllDetailed` sends up to 200 UUIDs in a single PostgREST `.in()` query — URL length may exceed limits

**File:** `app/reports/page.tsx:113-124`

**Issue:** `fetchAllDetailed` collects all IDs from `filtered` (up to 200 rows, per the `.limit(200)` cap) and passes them all to `.in("id", ids)`. PostgREST encodes `.in()` as a URL query parameter (`id=in.(uuid1,uuid2,...)`). 200 UUIDs × 37 characters each = ~7.4 KB in the URL, which exceeds the 4 KB default limit of some nginx/load-balancer configurations and the informal browser URL length recommendation. The query will silently fail or return an HTTP 414 for large filtered sets.

**Fix:** Batch the `.in()` call in chunks of 50:
```ts
async function fetchInBatches(ids: string[]) {
  const CHUNK = 50;
  const results = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("reports")
      .select("id, worker_name, created_at, rooms(number), report_items(...)")
      .in("id", ids.slice(i, i + CHUNK))
      .order("created_at", { ascending: false });
    if (error) throw error;
    results.push(...(data ?? []));
  }
  return results;
}
```

---

## Info

### IN-01: Three `ItemCategory` values lack translation keys in `i18n.ts` dict — pattern is broken for `wallpaper`, `hk`, `aluminum`

**File:** `lib/i18n.ts:55-62` / `lib/types.ts:3`

**Issue:** The `dict` includes `cat_paint`, `cat_mechanical`, `cat_plumbing`, `cat_electrical`, `cat_furniture`, `cat_cleaning`, and `cat_other` — but `ItemCategory` includes `"wallpaper"`, `"hk"`, and `"aluminum"`, which have no corresponding `cat_wallpaper`, `cat_hk`, or `cat_aluminum` keys. If any call site ever renders `t("cat_" + category)` for these values it will be a TypeScript compile error (key not in `Key`), and `CATEGORY_LABELS` in `reports/page.tsx` covers these values with hardcoded English strings instead. The pattern is inconsistent; either all categories should have i18n keys or none should.

**Fix:** Add the three missing keys to both `en` and `ar` dict entries:
```ts
// en
cat_wallpaper: "Wallpaper",
cat_hk: "HK",
cat_aluminum: "Aluminum",

// ar
cat_wallpaper: "ورق الجدران",
cat_hk: "التدبير المنزلي",
cat_aluminum: "الألمنيوم",
```

---

### IN-02: Pervasive `as any` / `(r as any)` casts in Supabase query results indicate absent or incomplete generated types

**File:** `app/check/[roomId]/page.tsx:87,109,111,112,173` / `app/reports/page.tsx:313,315,316`

**Issue:** Multiple query results are cast to `any` before property access (e.g. `(r as any).room_type_id`, `(lastRep as any).id`, `(rep as any).id`). This bypasses TypeScript's safety net entirely for the most security-sensitive paths in the app (constructing `reportId`, referencing `room_type_id` for the checklist query). Supabase CLI generates typed clients (`supabase gen types typescript`); using them would eliminate these casts and catch schema mismatches at compile time.

**Fix:** Run `supabase gen types typescript --project-id <id> > lib/database.types.ts` and type the Supabase client: `createClient<Database>(url, anon)`. Remove all `as any` casts in query result handling.

---

_Reviewed: 2026-05-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
