"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  CreditCard,
  FileSignature,
  FolderKanban,
  GalleryHorizontalEnd,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquare,
  Package,
  ReceiptText,
  Settings,
  Users,
} from "lucide-react";

type AdminNavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

const navGroups: AdminNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard }],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { label: "Consultation Requests", href: "/admin/leads?status=new", icon: Users },
      { label: "Leads", href: "/admin/leads", icon: CalendarDays },
      { label: "Clients", href: "/admin/clients", icon: Users },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    items: [
      { label: "Projects", href: "/admin/projects", icon: FolderKanban },
      { label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
      { label: "Tasks", href: "/admin/tasks", icon: ListChecks },
    ],
  },
  {
    id: "client-experience",
    label: "Client Experience",
    items: [
      { label: "Messages", href: "/admin/messages", icon: MessageSquare },
      { label: "Design Updates", href: "/admin/design-updates", icon: GalleryHorizontalEnd },
      { label: "Files", href: "/admin/files", icon: FolderKanban },
    ],
  },
  {
    id: "sales-billing",
    label: "Sales & Billing",
    items: [
      { label: "Proposals", href: "/admin/proposals", icon: FileSignature },
      { label: "Contracts", href: "/admin/contracts", icon: FileSignature },
      { label: "Invoices", href: "/admin/invoices", icon: ReceiptText },
      { label: "Invoice Templates", href: "/admin/invoice-templates", icon: ReceiptText },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      { label: "Inventory", href: "/admin/inventory", icon: Package },
      { label: "Gallery", href: "/admin/gallery", icon: GalleryHorizontalEnd },
      { label: "Reports", href: "/admin/reports", icon: LayoutDashboard },
      { label: "Team", href: "/admin/team", icon: Users },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [{ label: "Settings", href: "/admin/settings", icon: Settings }],
  },
];

function itemIsActive(pathname: string, href: string) {
  const routePath = href.split("?")[0];
  return routePath === "/admin" ? pathname === "/admin" : pathname.startsWith(routePath);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const activeGroups = useMemo(
    () =>
      Object.fromEntries(
        navGroups.map((group) => [group.id, group.items.some((item) => itemIsActive(pathname, item.href))]),
      ) as Record<string, boolean>,
    [pathname],
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(activeGroups);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("bpd-admin-nav-open");
      const parsed = saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
      setOpenGroups({ ...parsed, ...activeGroups });
    } catch {
      setOpenGroups(activeGroups);
    }
  }, [activeGroups]);

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => {
      const next = { ...current, [groupId]: !current[groupId] };
      window.localStorage.setItem("bpd-admin-nav-open", JSON.stringify(next));
      return next;
    });
  }

  return (
    <aside className="sidebar">
      <Link className="brand" href="/admin" prefetch={false}>
        Bridget Pope
        <span>Designs</span>
      </Link>
      <nav className="side-nav" aria-label="Admin navigation">
        {navGroups.map((group) => {
          const isOpen = Boolean(openGroups[group.id]);
          return (
            <section className="side-section" key={group.id}>
              <button
                aria-expanded={isOpen}
                className="side-group-trigger"
                onClick={() => toggleGroup(group.id)}
                type="button"
              >
                <span>{group.label}</span>
                <ChevronDown aria-hidden="true" className={isOpen ? "chevron open" : "chevron"} size={15} />
              </button>
              {isOpen ? (
                <div className="side-group-items">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = itemIsActive(pathname, item.href);
                    return (
                      <Link
                        className={isActive ? "side-link active" : "side-link"}
                        href={item.href}
                        key={item.href}
                        prefetch={false}
                      >
                        <Icon size={16} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
        <Link className="side-link side-logout" href="/auth/logout" prefetch={false}>
          <LogOut size={16} />
          Log Out
        </Link>
      </nav>
    </aside>
  );
}
