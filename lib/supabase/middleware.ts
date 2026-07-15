import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabasePublicEnv } from "@/lib/env";
import { mapSupabaseTable } from "@/lib/supabase/namespace";

const adminRoles = new Set(["owner", "admin"]);
const portalRoles = new Set(["owner", "admin", "planner", "team_member", "client"]);

/**
 * /admin and /client responses carry per-user data and must never be cached by shared caches,
 * CDNs, or the browser's back/forward cache — otherwise one authenticated user's page could be
 * served to the next visitor (or a signed-out view of the same browser).
 */
function withNoStore<T extends { headers: Headers }>(response: T): T {
  response.headers.set("Cache-Control", "no-store, private");
  return response;
}

function redirectPath(request: NextRequest, pathname: string) {
  const url = (request.nextUrl as URL & { clone: () => URL }).clone();
  url.pathname = pathname;
  url.search = "";
  return withNoStore(NextResponse.redirect(url));
}

export async function updateSession(request: NextRequest) {
  if (!hasSupabasePublicEnv()) {
    return withNoStore(NextResponse.next());
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loginUrl = (request.nextUrl as URL & { clone: () => URL }).clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", request.nextUrl.pathname);

  if (!user) {
    return withNoStore(NextResponse.redirect(loginUrl));
  }

  const { data: profile } = await supabase
    .from(mapSupabaseTable("profiles"))
    .select("role,active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.active || !portalRoles.has(profile.role)) {
    loginUrl.searchParams.set("error", "profile");
    return withNoStore(NextResponse.redirect(loginUrl));
  }

  if (request.nextUrl.pathname.startsWith("/admin") && !adminRoles.has(profile.role)) {
    return redirectPath(request, "/client/dashboard");
  }

  if (request.nextUrl.pathname === "/client" || request.nextUrl.pathname === "/client/") {
    return redirectPath(request, adminRoles.has(profile.role) ? "/admin" : "/client/dashboard");
  }

  return withNoStore(response);
}
