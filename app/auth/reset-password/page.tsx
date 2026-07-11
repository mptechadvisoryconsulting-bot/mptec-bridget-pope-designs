import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">Bridget Pope<span>Designs</span></div>
        <h1>Choose a New Password</h1>
        <form className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
          <Field label="Password"><Input type="password" /></Field>
          <Field label="Confirm Password"><Input type="password" /></Field>
          <ButtonLink href="/client/dashboard">Update Password</ButtonLink>
        </form>
      </section>
    </main>
  );
}
