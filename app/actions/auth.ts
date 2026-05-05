"use server";

// Stub — full implementation provided by Plan A (runs in parallel).
// This file satisfies TypeScript imports from app/login/page.tsx until merge.

export type LoginState = { error: string } | { ok: true } | undefined;

export async function loginAction(
  _prevState: LoginState,
  _formData: FormData
): Promise<LoginState> {
  return undefined;
}
