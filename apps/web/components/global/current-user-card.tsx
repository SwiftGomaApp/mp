"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { useSession } from "swiftgoma-mp-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { POST_LOGIN_PATH } from "@/lib/auth-flow";
import { loadAvatar, useAvatarUrl } from "@/lib/avatar-store";

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Acheteur",
  SELLER: "Vendeur",
  RIDER: "Livreur",
  ADMIN: "Administrateur",
};

const subscribeNothing = () => () => {};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export function CurrentUserCard() {
  const { status, user } = useSession();
  // The session can already be known on the first client render while the server had none:
  // keep the skeleton until hydration is done so both renders match.
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const userId = user?.id;
  const avatarUrl = useAvatarUrl(userId);

  useEffect(() => {
    if (userId) void loadAvatar(userId);
  }, [userId]);

  if (!hydrated || status === "unknown") {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          {/* <p className="text-sm text-muted-foreground">Vous n’êtes pas connecté.</p> */}
          <div className="flex w-full gap-2">
            <Button className="flex-1" nativeButton={false} render={<Link href="/auth/sign-in" />}>
              Se connecter
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              nativeButton={false}
              render={<Link href="/auth/sign-up" />}
            >
              S’inscrire
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-14">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
              {initialsOf(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 gap-1">
            <p className="truncate text-base font-semibold">{user.name}</p>
            <Badge variant="secondary" className="w-fit">
              {ROLE_LABELS[user.role] ?? user.role}
            </Badge>
          </div>
        </div>

        <ul className="grid gap-2 text-sm text-muted-foreground">
          {user.email && (
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" />
              <span className="truncate">{user.email}</span>
            </li>
          )}
          {user.phone && (
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" />
              <span>{user.phone}</span>
            </li>
          )}
        </ul>

        <Button nativeButton={false} render={<Link href={POST_LOGIN_PATH} />}>
          Aller au tableau de bord
        </Button>
      </CardContent>
    </Card>
  );
}
