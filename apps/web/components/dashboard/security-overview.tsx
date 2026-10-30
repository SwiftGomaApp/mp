"use client";

import { Check } from "lucide-react";

import { getSecurityLevel, ProgressRing, TASK_COPY } from "@/components/security/security-prompt";
import { useSecurityTasks } from "@/components/security/use-security-tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { configureSecurityTask } from "@/lib/security";
import { cn } from "cn";

export function SecurityOverview() {
  const { tasks } = useSecurityTasks();

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

          return (
            <li key={task.key} className="flex items-center gap-4 rounded-xl border bg-card p-4">
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
                  Activé
                </span>
              ) : (
                <Button size="sm" onClick={() => configureSecurityTask(task.key)}>
                  Configurer
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
