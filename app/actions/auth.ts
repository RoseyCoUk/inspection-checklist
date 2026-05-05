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
