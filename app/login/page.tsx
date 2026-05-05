"use client";

import { Suspense, useState } from "react";
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
  const [showPassword, setShowPassword] = useState(false);

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
            <div style={{ position: "relative" }}>
              <input
                id="password"
                className="input"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                style={{ width: "100%", paddingRight: 64 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--brown)",
                  fontWeight: 600,
                  padding: "2px 4px",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* D-05: Inline error — shown only on failure */}
          {state && "error" in state && (
            <p
              style={{
                color: "var(--red)",
                fontSize: 14,
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
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
