import { displayName } from "@/lib/auth/current-profile";
import { requireClientPortalContext } from "@/lib/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const { profile } = await requireClientPortalContext("/client/profile");

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Profile</span>
          <h1>{displayName(profile)}</h1>
          <p className="mini-meta">Your portal identity is managed by Bridget Pope Designs.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Account Details</h2>
        <ul className="list">
          <li><span>Username</span><strong>{profile.username ?? "Not set"}</strong></li>
          <li><span>Email</span><strong>{profile.email ?? "Not set"}</strong></li>
          <li><span>Phone</span><strong>{profile.phone ?? "Not set"}</strong></li>
        </ul>
      </section>
    </div>
  );
}
