import { OwnerClientPortalGate } from "@/components/client/OwnerClientPortalGate";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClientPortalAccessPage() {
  const { profile } = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/login?next=/client/dashboard");
  }

  if (!profile.active) {
    redirect("/auth/login?error=profile");
  }

  if (profile.role === "client") {
    redirect("/client/dashboard");
  }

  if (!adminRoles.has(profile.role)) {
    redirect("/auth/login?error=profile");
  }

  return <OwnerClientPortalGate role={profile.role} />;
}
