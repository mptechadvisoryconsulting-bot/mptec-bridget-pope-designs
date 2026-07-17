"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  CreditCard,
  ExternalLink,
  FileText,
  FolderOpen,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Palette,
} from "lucide-react";

const clientLinks = [
  { label: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
  { label: "My Event", href: "/client/event", icon: CalendarDays },
  { label: "Proposals & Contracts", href: "/client/proposals", icon: FileText },
  { label: "Payments", href: "/client/payments", icon: CreditCard },
  { label: "Invoices", href: "/client/invoices", icon: CreditCard },
  { label: "Timeline", href: "/client/timeline", icon: CalendarDays },
  { label: "Tasks & Checklist", href: "/client/checklist", icon: CheckSquare },
  { label: "Design Updates", href: "/client/designs", icon: Palette },
  { label: "Project Files", href: "/client/files", icon: FolderOpen },
  { label: "Messages", href: "/client/messages", icon: MessageSquare },
  { label: "HoneyBook", href: "/client/honeybook", icon: ExternalLink },
  { label: "Inspiration Board", href: "/client/inspiration", icon: Palette },
  { label: "Profile", href: "/client/profile", icon: ImageIcon },
];

export function ClientSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link className="brand" href="/client/dashboard" prefetch={false}>
        Bridget Pope
        <span>Designs</span>
      </Link>
      <nav className="side-nav" aria-label="Client navigation">
        {clientLinks.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/client/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link className={isActive ? "side-link active" : "side-link"} href={item.href} key={item.label} prefetch={false}>
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
        <Link className="side-link" href="/auth/logout" prefetch={false}>
          <LogOut size={16} />
          Log Out
        </Link>
      </nav>
    </aside>
  );
}
