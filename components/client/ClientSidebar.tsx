"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  CreditCard,
  FileText,
  FolderOpen,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Palette,
  UserRound,
} from "lucide-react";

type ClientNavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

type ClientNavGroup = {
  id: string;
  label: string;
  items: ClientNavItem[];
};

const navGroups: ClientNavGroup[] = [
  {
    id: "my-event",
    label: "My Event",
    items: [
      { label: "Home", href: "/client/dashboard", icon: LayoutDashboard },
      { label: "Event details", href: "/client/event", icon: CalendarDays },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    items: [
      { label: "Timeline", href: "/client/timeline", icon: CalendarDays },
      { label: "Tasks & checklist", href: "/client/checklist", icon: CheckSquare },
    ],
  },
  {
    id: "designs",
    label: "Designs",
    items: [
      { label: "Design updates", href: "/client/designs", icon: Palette },
      { label: "Inspiration", href: "/client/inspiration", icon: Palette },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    items: [
      { label: "Overview", href: "/client/documents", icon: ImageIcon },
      { label: "Proposals", href: "/client/proposals", icon: FileText },
      { label: "Contracts", href: "/client/contracts", icon: FileText },
      { label: "Files", href: "/client/files", icon: FolderOpen },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    items: [
      { label: "Payments", href: "/client/payments", icon: CreditCard },
      { label: "Invoices", href: "/client/invoices", icon: CreditCard },
    ],
  },
  {
    id: "messages",
    label: "Messages",
    items: [{ label: "Inbox", href: "/client/messages", icon: MessageSquare }],
  },
  {
    id: "profile",
    label: "Profile",
    items: [{ label: "Profile", href: "/client/profile", icon: UserRound }],
  },
];

function itemIsActive(pathname: string, href: string) {
  return href === "/client/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function ClientSidebar() {
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
      const saved = window.localStorage.getItem("bpd-client-nav-open-v2");
      const parsed = saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
      setOpenGroups({ ...parsed, ...activeGroups });
    } catch {
      setOpenGroups(activeGroups);
    }
  }, [activeGroups]);

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => {
      const next = { ...current, [groupId]: !current[groupId] };
      window.localStorage.setItem("bpd-client-nav-open-v2", JSON.stringify(next));
      return next;
    });
  }

  return (
    <aside className="sidebar">
      <Link className="brand" href="/client/dashboard" prefetch={false}>
        Bridget Pope
        <span>Designs</span>
      </Link>
      <p className="side-nav-mobile-note">Tap a section to expand</p>
      <nav className="side-nav" aria-label="Client navigation">
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
