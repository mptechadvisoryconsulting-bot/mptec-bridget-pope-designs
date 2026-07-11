import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  CreditCard,
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
  { label: "Inspiration Board", href: "/client/inspiration", icon: Palette },
  { label: "Documents", href: "/client/documents", icon: ImageIcon },
  { label: "Profile", href: "/client/profile", icon: ImageIcon },
];

export function ClientSidebar() {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/client/dashboard">
        Bridget Pope
        <span>Designs</span>
      </Link>
      <nav className="side-nav" aria-label="Client navigation">
        {clientLinks.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link className={index === 0 ? "side-link active" : "side-link"} href={item.href} key={item.label}>
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
        <Link className="side-link" href="/auth/logout">
          <LogOut size={16} />
          Log Out
        </Link>
      </nav>
    </aside>
  );
}
