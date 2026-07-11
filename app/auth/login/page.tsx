import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">Bridget Pope<span>Designs</span></div>
        <h1>Welcome Back</h1>
        <p className="mini-meta">Sign in to the admin CRM or client portal.</p>
        <form className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
          <Field label="Email"><Input type="email" placeholder="ashley@example.com" /></Field>
          <Field label="Password"><Input type="password" placeholder="Password" /></Field>
          <ButtonLink href="/client/dashboard">Client Portal</ButtonLink>
          <ButtonLink href="/admin" variant="secondary">Admin Dashboard</ButtonLink>
          <ButtonLink href="/auth/forgot-password" variant="light">Forgot Password</ButtonLink>
        </form>
      </section>
    </main>
  );
}
