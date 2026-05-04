# Phase 1: Bug Fixes & Code Quality - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all 14 data integrity, correctness, and code quality issues surfaced in PR #1 review (BUG-01 through BUG-14). No new features, no auth, no storage hardening. Ship a clean, reliable codebase.

</domain>

<decisions>
## Implementation Decisions

### Submission Failure UX (BUG-02)
- **D-01:** On failed submit (after compensating delete fires), preserve all worker answers intact. Do NOT reset the form or redirect.
- **D-02:** Error message: "Submission failed — please try again". Plain, actionable, non-technical.
- **D-03:** Error message must be added to the i18n system (`lib/i18n.ts`) with both English and Arabic translations. Follow existing `t()` key pattern used throughout the check page.

### Photo Limit Enforcement (BUG-08)
- **D-04:** Disable the Add Photo file input when 5 photos are already attached. No error message needed — disabled state is self-evident on mobile.
- **D-05:** Show a photo counter near the input (e.g. "3 / 5 photos") so workers know how many slots remain. Update in real time as photos are added/removed.
- **D-06:** Cap is 5 photos per item — this is intentional (storage cost + upload speed on mobile). Cap value is a named constant so it's easy to change later.

### Schema Migration Safety (BUG-03, BUG-05)
- **D-07:** This is a live production database. Use the Supabase MCP (`mcp__supabase__*`) to apply migrations directly in-session — no manual SQL paste by user.
- **D-08:** Migration order for each constraint: (1) run pre-check SELECT to surface any violating rows, (2) run cleanup DELETE/UPDATE if needed, (3) apply the constraint. Wrap in a transaction.
- **D-09:** Deliver as a single migration (not separate files) with commented sections for each step.

### Submission Guard (BUG-01)
- **D-10:** Replace `useState(submitting)` with `useRef` guard set synchronously before the first `await`. This is already specified in REQUIREMENTS.md — capturing here for downstream clarity.

### Claude's Discretion
- Font migration (BUG-14): Keep both Cormorant Garamond and Inter — same fonts, just moved from Google CDN (`globals.css @import`) to `next/font/google` in `layout.tsx`. Remove the `@import` from `globals.css`.
- `robots: noindex` metadata: Add `robots: { index: false }` to the existing `metadata` export in `app/layout.tsx`. Internal tool should not be indexed.
- All other BUG fixes (BUG-04, BUG-06, BUG-07, BUG-09, BUG-10, BUG-11, BUG-12, BUG-13) are mechanical implementations per REQUIREMENTS.md — no user input required.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Full BUG-01 through BUG-14 specifications with implementation notes (primary reference)
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, scope boundary
- `.planning/PROJECT.md` — Project context, stack, key decisions

### Source Files (modify these)
- `app/check/[roomId]/page.tsx` — Main submission flow; BUG-01, BUG-02, BUG-07, BUG-08, BUG-10, BUG-11 all land here
- `app/reports/page.tsx` — Reports list; BUG-04, BUG-09, BUG-13 land here
- `app/layout.tsx` — BUG-14 (next/font + noindex)
- `app/globals.css` — BUG-14 (remove Google Fonts @import)
- `lib/types.ts` — BUG-05 (widen ItemCategory type)
- `lib/i18n.ts` — D-03 (add submitError key in English and Arabic)
- `supabase/schema.sql` — BUG-03, BUG-05, BUG-06 (migration SQL reference)

### Infrastructure
- `supabase/schema.sql` — Current schema baseline; new SQL runs via Supabase MCP, then this file is updated to reflect final state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useLang()` hook in `lib/i18n.ts` — already used on check page; error message translation via `t()` follows same pattern
- `useT()` hook — provides all current translation strings; extend by adding `submitError` key
- `PHOTO_BUCKET` constant in `lib/supabase.ts` — already named, use for storage delete operations (BUG-06)

### Established Patterns
- Error state: `useState<string | null>(null)` for `err` — already used on check page; submission error reuses the same `setErr()` mechanism
- Photo management: `draftPhotos: File[]` state in modal — photo limit counter and disable logic lives here
- Supabase client: `supabase` singleton from `lib/supabase.ts` — all DB and storage calls go through this
- i18n: keys in `lib/i18n.ts`, accessed via `t("keyName")` — follow this pattern for `submitError`

### Integration Points
- Check page `submit()` function — BUG-01 (useRef guard), BUG-02 (compensating delete + keep answers on error), BUG-07 (bulk insert), BUG-08 (photo resize + limit) all modify this function
- Photo file input `onChange` — BUG-08 photo limit (disable at 5, counter) modifies this handler in the modal
- Reports page filter logic — BUG-09 (timezone) and BUG-13 (floor grouping) are isolated to their respective transform functions

</code_context>

<specifics>
## Specific Ideas

- Worker-facing error message verbatim: "Submission failed — please try again" (English); Arabic translation to be determined from existing i18n conventions in `lib/i18n.ts`
- Photo counter format: "3 / 5 photos" (or follow whatever label pattern the existing UI uses)
- Photo cap is a named constant (`MAX_PHOTOS = 5`) — easy to raise later without hunting magic numbers
- Supabase MCP used for all DB operations (pre-check, cleanup, migration) — no manual SQL files for user

</specifics>

<deferred>
## Deferred Ideas

- Raising the photo cap above 5 — can be revisited when storage costs and upload speeds are better understood. One-line change when ready.
- Toast notifications instead of `alert()` — flagged in the review as cosmetic, explicitly out of scope for this pass.
- Test suite — codebase too small to justify now (per PROJECT.md out-of-scope decisions).

</deferred>

---

*Phase: 1-Bug-Fixes-Code-Quality*
*Context gathered: 2026-05-03*
