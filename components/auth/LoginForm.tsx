"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const adminRoles = new Set(["owner", "admin"]);

export function LoginForm() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(searchParams.get("error") === "profile" ? "This login does not have a portal profile yet." : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn(formData: FormData) {
    setIsSubmitting(true);
    setMessage("");

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setMessage(error?.message ?? "Unable to sign in.");
      setIsSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (!profile?.role) {
      setMessage("Sign-in worked, but this user does not have an admin or client profile yet.");
      setIsSubmitting(false);
      return;
    }

    const next = searchParams.get("next");
    window.location.href = next ?? (adminRoles.has(profile.role) ? "/admin" : "/client/dashboard");
  }

  return (
    <form action={signIn} className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 20 }}>
      <Field label="Email"><Input name="email" placeholder="ashley@example.com" required type="email" /></Field>
      <Field label="Password"><Input name="password" placeholder="Password" required type="password" /></Field>
      {message ? <p className="form-error">{message}</p> : null}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing In..." : "Sign In"}
      </Button>
      <Link className="btn btn-light" href="/auth/forgot-password">Forgot Password</Link>
    </form>
  );
}
