"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { LinkedAccounts } from "@/components/dashboard/linked-accounts";
import { RecoveryContactsDialog } from "@/components/security/recovery-contacts-dialog";
import { getSecurityLevel, ProgressRing, TASK_COPY } from "@/components/security/security-prompt";
import { TwoFactorManageDialog } from "@/components/security/two-factor-manage-dialog";
import { TwoFactorSetupDialog } from "@/components/security/two-factor-setup-dialog";
import { useSecurityTasks } from "@/components/security/use-security-tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { configureSecurityTask, type SecurityTaskKey } from "@/lib/security";
import { cn } from "cn";

/** A done task of these kinds opens a dialog to manage it when its card is clicked. */
const MANAGEABLE_TASKS: SecurityTaskKey[] = ["TWO_FACTOR", "RECOVERY_CONTACT"];

export function SecurityOverview() {
  const { tasks, refresh } = useSecurityTasks();
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  /** Whatever the dialog did, the list is refetched when it closes. */
  function closeAndRefresh(open: boolean, setOpen: (open: boolean) => void) {
    setOpen(open);
    if (!open) refresh();
  }

  /** Setup for a task that is not done yet. */
  function configure(key: SecurityTaskKey) {
    if (key === "TWO_FACTOR") setTwoFactorOpen(true);
    else if (key === "RECOVERY_CONTACT") setContactsOpen(true);
    else configureSecurityTask(key);
  }

  /** Settings for a task that is already done. */
  function manage(key: SecurityTaskKey) {
    if (key === "TWO_FACTOR") setManageOpen(true);
    else if (key === "RECOVERY_CONTACT") setContactsOpen(true);
  }

  if (!tasks) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  const done = tasks.filter((task) => task.done).length;
  const level = getSecurityLevel(done, tasks.length);

  return (
    <div className="grid gap-6">
      <section className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <ProgressRing done={done} total={tasks.length} size={64} />
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Niveau de sécurité</h2>
            <Badge variant="secondary" className={cn("border-0", level.className)}>
              {level.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {done === tasks.length
              ? "Votre compte est bien protégé. Bravo !"
              : `${done} protection${done > 1 ? "s" : ""} sur ${tasks.length} activée${done > 1 ? "s" : ""}.`}
          </p>
        </div>
      </section>

      <ul className="grid gap-3">
        {tasks.map((task) => {
          const { title, description, icon: Icon } = TASK_COPY[task.key];
          const manageable = task.done && MANAGEABLE_TASKS.includes(task.key);

          return (
            <li
              key={task.key}
              className={cn(
                "flex items-center gap-4 rounded-xl border bg-card p-4",
                manageable &&
                  "cursor-pointer transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
              {...(manageable && {
                role: "button",
                tabIndex: 0,
                onClick: () => manage(task.key),
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    manage(task.key);
                  }
                },
              })}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  task.done
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-primary/10 text-primary",
                )}
              >
                {task.done ? <Check className="size-5" /> : <Icon className="size-5" />}
              </span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
              {task.done ? (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {manageable ? "Gérer" : "Activé"}
                </span>
              ) : (
                <Button size="sm" onClick={() => configure(task.key)}>
                  Configurer
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <LinkedAccounts />

      <TwoFactorSetupDialog
        open={twoFactorOpen}
        onOpenChange={(open) => closeAndRefresh(open, setTwoFactorOpen)}
        onDone={refresh}
      />
      <TwoFactorManageDialog
        open={manageOpen}
        onOpenChange={(open) => closeAndRefresh(open, setManageOpen)}
        onDisabled={refresh}
      />
      <RecoveryContactsDialog
        open={contactsOpen}
        onOpenChange={(open) => closeAndRefresh(open, setContactsOpen)}
      />
    </div>
  );
}
