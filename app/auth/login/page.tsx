import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          Bridget Pope<span>Designs</span>
        </div>
        <h1>Welcome Back</h1>
        <p className="mini-meta">Studio is for Bridget&apos;s team. Client access is for event guests and hosts.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
