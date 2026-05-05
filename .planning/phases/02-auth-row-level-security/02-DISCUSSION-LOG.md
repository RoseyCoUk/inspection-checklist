# Phase 2: Auth & Row-Level Security - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 2-Auth-Row-Level-Security
**Areas discussed:** Auth model, Login page UX, Redirect after login, Reports page architecture, Delete error & confirm UX, Session TTL, Login form design

---

## Auth Model

| Option | Description | Selected |
|--------|-------------|----------|
| One Supabase account, email + password | Create a single Supabase Auth user; all managers share that email + password | |
| Env-var password, no Supabase Auth | MANAGER_PASSWORD in env vars; server action checks it and sets a signed session cookie | ✓ |
| Magic link to a shared inbox | Keep SEC-01 magic link but use a shared email address | |

**User's choice:** Env-var password, no Supabase Auth
**Notes:** User wants the team to share one password. Original REQUIREMENTS.md (SEC-01) specified Supabase Auth magic link — this was overridden during discussion. The auth mechanism changes but the middleware redirect, RLS, and server action requirements remain.

---

## Login Page UX

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — just the form | Email input + button, centred, card style matching existing app | ✓ (adapted) |
| Branded — with logo/header | App name/logo above form | |
| You decide | Claude picks clean minimal approach | |

**User's choice:** Minimal — adapted to password-only form (no email field since auth model changed to shared password)
**Notes:** Post-send UX question was deferred ("hold off for now") — Claude's discretion to show inline confirmation on same page.

---

## Redirect After Login

| Option | Description | Selected |
|--------|-------------|----------|
| Always /reports | Simple, no from-URL threading | (initially selected, then overridden) |
| Back to the original URL | Middleware stores path in ?from= param; login action reads it | ✓ |

**User's choice:** Back to original URL
**Notes:** User initially selected "Always /reports" but then explicitly requested redirect-to-original-URL behavior: "When opening the site, and you get redirected to the login page because you weren't logged in, you should get redirected to the url you originally tried to go to."

---

## Reports Page Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Convert to server components | Remove "use client", async server data fetching, small client components for interactivity | ✓ |
| Keep as client components | Add SSR-aware Supabase client, keep existing component structure | |

**User's choice:** Convert to server components
**Notes:** Both `app/reports/page.tsx` and `app/reports/[id]/page.tsx` will become server components. Filters and delete button extracted to small "use client" child components.

---

## Delete Error & Confirm UX

| Option | Description | Selected |
|--------|-------------|----------|
| Keep confirm() dialog, setErr() for errors | Browser confirm guard stays; alert() replaced with inline setErr() | ✓ |
| Remove confirm(), show inline error only | No confirm dialog; server action error shown inline | |
| You decide | Claude picks approach matching existing patterns | |

**User's choice:** Keep confirm() dialog, setErr() for errors

---

## Session TTL

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days of inactivity | Sliding expiry — active managers never interrupted | ✓ |
| 24 hours | Logs out nightly | |
| 30 days | Maximum convenience | |

**User's choice:** 7 days of inactivity (sliding expiry)

---

## Login Form Design

| Option | Description | Selected |
|--------|-------------|----------|
| Password field only — no username | Single password input + button; inline error on failure | ✓ |
| Username + password | Adds username field (unused for auth) | |

**User's choice:** Password field only

---

## Claude's Discretion

- Signed cookie implementation: `jose` (JWT, zero extra dependency). Cookie name: `mgr-session`.
- `SUPABASE_SERVICE_ROLE_KEY` env var for service-role Supabase client on manager routes.
- Server action file locations: `app/actions/auth.ts`, `app/actions/delete-report.ts`.
- Post-login screen: immediate cookie + redirect (no "check your email" state needed with password auth).
- Login page component split: server component outer shell + `"use client"` form component.

## Deferred Ideas

- Per-manager accounts with individual logins and audit trail — out of scope for this fix pass
- MFA/2FA on manager login — deferred, low complexity tolerance for internal tool
- Login page Arabic/RTL translation — deferred, managers are likely English-first
