"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";

import { initialsOf } from "@/components/dashboard/user-display";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/lib/auth-errors";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, type UserProfile, usersApi } from "@/lib/users-api";

interface AvatarEditorProps {
  name: string;
  avatarUrl: string | null;
  onChange: (profile: UserProfile) => void;
}

export function AvatarEditor({ name, avatarUrl, onChange }: AvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "upload" | "remove", action: () => Promise<UserProfile>) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      onChange(await action());
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      setError("Choisissez une image JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("L’image est trop lourde (2 Mo maximum).");
      return;
    }
    void run("upload", () => usersApi.uploadAvatar(file));
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-20">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={`Photo de ${name}`} />}
        <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>

      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy === "upload" ? <Spinner data-icon="inline-start" /> : <Camera />}
            {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => void run("remove", usersApi.removeAvatar)}
            >
              {busy === "remove" ? <Spinner data-icon="inline-start" /> : <Trash2 />}
              Supprimer
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP · 2 Mo maximum</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_MIME_TYPES.join(",")}
        className="hidden"
        onChange={handleFile}
      />

      {error && (
        <div className="w-full">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </div>
  );
}
