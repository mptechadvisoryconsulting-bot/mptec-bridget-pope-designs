import { redirect } from "next/navigation";
import { OwnerClientPortalGate } from "@/components/client/OwnerClientPortalGate";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";

export const dynamic = "force-dynamic";

export default async function ClientRootPage() {
  const { profile } = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login?next=/client/dashboard");
  }

  if (!profile.active) {
    redirect("/auth/login?error=profile");
  }

  if (adminRoles.has(profile.role)) {
    return <OwnerClientPortalGate role={profile.role} />;
  }

  if (profile.role === "client") {
    redirect("/client/dashboard");
  }

  redirect("/auth/login?error=profile");
}
