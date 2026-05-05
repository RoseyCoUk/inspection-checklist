import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/session";

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
