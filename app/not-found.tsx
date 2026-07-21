import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">404</span>
        <h1>Page not found</h1>
        <p className="mini-meta">This page is not available. Return home to explore Bridget Pope Designs.</p>
        <ButtonLink href="/">Return Home</ButtonLink>
      </div>
    </div>
  );
}
