"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type LoginPath = "studio" | "client";

function pathFromNext(next: string | null): LoginPath {
  if (next?.startsWith("/client")) return "client";
  if (next?.startsWith("/admin")) return "studio";
  return "studio";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [path, setPath] = useState<LoginPath>(() => pathFromNext(searchParams.get("next")));
  const [message, setMessage] = useState(searchParams.get("error") === "profile" ? "This login does not have a portal profile yet." : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copy = useMemo(
    () =>
      path === "studio"
        ? {
            hint: "Sign in to manage projects, invoices, and studio workflows.",
            submit: "Continue to Studio",
            submitting: "Signing In...",
            credentialPlaceholder: "Bridget20",
          }
        : {
            hint: "Sign in to view your event details, invoices, and inspiration.",
            submit: "Continue to Client Access",
            submitting: "Signing In...",
            credentialPlaceholder: "you@email.com",
          },
    [path],
  );

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const credential = String(formData.get("credential") ?? "");
    const password = String(formData.get("password") ?? "");
    const response = await fetch("/api/auth/password-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, password }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      setMessage(payload.message ?? "Unable to sign in.");
      setIsSubmitting(false);
      return;
    }

    // Role-based redirect from the API remains authoritative; path tabs are UX only.
    const next = searchParams.get("next");
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    window.location.href = next ?? payload.redirectTo;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div aria-label="Sign-in path" className="login-path-tabs" role="tablist">
        <button
          aria-selected={path === "studio"}
          className={path === "studio" ? "login-path-tab is-active" : "login-path-tab"}
          onClick={() => setPath("studio")}
          role="tab"
          type="button"
        >
          Studio login
        </button>
        <button
          aria-selected={path === "client"}
          className={path === "client" ? "login-path-tab is-active" : "login-path-tab"}
          onClick={() => setPath("client")}
          role="tab"
          type="button"
        >
          Client access
        </button>
      </div>
      <p className="mini-meta" style={{ marginTop: 14 }}>
        {copy.hint}
      </p>
      <form onSubmit={signIn} className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 16 }}>
        <Field label="Username or Email">
          <Input name="credential" placeholder={copy.credentialPlaceholder} required />
        </Field>
        <Field label="Password">
          <Input name="password" placeholder="Password" required type="password" />
        </Field>
        {message ? <p className="form-error">{message}</p> : null}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? copy.submitting : copy.submit}
        </Button>
        <Link className="btn btn-light" href="/auth/forgot-password">
          Forgot Password
        </Link>
      </form>
    </div>
  );
}
