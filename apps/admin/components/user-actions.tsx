"use client";

import { useState } from "react";

import { StepUpField } from "@/components/step-up-field";
import { Button, Card, Checkbox, Field, FormDialog, Input, Notice, Select, Textarea } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { ASSIGNABLE_ROLES } from "@/lib/types";
import type { AdminUserDetail } from "@/lib/types";
import { useIsAdmin } from "@/lib/use-role";

type ActionKey =
  | "suspend"
  | "ban"
  | "reactivate"
  | "revoke"
  | "unlock"
  | "role"
  | "profile"
  | "contact"
  | "export"
  | "cancelDeletion"
  | "forceDeletion"
  | "resetPassword"
  | "resetTwoFactor";

interface ActionDef {
  title: string;
  description: string;
  submit: string;
  danger?: boolean;
  stepUp?: boolean;
}

const ACTIONS: Record<ActionKey, ActionDef> = {
  suspend: { title: "Suspendre le compte", description: "L'utilisateur ne pourra plus se connecter.", submit: "Suspendre", danger: true },
  ban: { title: "Bannir le compte", description: "Bannissement du compte.", submit: "Bannir", danger: true },
  reactivate: { title: "Réactiver le compte", description: "Le compte redevient actif.", submit: "Réactiver" },
  revoke: { title: "Déconnecter partout", description: "Révoque toutes les sessions de l'utilisateur.", submit: "Déconnecter" },
  unlock: { title: "Débloquer le compte", description: "Efface le blocage après trop d'échecs de connexion.", submit: "Débloquer" },
  role: { title: "Changer le rôle", description: "Rôles self-service uniquement (acheteur, vendeur, livreur).", submit: "Changer le rôle" },
  profile: { title: "Modérer le profil", description: "Retire la photo ou efface le nom.", submit: "Modérer" },
  contact: { title: "Modifier un contact", description: "Sans valeur : le contact est marqué non vérifié. Avec une valeur : il est remplacé, aussi non vérifié.", submit: "Enregistrer" },
  export: { title: "Exporter les données", description: "Télécharge l'export JSON des données du compte. L'action est journalisée et l'utilisateur est averti.", submit: "Exporter" },
  cancelDeletion: { title: "Annuler la suppression", description: "Annule la suppression programmée du compte.", submit: "Annuler la suppression" },
  forceDeletion: { title: "Forcer la suppression", description: "Supprime définitivement le compte maintenant. Irréversible.", submit: "Supprimer définitivement", danger: true, stepUp: true },
  resetPassword: { title: "Réinitialiser le mot de passe", description: "Supprime le mot de passe actuel de l'utilisateur.", submit: "Réinitialiser", danger: true, stepUp: true },
  resetTwoFactor: { title: "Réinitialiser la double vérification", description: "Désactive la 2FA de l'utilisateur (téléphone perdu).", submit: "Réinitialiser la 2FA", danger: true, stepUp: true },
};

const GROUPS: { label: string; keys: ActionKey[] }[] = [
  { label: "Statut du compte", keys: ["suspend", "ban", "reactivate", "unlock"] },
  { label: "Sessions et rôle", keys: ["revoke", "role"] },
  { label: "Profil et données", keys: ["profile", "contact", "export"] },
  { label: "Suppression", keys: ["cancelDeletion", "forceDeletion"] },
  { label: "Identifiants (code de confirmation requis)", keys: ["resetPassword", "resetTwoFactor"] },
];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function UserActions({ user, onDone }: { user: AdminUserDetail; onDone: () => void }) {
  const isAdmin = useIsAdmin();
  const [active, setActive] = useState<ActionKey | null>(null);
  const [reason, setReason] = useState("");
  const [stepUp, setStepUp] = useState("");
  const [role, setRole] = useState<string>("BUYER");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [clearName, setClearName] = useState(false);
  const [field, setField] = useState<"email" | "phone">("email");
  const [value, setValue] = useState("");

  if (!isAdmin) {
    return (
      <Card title="Actions">
        <Notice>
          Votre rôle Support donne un accès en lecture seule. Les actions de gestion des comptes sont
          réservées aux Administrateurs.
        </Notice>
      </Card>
    );
  }

  const def = active ? ACTIONS[active] : null;

  function open(key: ActionKey) {
    setActive(key);
    setReason("");
    setStepUp("");
    setValue("");
    setRemoveAvatar(false);
    setClearName(false);
    setRole(user.role === "BUYER" ? "SELLER" : "BUYER");
  }

  async function submit() {
    const reasonText = reason.trim();
    switch (active) {
      case "suspend": await adminApi.suspend(user.id, reasonText); break;
      case "ban": await adminApi.ban(user.id, reasonText); break;
      case "reactivate": await adminApi.reactivate(user.id, reasonText); break;
      case "revoke": await adminApi.revokeSessions(user.id, reasonText); break;
      case "unlock": await adminApi.unlock(user.id, reasonText); break;
      case "cancelDeletion": await adminApi.cancelDeletion(user.id, reasonText); break;
      case "role": await adminApi.changeRole(user.id, role, reasonText); break;
      case "profile": await adminApi.moderateProfile(user.id, { reason: reasonText, removeAvatar, clearName }); break;
      case "contact": await adminApi.updateContact(user.id, { reason: reasonText, field, value: value.trim() || undefined }); break;
      case "forceDeletion": await adminApi.forceDeletion(user.id, reasonText, stepUp); break;
      case "resetPassword": await adminApi.resetPassword(user.id, reasonText, stepUp); break;
      case "resetTwoFactor": await adminApi.resetTwoFactor(user.id, reasonText, stepUp); break;
      case "export":
        download(`swiftgoma-export-${user.id}.json`, await adminApi.exportUserData(user.id, reasonText));
        break;
    }
    onDone();
  }

  const canSubmit =
    reason.trim().length >= 5 &&
    (!def?.stepUp || stepUp.length === 6) &&
    (active !== "profile" || removeAvatar || clearName);

  return (
    <Card title="Actions">
      <div className="grid gap-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.keys.map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={ACTIONS[key].danger ? "danger" : "outline"}
                  onClick={() => open(key)}
                >
                  {ACTIONS[key].title}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <FormDialog
        open={!!def}
        title={def?.title ?? ""}
        description={def?.description}
        submitLabel={def?.submit ?? ""}
        danger={def?.danger}
        canSubmit={canSubmit}
        onClose={() => setActive(null)}
        onSubmit={submit}
      >
        {active === "role" && (
          <Field label="Nouveau rôle">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
        )}
        {active === "profile" && (
          <div className="grid gap-2 text-sm">
            <Checkbox checked={removeAvatar} onChange={setRemoveAvatar} label="Retirer la photo de profil" />
            <Checkbox checked={clearName} onChange={setClearName} label="Effacer le nom" />
          </div>
        )}
        {active === "contact" && (
          <>
            <Field label="Contact">
              <Select value={field} onChange={(e) => setField(e.target.value as "email" | "phone")}>
                <option value="email">E-mail</option>
                <option value="phone">Téléphone</option>
              </Select>
            </Field>
            <Field
              label="Nouvelle valeur (facultatif)"
              hint={field === "phone" ? "Format +243XXXXXXXXX" : undefined}
            >
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Raison (5 caractères min.)" hint="Enregistrée dans le journal d'audit.">
          <Textarea required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {def?.stepUp && <StepUpField value={stepUp} onChange={setStepUp} />}
      </FormDialog>
    </Card>
  );
}
