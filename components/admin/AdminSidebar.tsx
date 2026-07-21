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
    id: "today",
    label: "Today",
    items: [
      { label: "Action center", href: "/admin", icon: LayoutDashboard },
      { label: "Today board", href: "/admin/today", icon: CalendarDays },
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    items: [
      { label: "New requests", href: "/admin/leads?status=new", icon: Users },
      { label: "All leads", href: "/admin/leads", icon: CalendarDays },
      { label: "Consultations", href: "/admin/consultations", icon: CalendarDays },
    ],
  },
  {
    id: "clients-events",
    label: "Clients & Events",
    items: [
      { label: "Clients", href: "/admin/clients", icon: Users },
      { label: "Projects", href: "/admin/projects", icon: FolderKanban },
      { label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
      { label: "Tasks", href: "/admin/tasks", icon: ListChecks },
    ],
  },
  {
    id: "messages",
    label: "Messages",
    items: [{ label: "Inbox", href: "/admin/messages", icon: MessageSquare }],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      { label: "Proposals", href: "/admin/proposals", icon: FileSignature },
      { label: "Contracts", href: "/admin/contracts", icon: FileSignature },
      { label: "Invoices", href: "/admin/invoices", icon: ReceiptText },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    id: "studio",
    label: "Studio",
    items: [
      { label: "Design updates", href: "/admin/design-updates", icon: GalleryHorizontalEnd },
      { label: "Files", href: "/admin/files", icon: FolderKanban },
      { label: "Gallery", href: "/admin/gallery", icon: GalleryHorizontalEnd },
      { label: "Inventory", href: "/admin/inventory", icon: Package },
      { label: "Reports", href: "/admin/reports", icon: LayoutDashboard },
      { label: "Team", href: "/admin/team", icon: Users },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { label: "Business settings", href: "/admin/settings", icon: Settings },
      { label: "Invoice templates", href: "/admin/invoice-templates", icon: ReceiptText },
    ],
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
      const saved = window.localStorage.getItem("bpd-admin-nav-open-v2");
      const parsed = saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
      setOpenGroups({ ...parsed, ...activeGroups });
    } catch {
      setOpenGroups(activeGroups);
    }
  }, [activeGroups]);

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => {
      const next = { ...current, [groupId]: !current[groupId] };
      window.localStorage.setItem("bpd-admin-nav-open-v2", JSON.stringify(next));
      return next;
    });
  }

  return (
    <aside className="sidebar">
      <Link className="brand" href="/admin" prefetch={false}>
        Bridget Pope
        <span>Designs</span>
      </Link>
      <p className="side-nav-mobile-note">Tap a section to expand</p>
      <nav className="side-nav" aria-label="Admin navigation">
        {navGroups.map((group) => {
          const isOpen = Boolean(openGroups[group.id]);
          const singleItem = group.items.length === 1 ? group.items[0] : null;
          return (
            <section className={singleItem ? "side-section side-section-single" : "side-section"} key={group.id}>
              {singleItem ? (
                <Link
                  className={itemIsActive(pathname, singleItem.href) ? "side-link active" : "side-link"}
                  href={singleItem.href}
                  prefetch={false}
                >
                  {(() => {
                    const Icon = singleItem.icon;
                    return <Icon size={16} />;
                  })()}
                  {group.label}
                </Link>
              ) : (
                <>
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
                            key={`${item.href}-${item.label}`}
                            prefetch={false}
                          >
                            <Icon size={16} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              )}
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
