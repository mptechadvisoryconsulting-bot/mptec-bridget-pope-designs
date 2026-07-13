"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(searchParams.get("error") === "profile" ? "This login does not have a portal profile yet." : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const next = searchParams.get("next");
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    window.location.href = next ?? payload.redirectTo;
  }

  return (
    <form onSubmit={signIn} className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
      <Field label="Username or Email"><Input name="credential" placeholder="Bridget20" required /></Field>
      <Field label="Password"><Input name="password" placeholder="Password" required type="password" /></Field>
      {message ? <p className="form-error">{message}</p> : null}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing In..." : "Sign In"}
      </Button>
      <Link className="btn btn-light" href="/auth/forgot-password">Forgot Password</Link>
    </form>
  );
}
