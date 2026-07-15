import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          Bridget Pope<span>Designs</span>
        </div>
        <h1>Choose a New Password</h1>
        <p className="mini-meta">Use the link from your email, then set a new password below.</p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
