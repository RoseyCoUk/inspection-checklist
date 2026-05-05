---
phase: 02-auth-row-level-security
plan: A
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - lib/supabase.ts
  - lib/session.ts
  - app/actions/auth.ts
  - proxy.ts
autonomous: true
requirements:
  - SEC-01
  - SEC-02

must_haves:
  truths:
    - "An unauthenticated GET /reports returns a redirect to /login?from=/reports, not HTTP 200"
    - "An unauthenticated GET /reports/any-id returns a redirect to /login?from=/reports/any-id"
    - "A correct password submitted to loginAction sets the mgr-session cookie and redirects to the from URL"
    - "An incorrect password submitted to loginAction returns { error: 'Incorrect password' } without setting a cookie"
    - "The mgr-session cookie is httpOnly, Secure, SameSite=lax, 7-day expiry"
    - "Each authenticated request to /reports/* refreshes the cookie TTL (sliding expiry)"
  artifacts:
    - path: "lib/session.ts"
      provides: "JWT sign/verify helpers + cookie read/write using jose and next/headers"
      contains: "mgr-session"
    - path: "app/actions/auth.ts"
      provides: "loginAction server action — validates MANAGER_PASSWORD, sets cookie, redirects"
      contains: "loginAction"
    - path: "proxy.ts"
      provides: "Route protection — redirects /reports/* to /login?from= when cookie absent/invalid"
      contains: "export function proxy"
    - path: "lib/supabase.ts"
      provides: "createServiceClient() export using SUPABASE_SERVICE_ROLE_KEY"
      contains: "createServiceClient"
  key_links:
    - from: "proxy.ts"
      to: "lib/session.ts verifySession()"
      via: "import and await on every /reports/* request"
      pattern: "verifySession"
    - from: "app/actions/auth.ts loginAction()"
      to: "lib/session.ts setSessionCookie()"
      via: "called on successful password match"
      pattern: "setSessionCookie"
    - from: "proxy.ts"
      to: "NextResponse.redirect('/login?from=')"
      via: "when verifySession returns null"
      pattern: "redirect.*login.*from"
---

<objective>
Install `jose`, create the session management utilities (`lib/session.ts`), the login server action (`app/actions/auth.ts`), add `createServiceClient()` to `lib/supabase.ts`, and create `proxy.ts` (Next.js 16 renamed middleware) to gate `/reports/*`.

Purpose: All subsequent plans depend on these auth primitives. Plan B (login page) imports `loginAction`. Plan C (server-component reports pages) imports `createServiceClient` and `verifySession`. Nothing works without this foundation.

Output: `jose` installed, `lib/session.ts`, `app/actions/auth.ts`, updated `lib/supabase.ts`, `proxy.ts` — all committed and TypeScript-clean.
</objective>

<execution_context>
@C:/Users/watkb/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/watkb/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-auth-row-level-security/02-CONTEXT.md

AGENTS.md note (MANDATORY): This is Next.js 16. The middleware file convention is deprecated and renamed to `proxy`. The file must be `proxy.ts` at the project root, and the exported function must be named `proxy` (not `middleware`). Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` for the exact API. The docs show `export function proxy(request: NextRequest)` and `export const config = { matcher: [...] }`. Using `middleware.ts` or `export default function middleware` will NOT work in Next.js 16.

Session pattern comes from `node_modules/next/dist/docs/01-app/02-guides/authentication.md` — stateless JWT cookie with `jose`, `SignJWT` / `jwtVerify`, `cookies()` from `next/headers` (async, must be awaited).

`cookies()` in Next.js 16 is async. Always `const cookieStore = await cookies()` before calling `.get()` or `.set()`.
</context>

<interfaces>
<!-- Current lib/supabase.ts — executor must extend this, not replace it -->

```typescript
// lib/supabase.ts (current, 9 lines)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);

export const PHOTO_BUCKET = "checklist-photos";
```

<!-- New exports to add to lib/supabase.ts (D-09, D-14) -->
```typescript
// createServiceClient() — uses SUPABASE_SERVICE_ROLE_KEY (server-only, never NEXT_PUBLIC_)
// Returns a fresh Supabase client instance per call (not a singleton — safe in server components)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

<!-- jose API (from node_modules/next/dist/docs/01-app/02-guides/authentication.md) -->
```typescript
import { SignJWT, jwtVerify } from 'jose'
// Encrypt:
new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(encodedKey)
// Decrypt:
const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] })
```

<!-- proxy.ts API (from node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md) -->
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {  // named 'proxy', not 'middleware'
  return NextResponse.redirect(new URL('/home', request.url))
}

export const config = {
  matcher: ['/about/:path*'],
}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task A-1: Install jose and create lib/session.ts</name>
  <files>package.json, lib/session.ts</files>
  <read_first>
  - lib/supabase.ts — understand existing exports before adding new ones
  - node_modules/next/dist/docs/01-app/02-guides/authentication.md — lines 562-795 for the jose JWT pattern and cookies() API
  </read_first>
  <action>
Step 1 — Install jose:
```
npm install jose
```
Verify `jose` appears in `package.json` dependencies after install.

Step 2 — Create `lib/session.ts` (new file, does not exist yet):

```typescript
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// SESSION_SECRET must be set in .env.local (at least 32 chars, e.g. openssl rand -base64 32)
const secretKey = process.env.SESSION_SECRET!;
const encodedKey = new TextEncoder().encode(secretKey);

const COOKIE_NAME = "mgr-session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Sign a JWT with { exp } payload. Expiry is baked into the JWT claim. */
export async function signSession(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

/** Verify the JWT string. Returns the payload if valid, null if invalid/expired. */
export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Set (or refresh) the mgr-session cookie.
 * Called from loginAction on successful auth and from proxy.ts on each authenticated request
 * to implement sliding 7-day expiry (D-02).
 */
export async function setSessionCookie(): Promise<void> {
  const token = await signSession();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const cookieStore = await cookies();   // cookies() is async in Next.js 16
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/**
 * Read and verify the mgr-session cookie from the current request.
 * Returns true if the session is valid, false if absent or invalid.
 * Used in server components and server actions.
 */
export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySession(token);
}

/**
 * Read the raw mgr-session cookie value from a NextRequest (for use in proxy.ts).
 * proxy.ts cannot use next/headers — it reads directly from request.cookies.
 */
export function getSessionFromRequest(
  requestCookies: { get: (name: string) => { value: string } | undefined }
): string | undefined {
  return requestCookies.get(COOKIE_NAME)?.value;
}

/** Delete the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
```

Note on env var: `SESSION_SECRET` must be added to `.env.local`. Add a comment at the top of `lib/session.ts`:
```typescript
// Requires env var: SESSION_SECRET (generate: openssl rand -base64 32)
// Requires env var: (see also) MANAGER_PASSWORD in app/actions/auth.ts
```
  </action>
  <verify>
    <automated>grep -c "mgr-session" lib/session.ts && grep -c "verifySession" lib/session.ts && grep -c "setSessionCookie" lib/session.ts</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` contains `"jose"` in dependencies
    - `lib/session.ts` exists and contains `mgr-session` as the COOKIE_NAME constant
    - `lib/session.ts` exports: `signSession`, `verifySession`, `setSessionCookie`, `getSession`, `getSessionFromRequest`, `clearSessionCookie`
    - `lib/session.ts` imports `SignJWT` and `jwtVerify` from `"jose"`
    - `lib/session.ts` imports `cookies` from `"next/headers"`
    - `lib/session.ts` uses `await cookies()` (not `cookies()` without await)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>jose installed; lib/session.ts exists with all session helpers; TypeScript clean</done>
</task>

<task type="auto">
  <name>Task A-2: Create app/actions/auth.ts and proxy.ts; extend lib/supabase.ts</name>
  <files>lib/supabase.ts, app/actions/auth.ts, proxy.ts</files>
  <read_first>
  - lib/supabase.ts — read current contents before appending (9 lines, shown in interfaces above)
  - lib/session.ts — read after Task A-1 creates it, to confirm function names to import
  - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md — lines 27-52 for the exact proxy.ts export shape: `export function proxy(request: NextRequest)` and `export const config = { matcher: [...] }`
  - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md — lines 37-55 for `'use server'` at file top pattern
  </read_first>
  <action>
**Change 1 — Extend lib/supabase.ts (D-09, D-14)**

Append to the existing `lib/supabase.ts` (do NOT remove existing exports):
```typescript
// Server-only service-role client — bypasses RLS by design.
// Only import this in server components and server actions, NEVER in client components.
// Protected by the proxy.ts session gate on all /reports/* routes.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Change 2 — Create app/actions/auth.ts (new file) (D-01, D-02, D-03, D-06)**

```typescript
"use server";
// Requires env var: MANAGER_PASSWORD (shared manager password, server-only)
// Requires env var: SESSION_SECRET (JWT signing key, see lib/session.ts)

import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/session";

export type LoginState = { error: string } | { ok: true } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password");

  // D-01: Compare against MANAGER_PASSWORD env var (server-only, never NEXT_PUBLIC_)
  if (
    typeof password !== "string" ||
    password !== process.env.MANAGER_PASSWORD
  ) {
    // D-03, D-05: Return inline error — no redirect, form stays mounted
    return { error: "Incorrect password" };
  }

  // D-02: Set signed cookie with 7-day expiry
  await setSessionCookie();

  // D-06: Read ?from= param; default to /reports
  // formData carries a hidden "from" field set by the LoginForm component
  const from = formData.get("from");
  const destination =
    typeof from === "string" && from.startsWith("/") ? from : "/reports";

  // redirect() throws internally — must be called outside try/catch
  redirect(destination);
}
```

**Change 3 — Create proxy.ts (new file at project root) (D-06, D-07, SEC-02)**

CRITICAL: In Next.js 16, this file is `proxy.ts` NOT `middleware.ts`. The exported function is named `proxy`. Using `middleware.ts` or `export default function middleware` will NOT be picked up by Next.js 16.

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, setSessionCookie as _setSessionCookie } from "@/lib/session";

// IMPORTANT: proxy.ts cannot use next/headers — must read cookies from request object directly.
// next/headers is only available inside server components and server actions (RSC context).

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only gate /reports and /reports/* (D-07)
  if (!pathname.startsWith("/reports")) {
    return NextResponse.next();
  }

  // Read the mgr-session cookie directly from the request (not via next/headers)
  const token = request.cookies.get("mgr-session")?.value;

  if (!token) {
    // D-07: Redirect to /login?from={original_path}
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const valid = await verifySession(token);
  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // D-02: Refresh the cookie TTL on each authenticated request (sliding expiry).
  // In proxy.ts we cannot call setSessionCookie() (it uses next/headers).
  // Instead, refresh the cookie by setting it on the response.
  const { SignJWT } = await import("jose");
  const secretKey = process.env.SESSION_SECRET!;
  const encodedKey = new TextEncoder().encode(secretKey);
  const freshToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);

  const response = NextResponse.next();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  response.cookies.set("mgr-session", freshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return response;
}

// Only run proxy on /reports/* — skip static assets, API routes, etc.
export const config = {
  matcher: ["/reports/:path*"],
};
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `lib/supabase.ts` contains `createServiceClient` function export
    - `lib/supabase.ts` still contains `export const supabase` and `export const PHOTO_BUCKET` (not removed)
    - `app/actions/auth.ts` exists and starts with `"use server"`
    - `app/actions/auth.ts` exports `loginAction` function
    - `app/actions/auth.ts` references `process.env.MANAGER_PASSWORD` (not NEXT_PUBLIC_)
    - `app/actions/auth.ts` returns `{ error: "Incorrect password" }` on mismatch (exact string, per D-05)
    - `proxy.ts` exists at project root (NOT `middleware.ts`)
    - `proxy.ts` exports `export async function proxy(request: NextRequest)` (named `proxy`, not `middleware`)
    - `proxy.ts` contains `export const config` with matcher `["/reports/:path*"]`
    - `proxy.ts` reads `request.cookies.get("mgr-session")` (not next/headers)
    - `proxy.ts` sets a fresh `mgr-session` cookie on the response for sliding expiry
    - `proxy.ts` redirects to `/login?from={pathname}` when session is missing or invalid
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>lib/supabase.ts has createServiceClient; app/actions/auth.ts and proxy.ts created; all TypeScript-clean</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → proxy.ts | Every /reports/* request crosses here; cookie is the credential |
| LoginForm → loginAction | FormData (password) is untrusted client input |
| proxy.ts → lib/session.ts | JWT token read from cookie, must be verified before granting access |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02A-01 | Spoofing | mgr-session cookie | mitigate | Cookie is a signed JWT (HS256, SESSION_SECRET); tampering invalidates the signature, jwtVerify rejects it |
| T-02A-02 | Tampering | loginAction password comparison | mitigate | Compared server-side against MANAGER_PASSWORD env var; never exposed to client; no timing side-channel concern at this scale |
| T-02A-03 | Information Disclosure | MANAGER_PASSWORD exposure | mitigate | Stored in server-only env var (no NEXT_PUBLIC_ prefix); loginAction has 'use server' — never bundled into client JS |
| T-02A-04 | Elevation of Privilege | Cookie theft (XSS) | mitigate | httpOnly=true prevents JS cookie access; Secure=true requires HTTPS; SameSite=lax blocks CSRF |
| T-02A-05 | Denial of Service | Brute-force login attempts | accept | Internal tool, no public sign-up; shared password; acceptable risk for this threat model |
| T-02A-06 | Tampering | `from` redirect param injection | mitigate | loginAction validates `from` starts with `/` before redirecting; external URLs rejected |
</threat_model>

<verification>
1. `grep -c "createServiceClient" lib/supabase.ts` — returns 1
2. `grep -c "mgr-session" lib/session.ts` — returns ≥ 1
3. `grep -c "loginAction" app/actions/auth.ts` — returns ≥ 1
4. `grep "^\"use server\"" app/actions/auth.ts` — returns the first line
5. `ls proxy.ts` — file exists (NOT middleware.ts)
6. `grep -c "export.*function proxy" proxy.ts` — returns 1
7. `grep -c "matcher.*reports" proxy.ts` — returns 1
8. `npx tsc --noEmit` — exits 0
</verification>

<success_criteria>
- `jose` installed and in package.json dependencies
- `lib/session.ts` exports sign/verify/set/get/clear helpers using jose + next/headers
- `app/actions/auth.ts` is a server action that validates MANAGER_PASSWORD, sets mgr-session cookie, redirects to ?from= or /reports
- `proxy.ts` at project root intercepts /reports/* and redirects unauthenticated requests to /login?from={path}
- `lib/supabase.ts` exports `createServiceClient()` alongside existing `supabase` and `PHOTO_BUCKET`
- `npx tsc --noEmit` exits 0 with zero errors
</success_criteria>

<output>
After completion, create `.planning/phases/02-auth-row-level-security/02-A-SUMMARY.md` using the summary template.
</output>
