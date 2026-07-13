import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabasePublicEnv } from "@/lib/env";
import { mapSupabaseTable } from "@/lib/supabase/namespace";

const adminRoles = new Set(["owner", "admin"]);
const portalRoles = new Set(["owner", "admin", "planner", "team_member", "client"]);

function redirectPath(request: NextRequest, pathname: string) {
  const url = (request.nextUrl as URL & { clone: () => URL }).clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.next();
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
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from(mapSupabaseTable("profiles"))
    .select("role,active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.active || !portalRoles.has(profile.role)) {
    loginUrl.searchParams.set("error", "profile");
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname.startsWith("/admin") && !adminRoles.has(profile.role)) {
    return redirectPath(request, "/client/dashboard");
  }

  if (request.nextUrl.pathname === "/client" || request.nextUrl.pathname === "/client/") {
    return redirectPath(request, adminRoles.has(profile.role) ? "/admin" : "/client/dashboard");
  }

  return response;
}
