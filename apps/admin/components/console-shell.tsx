"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ClipboardCheck,
  LogOut,
  Menu,
  Moon,
  Sun,
  ScrollText,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { useSession } from "swiftgoma-mp-auth/react";
import { NotificationsProvider, useUnreadCount } from "swiftgoma-mp-notifications/react";

import { Badge, Spinner, cn } from "@/components/ui";
import { auth } from "@/lib/auth";
import { notifications, realtime } from "@/lib/notifications";
import { isStaffRole } from "@/lib/roles";

const NAV = [
  { href: "/users", label: "Utilisateurs", icon: Users, adminOnly: false },
  { href: "/audit", label: "Journal d'audit", icon: ScrollText, adminOnly: true },
  { href: "/verification", label: "Vérifications", icon: ClipboardCheck, adminOnly: false },
  { href: "/staff", label: "Personnel & demandes", icon: UserCog, adminOnly: false },
  { href: "/notifications", label: "Notifications", icon: Bell, adminOnly: false },
  { href: "/account", label: "Mon compte", icon: Settings, adminOnly: false },
];

/** Restores the session and refuses everything that is not a Support or Admin account. */
function useStaffGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    auth
      .me()
      .then(async (user) => {
        if (cancelled) return;
        if (!isStaffRole(user.role)) {
          await auth.logout().catch(() => undefined);
          router.replace("/login?denied=1");
          return;
        }
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed out elsewhere (other tab, revoked session) or role changed under us.
  useEffect(() => {
    if (!checked) return;
    if (session.status === "anonymous") router.replace("/login");
    else if (session.user && !isStaffRole(session.user.role)) {
      void auth.logout().finally(() => router.replace("/login?denied=1"));
    }
  }, [checked, session, router]);

  return checked && session.user && isStaffRole(session.user.role) ? session.user : null;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Changer de thème"
      className="rounded-md p-2 hover:bg-muted"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </button>
  );
}

function NotificationBell() {
  const unread = useUnreadCount();
  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
      className="relative rounded-md p-2 hover:bg-muted"
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const user = useStaffGuard();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <NotificationsProvider notifications={notifications} realtime={realtime}>
      <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground p-4 transition-transform lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-6 flex items-center gap-2 px-2 text-base font-semibold">
            <Image src="/logo-icon.png" alt="" width={28} height={28} />
            SwiftGoma <span className="text-primary">Admin</span>
          </div>
          <nav className="grid gap-1">
            {NAV.map(({ href, label, icon: Icon, adminOnly }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const locked = adminOnly && !isAdmin;
              if (locked) return null;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent",
                    active && "bg-sidebar-accent font-medium text-sidebar-primary",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        {open && (
          <button
            type="button"
            aria-label="Fermer le menu"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur">
            <button
              type="button"
              aria-label="Menu"
              className="rounded-md p-2 hover:bg-muted lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
              <div className="hidden text-right text-sm leading-tight sm:block">
                <p className="font-medium">{user.name || user.email}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Badge tone={isAdmin ? "info" : "neutral"}>{user.role}</Badge>
              <button
                type="button"
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="rounded-md p-2 hover:bg-muted"
                onClick={() => {
                  void auth
                    .logout()
                    .catch(() => undefined)
                    .finally(() => router.replace("/login"));
                }}
              >
                <LogOut className="size-5" />
              </button>
            </div>
          </header>
          <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </NotificationsProvider>
  );
}
