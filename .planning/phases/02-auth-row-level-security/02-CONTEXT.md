# Phase 2: Auth & Row-Level Security - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Gate `/reports` and `/reports/*` behind a shared manager password, lock down all 5 Supabase tables with RLS so the anon key cannot read or delete manager data, and remove the client-side delete path.

No Supabase Auth, no user accounts, no magic links — the team shares one password stored in an environment variable.

</domain>

<decisions>
## Implementation Decisions

### Auth Model (replaces SEC-01 as written)
- **D-01:** No Supabase Auth. Authentication is a shared password stored in `MANAGER_PASSWORD` (server-only env var, never exposed to the client). Any manager who knows the password can log in.
- **D-02:** Session stored as a signed cookie (7-day sliding expiry). Each authenticated request to `/reports/*` refreshes the cookie TTL so active managers are never logged out mid-session.
- **D-03:** Login server action validates the submitted password against `process.env.MANAGER_PASSWORD`. On match: set signed cookie and redirect to the `from` URL. On mismatch: return an error shown inline ("Incorrect password" — no redirect, form stays).

### Login Page (`/login`)
- **D-04:** Single password input + "Log in" button. No username field — one shared credential, username adds nothing. Minimal card style matching the rest of the app (existing Tailwind v4 + `globals.css` variables).
- **D-05:** Wrong password → inline error "Incorrect password" on the same page. No page reload, no redirect.

### Redirect After Login
- **D-06:** Middleware stores the originally-requested path as a `?from=` query param when redirecting to `/login`. The login action reads `?from=` and redirects there after successful auth. Defaults to `/reports` if no `?from=` param is present.
- **D-07:** Unauthenticated requests to `/reports` or `/reports/*` → redirect to `/login?from={original_path}`.

### Reports Page Architecture
- **D-08:** Convert `app/reports/page.tsx` and `app/reports/[id]/page.tsx` from `"use client"` components to server components. Data fetching (Supabase queries) moves to async server functions using the service-role client. Client interactivity (filters UI, delete button) extracted into small `"use client"` child components.
- **D-09:** Server components use the service-role Supabase client (`SUPABASE_SERVICE_ROLE_KEY`) — bypasses RLS by design, protected by the middleware cookie gate.

### Delete Flow
- **D-10:** Keep the `confirm()` browser dialog before delete — fine for an internal tool, provides accidental-delete protection.
- **D-11:** Replace the current `alert(error.message)` on delete failure with `setErr()` inline error, matching the pattern from `app/check/[roomId]/page.tsx`. The delete server action returns `{ error: string } | { ok: true }`.
- **D-12:** Delete server action verifies the session cookie before executing. If the cookie is missing/invalid, returns an error (not a redirect — the middleware already handles unauthenticated access).

### RLS Strategy
- **D-13:** Worker path (check page, room list) keeps the existing anon Supabase client — insert-only on `reports` and `report_items`, select-only on `rooms`, `room_types`, `checklist_items`. Anon client is NOT used on the reports/manager side.
- **D-14:** Manager server components use the service-role client. This bypasses RLS on purpose — the middleware cookie check is the access gate for manager routes. RLS still protects against direct DB access via the anon key.

### Claude's Discretion
- Signed cookie implementation: use `jose` (built-in to Node 18+, zero extra dependency) for a compact JWT cookie. Cookie name: `mgr-session`. Payload: `{ exp: timestamp }`.
- `SUPABASE_SERVICE_ROLE_KEY` env var for all server-side Supabase clients on manager routes.
- Login route: `app/login/page.tsx` (server component with a `"use client"` form component).
- Server action for auth: `app/actions/auth.ts` — `loginAction(formData)`.
- Server action for delete: `app/actions/delete-report.ts` — `deleteReportAction(reportId)`.
- Post-login page: Since this is password-based (not magic link), there is no "check your email" state. Correct password → immediate cookie set + redirect.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — SEC-01 through SEC-04 (note: SEC-01 auth model changed from magic link to env-var password per D-01; all other requirements stand)
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, scope boundary
- `.planning/PROJECT.md` — Stack (Next.js 16 App Router, React 19, Supabase, Tailwind v4), key decisions

### Source Files (modify or replace)
- `lib/supabase.ts` — Current anon client; needs a server-side service-role variant added
- `app/reports/page.tsx` — Convert from client component to server component (D-08)
- `app/reports/[id]/page.tsx` — Convert from client component to server component (D-08)
- `app/layout.tsx` — May need session/auth provider if needed by child components

### Existing Patterns to Follow
- `app/check/[roomId]/page.tsx` — Error display pattern (`setErr()`, inline error message) that D-11 replicates for delete failures
- `lib/i18n.ts` — Translation key pattern (`t("keyName")`) if login error needs Arabic translation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `setErr()` / `useState<string | null>` error pattern — established in check page; delete error (D-11) follows the same pattern
- Tailwind v4 card/container styles in `globals.css` — login page (D-04) reuses these directly, no new component needed
- `supabase` singleton from `lib/supabase.ts` — anon client stays for worker routes; a new service-role client is added alongside it

### Established Patterns
- Error state: `useState<string | null>(null)` + inline `<p style={{ color: "var(--red)" }}>` — login form and delete error both use this
- Server actions: none exist yet — `app/actions/auth.ts` and `app/actions/delete-report.ts` are the first two
- All current pages are `"use client"` — reports pages are the first server components in the app

### Integration Points
- `middleware.ts` (new, at root) — intercepts every request to `/reports` and `/reports/*`; reads `mgr-session` cookie; redirects to `/login?from={path}` if missing/invalid
- `app/login/page.tsx` (new) — entry point for unauthenticated managers
- `app/reports/page.tsx:472` — client-side delete call to remove and replace with server action invocation
- `lib/supabase.ts` — add `createServiceClient()` export using `SUPABASE_SERVICE_ROLE_KEY` (server-only, never imported from client files)

</code_context>

<specifics>
## Specific Ideas

- Login error copy verbatim: "Incorrect password"
- Session cookie name: `mgr-session`
- Cookie expiry: 7-day sliding (refresh on each authenticated request)
- Redirect default (no `?from=`): `/reports`
- The current delete confirmation dialog copy: whatever `confirm("...")` text exists — keep as-is
- Worker submission on the check page must continue to work after RLS is enabled — validate this in the success criteria

</specifics>

<deferred>
## Deferred Ideas

- Per-manager accounts (individual logins, audit trail of who deleted what) — not in scope of this fix pass; shared password is the explicit choice
- MFA / 2FA on the manager login — deferred; internal tool, low risk tolerance for added complexity
- Login page Arabic translation — the rest of the app has Arabic/RTL support; login page deferred to keep scope tight (managers are likely English-first users)

</deferred>

---

*Phase: 2-Auth-Row-Level-Security*
*Context gathered: 2026-05-04*
