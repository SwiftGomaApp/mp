"use client";

import { SecurityPrompt } from "@/components/security/security-prompt";
import { useSecurityTasks } from "@/components/security/use-security-tasks";
import { configureSecurityTask } from "@/lib/security";

/** Checks the signed-in user's security and, on any page, asks them to set up what is missing. */
export function SecurityCheck() {
  const { tasks } = useSecurityTasks();

  if (!tasks) return null;
  return <SecurityPrompt tasks={tasks} onConfigure={configureSecurityTask} />;
}
