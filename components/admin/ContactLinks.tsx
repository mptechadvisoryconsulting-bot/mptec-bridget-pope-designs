import type { ReactNode } from "react";

type ContactLinksProps = {
  email?: string | null;
  phone?: string | null;
};

export function ContactLinks({ email, phone }: ContactLinksProps) {
  const parts: ReactNode[] = [];

  if (email) {
    parts.push(
      <a key="email" href={`mailto:${email}`}>
        {email}
      </a>,
    );
  }

  if (phone) {
    parts.push(
      <a key="phone" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
        {phone}
      </a>,
    );
  }

  if (!parts.length) {
    return <div className="mini-meta">No contact info</div>;
  }

  return (
    <div className="mini-meta">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? " · " : null}
          {part}
        </span>
      ))}
    </div>
  );
}
