import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">Bridget Pope<span>Designs</span></div>
        <h1>Reset Password</h1>
        <p className="mini-meta">Enter your email and we will send a secure reset link.</p>
        <form className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
          <Field label="Email"><Input type="email" placeholder="you@example.com" /></Field>
          <ButtonLink href="/auth/reset-password">Send Reset Link</ButtonLink>
        </form>
      </section>
    </main>
  );
}
