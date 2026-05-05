---
phase: 02-auth-row-level-security
plan: A
subsystem: auth
tags: [auth, jwt, session, proxy, supabase]
dependency_graph:
  requires: []
  provides: [auth-primitives, session-management, route-gate, service-client]
  affects: [02-B, 02-C, 02-D]
tech_stack:
  added: [jose ^6.2.3]
  patterns: [stateless-jwt-cookie, proxy-route-gate, service-role-client, sliding-expiry]
key_files:
  created:
    - lib/session.ts
    - app/actions/auth.ts
    - proxy.ts
  modified:
    - lib/supabase.ts
    - package.json
    - package-lock.json
decisions:
  - jose used for JWT signing/verification (HS256 with SESSION_SECRET env var)
  - proxy.ts at project root (Next.js 16 convention — replaces middleware.ts)
  - export function proxy (not export default / not middleware)
  - proxy.ts reads cookies from request.cookies directly (next/headers unavailable in proxy context)
  - Sliding expiry implemented in proxy.ts by re-signing JWT and setting fresh cookie on each authenticated response
  - setSessionCookie() uses async cookies() from next/headers (Next.js 16 async API)
  - createServiceClient() is a fresh instance per call (not singleton — safe in server components)
  - loginAction validates from param starts with / before redirecting (open redirect mitigation T-02A-06)
metrics:
  duration: 2min
  completed: 2026-05-05
  tasks: 2
  files: 6
---

# Phase 02 Plan A: Auth Foundation Summary

JWT cookie session management installed; all /reports/* routes gated by proxy.ts using jose HS256 signed cookies with 7-day sliding expiry.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| A-1 | Install jose and create lib/session.ts | 79485e0 | package.json, package-lock.json, lib/session.ts |
| A-2 | Create auth action, proxy gate, extend supabase client | 402b648 | lib/supabase.ts, app/actions/auth.ts, proxy.ts |

## What Was Built

### lib/session.ts
JWT cookie helpers using jose. Exports:
- `signSession()` — signs a new 7-day JWT
- `verifySession(token)` — verifies token, returns boolean
- `setSessionCookie()` — signs and sets `mgr-session` cookie (httpOnly, Secure, SameSite=lax, 7-day expiry)
- `getSession()` — reads and verifies cookie from next/headers (server components)
- `getSessionFromRequest(requestCookies)` — reads raw cookie value from NextRequest (proxy context)
- `clearSessionCookie()` — deletes the session cookie (logout)

Cookie name: `mgr-session`. All functions use `await cookies()` (Next.js 16 async API).

### app/actions/auth.ts
Server action (`"use server"` at file top). `loginAction(_prevState, formData)`:
- Validates `formData.get("password")` against `process.env.MANAGER_PASSWORD`
- Returns `{ error: "Incorrect password" }` on mismatch (no cookie set, no redirect)
- On success: calls `setSessionCookie()`, then `redirect(destination)` where destination is `?from=` param (validated to start with `/`) or `/reports`

### proxy.ts (project root — Next.js 16)
Route gate for `/reports/*`. Named export `proxy` (not `middleware`). Config matcher: `["/reports/:path*"]`.
- Passes through all non-/reports requests immediately
- Reads `mgr-session` from `request.cookies` (not next/headers)
- Redirects to `/login?from={pathname}` if cookie absent or JWT invalid
- On valid session: re-signs JWT and sets fresh cookie on response for sliding expiry

### lib/supabase.ts (extended)
Added `createServiceClient()` — returns a fresh Supabase client using `SUPABASE_SERVICE_ROLE_KEY`. Existing `supabase` and `PHOTO_BUCKET` exports unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data or stub implementations.

## Threat Flags

No new security surface beyond what is captured in the plan's threat model.

## Environment Variables Required

These must be added to `.env.local` before the auth system is functional:
- `SESSION_SECRET` — at least 32 chars, generate with: `openssl rand -base64 32`
- `MANAGER_PASSWORD` — shared manager password (server-only, never NEXT_PUBLIC_)
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings (server-only)

## Self-Check: PASSED

- lib/session.ts: FOUND
- app/actions/auth.ts: FOUND
- proxy.ts: FOUND
- lib/supabase.ts createServiceClient: FOUND
- Commit 79485e0: FOUND
- Commit 402b648: FOUND
- npx tsc --noEmit: exits 0
