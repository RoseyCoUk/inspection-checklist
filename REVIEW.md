# inspection-checklist — code review

Repo: `RoseyCoUk/inspection-checklist` · Live: https://resort-checklist.vercel.app

Stack: Next.js 16 App Router, React 19, Supabase, jsPDF, Tailwind v4. All pages `"use client"`, talking to Supabase directly with the anon key. No auth, no middleware, no API routes.

**TL;DR: it functions.** The flow works end-to-end (worker name → pick room → tick items → upload photos → manager reviews + exports). The design is nice, the Arabic/RTL toggle is a good touch, and the UX of the checklist modal is sensible. The one thing I'd fix before anyone else sees the link is the public `/reports` page — details below.

---

## 🔴 Critical — fix before sharing the link wider

### 1. `/reports` is fully public, and delete works from the browser
Verified: `curl https://resort-checklist.vercel.app/reports` returns HTTP 200, no auth gate, no middleware redirect. The page is statically cached at Vercel's edge. Anyone with the link can:
- read every inspection report and photo
- open DevTools, grab the anon key from the JS bundle, and call `supabase.from("reports").delete()` directly
- hit the existing delete button (`app/reports/page.tsx:434`) which fires the delete straight from the browser with no server check

**Fix options (pick one):**
- **5-min stopgap:** Vercel Project Settings → Security → Password Protection. Site stays up, team shares one password.
- **Right fix:** Supabase Auth (magic link) + `middleware.ts` gating `/reports/*` + RLS policies on all tables so the anon key can only `select` reference data and `insert` reports/items.

### 2. Zero RLS on the Supabase tables
`supabase/schema.sql` has no policies at all. Even if `/reports` is gated at the edge, the anon key is still in the public bundle and hits `rooms`/`reports`/`report_items` directly. Whoever knows the Supabase URL can query it.

**Fix:** enable RLS on all five tables, then:
- `rooms`, `room_types`, `checklist_items` → anon `select` only
- `reports`, `report_items` → anon `insert`, no `update`/`delete`
- authenticated role (managers) → full access
- deletes → service-role only, routed via a server action or a Supabase Edge Function

### 3. Photo storage bucket is public
Per the schema comment, the `checklist-photos` bucket is public. URLs are guessable (`reports/{reportId}/{itemId}-{i}.jpg`). Room photos of a resort leaking isn't catastrophic but isn't great either.

**Fix:** flip the bucket to private, use `createSignedUrl(path, 3600)` when rendering. One-line change in each view.

---

## 🟠 High — data integrity & correctness

### 4. Fast double-tap can create duplicate reports (Codex catch)
`app/check/[roomId]/page.tsx:113-124` — the guard is `if (!allAnswered || submitting) return;` but `setSubmitting(true)` doesn't update the captured `submitting` synchronously. Two quick taps on a slow phone fire two INSERTs into `reports` with separate photo uploads. Real-world scenario for phone users with lag.

**Fix:** a `useRef` flag set synchronously before the first await, or disable the button imperatively on click.

### 5. Submission is not atomic
`app/check/[roomId]/page.tsx:118-156` — creates the parent `reports` row, then uploads photos and inserts `report_items` one-by-one. Any mid-flow failure (network drop, storage hiccup, auth token expiry) leaves a half-written report that the manager view treats as real.

**Fix:** either do it in a Postgres function (single transaction) or at minimum delete the parent report on failure as a compensating action.

### 6. `report_items` has no unique constraint on `(report_id, checklist_item_id)`
Combined with #4 and #5, duplicate rows silently inflate `bad_count` on the manager view, duplicate entries on the detail page, make one inspection internally inconsistent.

**Fix:** `create unique index report_items_unique on report_items(report_id, checklist_item_id);`

### 7. Manager view silently truncates to 200 reports (Codex catch)
`app/reports/page.tsx:305-311` — `.limit(200)`. Filters, counts, CSV, PDF all run against that in-memory subset. "Export All" label becomes a lie the moment the 201st report lands. Older reports vanish from the UI with no indication.

**Fix:** paginate, or fetch in chunks for the export path, or raise the cap with an explicit "showing most recent X" notice.

### 8. Category drift across type / UI / schema / seed
- `lib/types.ts` enum: `paint | mechanical | plumbing | electrical | furniture | cleaning | other`
- `reports/page.tsx:18-29` CATEGORY_LABELS adds `wallpaper`, `aluminum`, `hk` — not in the type
- `supabase/schema.sql` — free-form `text default 'other'`, no CHECK constraint
- `supabase/seed.sql` — never sets `category`, so every seeded item is `other`

**Fix:** pick one canonical list, widen the TS enum, add a CHECK constraint in SQL, update the seed, migrate existing rows.

### 9. Orphan photos on report delete
`report_items` cascades on delete, but storage objects don't. Every deleted report leaks photos in the bucket forever. Directly relevant to Supabase storage sizing.

**Fix:** before the DB delete, list `reports/{reportId}/` and remove the objects. Or a Postgres trigger calling an Edge Function.

### 10. `photo_path` is a newline-joined string of paths
Works, but every read does `p.split(/\r?\n/)`. Should be `text[]` or a `report_item_photos` child table.

### 11. N+1 writes on submit
`app/check/[roomId]/page.tsx:126-151` — one `INSERT` per item in a serial `for` loop, same pattern for photo uploads. 20 items = 20 round trips from the phone.

**Fix:** single bulk `.insert(rows)` for `report_items`, `Promise.all` the uploads.

### 12. No size/count limit on photo uploads (Codex sharpening of my "no compression")
`app/check/[roomId]/page.tsx:296-306` — accepts unlimited original files of any size. Modern phones produce 3-5MB JPEGs. A worker attaching 10 photos from a recent iPhone = 40MB upload over hotel wifi.

**Fix:** client-side resize via canvas (1600px long edge, JPEG 0.7 ≈ 200-400KB per photo) + a max count.

---

## 🟡 Medium — bugs & perf

### 13. Date filter mixes UTC and local (Codex catch)
`app/reports/page.tsx:75-76` — `new Date(dateFrom)` parses `YYYY-MM-DD` at UTC midnight, `new Date(dateTo + "T23:59:59")` parses as local. Inspections near midnight land in the wrong day bucket.

### 14. Rooms with zero checklist items become a dead-loading screen (Codex catch)
`app/check/[roomId]/page.tsx:161` — `items.length === 0` is treated as "still loading" forever. A misconfigured `room_type_id` or intentional empty type has no exit.

**Fix:** track a `loaded` flag, show an empty state.

### 15. Invalid `lang` in localStorage crashes translated pages (Codex catch)
`lib/i18n.ts:168-170` casts whatever's in storage to `Lang`. `useT()` then does `dict[lang][k]` — if someone's localStorage has anything other than `"en"`/`"ar"` (browser extension noise, manual edit, old value), the whole page throws.

**Fix:** `const saved = localStorage.getItem("lang"); const lang: Lang = saved === "ar" ? "ar" : "en";`

### 16. Hot-path "latest report for room" has no supporting index (Codex catch)
`app/check/[roomId]/page.tsx:55-61` — runs `reports.eq("room_id", ...).order("created_at", { ascending: false }).limit(1)` on every room open. Schema only indexes `created_at` alone.

**Fix:** `create index reports_room_created_idx on reports(room_id, created_at desc);`

### 17. Supabase join typing casts erase cardinality
`as unknown as Type` hides that Supabase `select("rooms(...)")` returns `rooms` as object-or-null for many-to-one and as array for one-to-many. Usage in this repo is mostly correct-shape-wrong-types, but a future schema change will silently break types. Codex's nuance: #8 from my original list was too broad — the casts aren't wrong about `rooms` being an object, they're wrong in that they erase the nullability and the relationship direction.

### 18. Floor grouping uses `r.number.charAt(0)`
`app/rooms/page.tsx:46` — works for 1xx/2xx/V01, breaks if any floor becomes double-digit (1001 groups under "1" with 1xx).

### 19. PDF export may silently drop photos on CORS taint (Codex hypothesis)
`app/reports/page.tsx:194-211` & `app/reports/[id]/page.tsx:97-114` — both use `new Image()` + canvas `toDataURL`. Any load failure or CORS taint is swallowed and the photo is skipped with no warning. The bucket is public and that mostly works, but worth spot-checking exports in Safari on an iPhone.

### 20. Google Fonts `@import` in `globals.css`
Blocks render. Swap for `next/font` and save ~200ms on first paint.

---

## 🟢 Low — polish

- `alert()`/`confirm()` on delete and export — fine for internal, ugly when shown to managers.
- `translateItem` matches labels by exact English string (`lib/i18n.ts:160-163`). Add a new item → Arabic UI shows English until someone updates the map. Low priority since items rarely change, but a data-driven `checklist_items.label_ar` column would future-proof it.
- `worker_name` is trusted free text — anyone can impersonate. OK for an internal trust-based tool; not OK once the link leaks.
- No `robots.txt` / no metadata noindex — worth adding `noindex, nofollow` in `app/layout.tsx` `metadata.robots` as cheap belt-and-braces.
- README is default create-next-app boilerplate. Doc the env vars and the schema/seed runbook so future-Hazem can get the thing running in 5 min.
- No tests. Wouldn't ask for a suite on a tool this size, but one Playwright smoke test for the full flow is cheap insurance.

---

## What's good (so it's not all negative)

- Clean file layout, small codebase, easy to read.
- Arabic/RTL handling via `document.documentElement.dir` + `langchange` CustomEvent is a nice lightweight pattern.
- The modal-based check flow is the right call on mobile — less thumb travel than inline expanders.
- Progress bar + sticky submit button + "X items left" is solid UX.
- Floor `<details>` disclosure groups work well for a resort with 100+ rooms.
- Prior-report strikethrough on the check page (`app/check/[roomId]/page.tsx:220-229`) is a thoughtful touch — saves re-scanning items that haven't changed.
- Multi-photo per issue, camera capture hint (`capture="environment"`), CSV + PDF export, per-report delete — all the right features for a v1 internal tool.

---

## Suggested priority order

1. **Today:** enable Vercel Password Protection on the deployment (2 min, dashboard). Unblocks sharing the link safely.
2. **This week:** RLS + Supabase Auth + middleware; fix the double-submit race (#4) and add the unique index (#6).
3. **Next:** photo size/compression (#12), orphan cleanup (#9), N+1 batch insert (#11), 200-report cap (#7).
4. **When touching the area:** category cleanup (#8), date-filter timezone fix (#13), localStorage lang validation (#15), hot-path index (#16).
5. **Cosmetic:** `alert`→toast, `next/font`, README, noindex.

## Supabase sizing note

DB stays tiny (~50MB even at 10k reports). Storage is the bottleneck — 3MB phone photos × hundreds of inspections eats the 1GB free tier in days. With client-side compression (#12) + orphan cleanup (#9), free tier probably lasts months. Without them, even Pro's 100GB fills over a year. Pro ($25/mo) is the right plan long-term.
