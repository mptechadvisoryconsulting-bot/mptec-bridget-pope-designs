import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  FileSignature,
  FolderKanban,
  GalleryHorizontalEnd,
  LayoutDashboard,
  ListChecks,
  Package,
  ReceiptText,
  Settings,
  Users,
} from "lucide-react";

const adminLinks = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Leads", href: "/admin/leads", icon: Users },
  { label: "Clients", href: "/admin/clients", icon: Users },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "Consultations", href: "/admin/consultations", icon: CalendarDays },
  { label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
  { label: "Tasks", href: "/admin/tasks", icon: ListChecks },
  { label: "Messages", href: "/admin/messages", icon: Users },
  { label: "Design Updates", href: "/admin/design-updates", icon: GalleryHorizontalEnd },
  { label: "Files", href: "/admin/files", icon: FolderKanban },
  { label: "Notifications", href: "/admin/notifications", icon: ListChecks },
  { label: "Proposals", href: "/admin/proposals", icon: FileSignature },
  { label: "Contracts", href: "/admin/contracts", icon: FileSignature },
  { label: "Invoices", href: "/admin/invoices", icon: ReceiptText },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Inventory", href: "/admin/inventory", icon: Package },
  { label: "Gallery", href: "/admin/gallery", icon: GalleryHorizontalEnd },
  { label: "Reports", href: "/admin/reports", icon: LayoutDashboard },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/admin">
        Bridget Pope
        <span>Designs</span>
      </Link>
      <nav className="side-nav" aria-label="Admin navigation">
        {adminLinks.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link className={index === 0 ? "side-link active" : "side-link"} href={item.href} key={item.href}>
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
