"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { safeFetch } from "@/lib/safe-fetch";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const result = await safeFetch<{ success?: boolean; message?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: { email: String(form.get("email") ?? "") },
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setIsError(true);
      setMessage(result.data?.message ?? result.message);
      return;
    }

    setIsError(false);
    setMessage(result.data?.message ?? "If an account exists for that email, a reset link is on the way.");
    event.currentTarget.reset();
  }

  return (
    <form className="form-grid" onSubmit={onSubmit} style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
      <Field label="Email">
        <Input name="email" placeholder="you@example.com" required type="email" />
      </Field>
      {message ? <p className={isError ? "form-error" : "form-success"}>{message}</p> : null}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending..." : "Send Reset Link"}
      </Button>
      <Link className="btn btn-light" href="/auth/login">
        Back to Sign In
      </Link>
    </form>
  );
}
