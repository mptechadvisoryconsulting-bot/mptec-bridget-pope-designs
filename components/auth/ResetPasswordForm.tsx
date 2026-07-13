"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setIsSubmitting(false);
      setIsError(true);
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setIsSubmitting(false);
      setIsError(true);
      setMessage("Passwords do not match.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsSubmitting(false);
      setIsError(true);
      setMessage(error.message || "Unable to update password. Open the reset link from your email and try again.");
      return;
    }

    setIsError(false);
    setMessage("Password updated. Redirecting…");
    window.setTimeout(() => {
      window.location.href = "/client/dashboard";
    }, 600);
  }

  return (
    <form className="form-grid" onSubmit={onSubmit} style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
      <Field label="New password">
        <Input autoComplete="new-password" minLength={8} name="password" required type="password" />
      </Field>
      <Field label="Confirm password">
        <Input autoComplete="new-password" minLength={8} name="confirmPassword" required type="password" />
      </Field>
      {message ? <p className={isError ? "form-error" : "form-success"}>{message}</p> : null}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Updating..." : "Update Password"}
      </Button>
      <Link className="btn btn-light" href="/auth/login">
        Back to Sign In
      </Link>
    </form>
  );
}
