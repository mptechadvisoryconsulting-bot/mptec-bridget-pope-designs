"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">Something went wrong</span>
        <h1>We could not load this view.</h1>
        <p className="mini-meta">Try again, or return to the dashboard.</p>
        <Button onClick={reset} type="button">Try Again</Button>
      </div>
    </div>
  );
}
