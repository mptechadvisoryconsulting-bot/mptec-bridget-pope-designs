import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          Bridget Pope<span>Designs</span>
        </div>
        <h1>Reset Password</h1>
        <p className="mini-meta">Enter your email and we will send a secure reset link.</p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
