import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

// /api is excluded from the login-redirect: those routes (e.g. the
// design-system token endpoint) are meant to be called by external
// callers without a browser session — they enforce their own access
// control via Supabase RLS (and eventually bearer tokens for the real
// MCP server) rather than a cookie-based redirect to /login.
// NOTE: /studio is intentionally NOT public — the access model requires a free
// account to enter the studio (see FREEMIUM-GATING-PLAN.md "Access model v2").
const PUBLIC_PATHS = ["/login", "/auth", "/api"];

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated users away from protected routes.
 *
 * Called from the root `proxy.ts` (Next.js 16 renamed `middleware.ts` to
 * `proxy.ts`, but the underlying logic lives here for organization).
 */
export async function updateSession(request: NextRequest) {
  // Canonical host: redirect the www subdomain to the bare apex (tokn.host is
  // canonical). Done here rather than via Vercel's domain-redirect UI so it's
  // reliable and version-controlled. Preserves path + query; 308 keeps method.
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const apex = host.slice(4);
    return NextResponse.redirect(
      `https://${apex}${request.nextUrl.pathname}${request.nextUrl.search}`,
      308
    );
  }

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
