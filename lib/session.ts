// Requires env var: SESSION_SECRET (generate: openssl rand -base64 32)
// Requires env var: (see also) MANAGER_PASSWORD in app/actions/auth.ts
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
  const cookieStore = await cookies(); // cookies() is async in Next.js 16
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
