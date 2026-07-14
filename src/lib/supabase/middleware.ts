import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

// /api is excluded from the login-redirect: those routes (e.g. the
// design-system token endpoint) are meant to be called by external
// callers without a browser session — they enforce their own access
// control via Supabase RLS (and eventually bearer tokens for the real
// MCP server) rather than a cookie-based redirect to /login.
// /studio is the V0 theme workspace — a client-side tool with no DB
// dependency, so it's usable without a session (persistence/auth comes later).
const PUBLIC_PATHS = ["/login", "/auth", "/api", "/studio"];

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated users away from protected routes.
 *
 * Called from the root `proxy.ts` (Next.js 16 renamed `middleware.ts` to
 * `proxy.ts`, but the underlying logic lives here for organization).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: avoid writing logic between createServerClient and
  // getClaims(). A simple mistake could make it very hard to debug
  // session-related issues.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const { pathname } = request.nextUrl;
  // The exact root is public — it redirects to the (public) studio, and will be
  // the marketing landing page. Matched exactly, not via startsWith, since
  // every path starts with "/".
  const isPublicPath =
    pathname === "/" || PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: returning the supabaseResponse object as-is is required to
  // keep request/response cookies in sync. Creating a new response here
  // can cause the session to be randomly lost.
  return supabaseResponse;
}
