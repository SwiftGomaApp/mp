"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  ShoppingBag,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSession } from "swiftgoma-mp-auth/react";

import { Logo } from "@/components/global/logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useLogout } from "@/components/auth/logout-screen";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { loadAvatar, useAvatarUrl } from "@/lib/avatar-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { initialsOf, ROLE_LABELS } from "@/components/dashboard/user-display";
import { POST_LOGIN_PATH } from "@/lib/auth-flow";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/shops", label: "Boutiques" },
  { href: "/categories", label: "Catégories" },
  { href: "/sell", label: "Vendre" },
  { href: "/deliver", label: "Devenir livreur" },
  { href: "/help", label: "Aide" },
] as const;

const THEME_OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

const subscribeNothing = () => () => {};

function AccountMenu() {
  const { status, user } = useSession();
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();
  const { logout, isLoggingOut } = useLogout();
  const userId = user?.id;
  const avatarUrl = useAvatarUrl(userId);

  useEffect(() => {
    if (userId) void loadAvatar(userId);
  }, [userId]);

  if (!hydrated || status === "unknown") return <Skeleton className="h-8 w-28 rounded-lg" />;

  if (!user) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
          nativeButton={false}
          render={<Link href="/auth/sign-in" />}
        >
          Se connecter
        </Button>
        <Button size="sm" nativeButton={false} render={<Link href="/auth/sign-up" />}>
          S’inscrire
        </Button>
      </>
    );
  }

  return (
    <>
      <NotificationBell />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu du compte"
          className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Avatar>
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {initialsOf(user.name)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5 font-normal">
              <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
              <span className="text-xs text-muted-foreground">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href={POST_LOGIN_PATH} />}>
            <LayoutDashboard />
            Tableau de bord
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/favorites" />}>
            <Heart />
            Favoris
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/cart" />}>
            <ShoppingBag />
            Panier
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun className="dark:hidden" />
              <Moon className="hidden dark:block" />
              Thème
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                  <Icon />
                  {label}
                  {theme === value && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} disabled={isLoggingOut}>
            {isLoggingOut ? <Spinner /> : <LogOut />}
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Ouvrir le menu"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo size="sm" />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Navigation" className="grid gap-1 px-4">
                {NAV_LINKS.map(({ href, label }) => (
                  <SheetClose
                    key={href}
                    nativeButton={false}
                    render={<Link href={href} />}
                    className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {label}
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/" aria-label="Accueil SwiftGoma" className="shrink-0">
            <Logo size="sm" />
          </Link>
        </div>

        <nav aria-label="Navigation" className="hidden items-center justify-center gap-1 lg:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors hover:text-foreground",
                pathname === href ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
