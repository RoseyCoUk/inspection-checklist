---
phase: 02-auth-row-level-security
plan: B
type: execute
wave: 1
depends_on: []
files_modified:
  - app/login/page.tsx
autonomous: true
requirements:
  - SEC-01

must_haves:
  truths:
    - "Visiting /login renders a password input and a Log in button — no username field"
    - "Submitting the correct password sets the mgr-session cookie and navigates to the ?from= URL (or /reports)"
    - "Submitting the wrong password shows 'Incorrect password' inline on the same page without a page reload"
    - "The login form is visually consistent with the rest of the app (uses .card, .input, .btn CSS classes from globals.css)"
    - "The Log in button is disabled while the action is pending"
  artifacts:
    - path: "app/login/page.tsx"
      provides: "Login page — server component shell with LoginForm client component inline"
      contains: "LoginForm"
  key_links:
    - from: "LoginForm (client component)"
      to: "loginAction (server action)"
      via: "useActionState(loginAction, undefined) + <form action={action}>"
      pattern: "loginAction"
    - from: "LoginForm"
      to: "state?.error"
      via: "inline <p> rendered when state has error property"
      pattern: "state.*error"
    - from: "hidden input name=\"from\""
      to: "loginAction formData.get(\"from\")"
      via: "FormData carries the ?from= param from the URL"
      pattern: "name=\"from\""
---

<objective>
Create the login page at `app/login/page.tsx`. The page is a server component shell that renders a "use client" LoginForm component. The form uses `useActionState` to drive the `loginAction` server action and display inline errors.

Purpose: This is the entry point for manager authentication. Plan A creates the server action; this plan wires up the UI.

Output: `app/login/page.tsx` with server component shell + inline LoginForm client component.
</objective>

<execution_context>
@C:/Users/watkb/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/watkb/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-auth-row-level-security/02-CONTEXT.md

AGENTS.md note: Next.js 16 / React 19. `useActionState` is available in React 19 (imported from `react`, not `react-dom`). The pattern is:
```typescript
const [state, action, pending] = useActionState(loginAction, undefined)
```
Form uses `<form action={action}>` — this is the React 19 form action pattern documented in node_modules/next/dist/docs/01-app/02-guides/authentication.md lines 204-248.

`searchParams` in server components is `Promise<{ from?: string }>` in Next.js 16 — must be awaited.
</context>

<interfaces>
<!-- CSS classes available from globals.css (relevant to D-04) -->
```
.card          — white card with border, border-radius 10px, padding 20px, shadow
.input         — form input styling
.btn           — primary button
.btn.ghost     — ghost button variant
.hdr           — header with gold bottom border
.muted         — lighter text color (var(--text-light))
CSS vars: --brown, --gold, --beige, --red, --bg, --white, --text
```

<!-- loginAction signature (from Plan A, app/actions/auth.ts) -->
```typescript
export type LoginState = { error: string } | { ok: true } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState>
// On wrong password: returns { error: "Incorrect password" }
// On correct password: calls redirect() — never returns to caller
```

<!-- useActionState pattern (React 19, per authentication.md lines 204-248) -->
```typescript
'use client'
import { useActionState } from 'react'
import { loginAction } from '@/app/actions/auth'

const [state, action, pending] = useActionState(loginAction, undefined)
// state: LoginState (undefined initially, then { error: string } on failure)
// action: bound action to pass to <form action={action}>
// pending: boolean — true while server action is running
```

<!-- Next.js 16 searchParams — async in server components -->
```typescript
// page.tsx server component:
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams
  // ...
}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task B-1: Create app/login/page.tsx with server shell and LoginForm</name>
  <files>app/login/page.tsx</files>
  <read_first>
  - app/layout.tsx — understand the shell/card layout and font classes used app-wide
  - app/globals.css — read the card, input, btn, hdr, and muted CSS class definitions before writing styles
  - app/actions/auth.ts — confirm the loginAction signature and LoginState type (created in Plan A Task A-2)
  - node_modules/next/dist/docs/01-app/02-guides/authentication.md — lines 204-248 for the useActionState + form action pattern
  </read_first>
  <action>
Create `app/login/page.tsx` as a new file. The file contains two exports: the default server component (`LoginPage`) and an inner client component (`LoginForm`). Both live in the same file.

ARCHITECTURE NOTE: `LoginForm` is a `"use client"` component. In Next.js 16, client components cannot be defined in files that are also server components — HOWEVER, they CAN be defined in the same file IF the file starts as a server component and the client component is defined after the `"use client"` directive is placed on the inner component itself. The correct pattern for a single-file approach is to put BOTH in the same file with no `"use client"` at the file top — the server component at the bottom (default export), importing the client component defined above it.

The cleanest approach for this simple case: use a single file where `LoginForm` is a client component defined with `"use client"` at its own scope. In Next.js 16 App Router, co-locating a client component in the same file as a server component is done by NOT adding `"use client"` to the file itself, and instead marking the LoginForm with the directive inline. However, this is not directly supported — Next.js requires `"use client"` at the file boundary.

CORRECT APPROACH: Put both in the same file. Place `"use client"` at the top (making the whole file a client component). The LoginPage server-side work (reading searchParams) is minimal and can be handled via the URL search params read client-side using `useSearchParams()` hook instead.

```typescript
"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "@/app/actions/auth";

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/reports";
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined
  );

  return (
    <main>
      <div className="hdr">
        <h1>Manager Login</h1>
      </div>
      <div className="card" style={{ maxWidth: 360, margin: "0 auto" }}>
        <form action={action}>
          {/* D-06: Pass the ?from= destination through FormData */}
          <input type="hidden" name="from" value={from} />

          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 6,
                color: "var(--brown)",
                fontSize: 14,
              }}
            >
              Password
            </label>
            {/* D-04: single password field, no username */}
            <input
              id="password"
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              style={{ width: "100%" }}
            />
          </div>

          {/* D-05: Inline error "Incorrect password" — shown only on failure */}
          {state && "error" in state && (
            <p
              style={{
                color: "var(--red)",
                fontSize: 14,
                marginBottom: 12,
                margin: "0 0 12px",
              }}
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            className="btn"
            disabled={pending}
            style={{ width: "100%" }}
          >
            {pending ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
```

Note on `useSearchParams()`: In Next.js App Router, `useSearchParams()` in a client component reads the URL search params. This is the correct way to access `?from=` in a client component without needing a server component wrapper. The `Suspense` boundary requirement for `useSearchParams()` is handled by the fact that this is the entire page component — the App Router's built-in streaming handles it.

If Next.js requires a Suspense boundary (it may warn in development), wrap `<LoginForm />` in the default export:
```typescript
import { Suspense } from "react";
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `app/login/page.tsx` exists
    - File contains `useActionState` import from `"react"`
    - File contains `loginAction` import from `"@/app/actions/auth"`
    - File contains `type="password"` input with `name="password"`
    - File does NOT contain any `type="email"` or `type="text"` username input (D-04 — no username field)
    - File contains `<input type="hidden" name="from"` to pass the destination
    - File contains `state && "error" in state` conditional to display the inline error (D-05)
    - The error message string displayed is exactly the value from `state.error` (not hardcoded "Incorrect password")
    - File contains `disabled={pending}` on the submit button
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>app/login/page.tsx created with password-only form, useActionState wiring, inline error display, and ?from= passthrough; TypeScript clean</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → LoginForm | User-controlled form submission; password field value is untrusted |
| LoginForm → loginAction | FormData crosses the RSC network boundary to the server action |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02B-01 | Information Disclosure | Password field | mitigate | `type="password"` prevents screen reading; `autoComplete="current-password"` uses browser credential manager; never logged or displayed |
| T-02B-02 | Tampering | `from` hidden field injection | mitigate | loginAction validates `from` starts with `/` before redirecting; client manipulation of `from` cannot redirect to external URL |
| T-02B-03 | Spoofing | CSRF on login form | accept | SameSite=lax on mgr-session cookie prevents cross-site form submission; login is low-value CSRF target (attacker would log themselves in) |
</threat_model>

<verification>
1. `ls app/login/page.tsx` — file exists
2. `grep -c "useActionState" app/login/page.tsx` — returns 1
3. `grep -c "loginAction" app/login/page.tsx` — returns ≥ 1
4. `grep -c 'type="password"' app/login/page.tsx` — returns 1
5. `grep -c 'type="email"\|type="text"' app/login/page.tsx` — returns 0 (no username field)
6. `grep -c 'name="from"' app/login/page.tsx` — returns 1
7. `npx tsc --noEmit` — exits 0
</verification>

<success_criteria>
- `app/login/page.tsx` exists with password-only login form
- Form submits via loginAction using useActionState
- Wrong password shows inline error "Incorrect password" (from state.error)
- `?from=` is passed through a hidden input and forwarded to loginAction
- Submit button disabled during pending state
- Card/input/btn CSS classes used — visually consistent with app
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/phases/02-auth-row-level-security/02-B-SUMMARY.md` using the summary template.
</output>
