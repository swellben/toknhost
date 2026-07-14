import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

// Handles the redirect from OAuth providers and email confirmation / magic
// links. Exchanges the `code` for a session and forwards to `next`.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/studio";

  // Behind Vercel's proxy, request.url's origin can be an internal host, which
  // would set the session cookie on the wrong domain. Prefer the external host
  // the browser actually used.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const redirectBase =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `${forwardedProto}://${forwardedHost}`;

  if (code) {
    const cookieStore = await cookies();
    // Create the redirect response first and write the session cookies directly
    // onto it — cookies set via next/headers don't reliably attach to a
    // separately-constructed NextResponse.redirect(), which drops the session.
    const response = NextResponse.redirect(`${redirectBase}${next}`);
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(`${redirectBase}/login?error=auth-callback-failed`);
}
