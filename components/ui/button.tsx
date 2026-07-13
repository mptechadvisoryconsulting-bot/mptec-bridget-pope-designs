import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "light";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn("btn", `btn-${variant}`, className)} {...props} />;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "light";
  className?: string;
}) {
  const isProtectedPortalLink = href.startsWith("/admin") || href.startsWith("/client");

  return (
    <Link className={cn("btn", `btn-${variant}`, className)} href={href} prefetch={isProtectedPortalLink ? false : undefined}>
      {children}
    </Link>
  );
}
