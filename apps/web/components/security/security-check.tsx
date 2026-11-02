"use client";

import { SecurityPrompt } from "@/components/security/security-prompt";
import { useSecurityTasks } from "@/components/security/use-security-tasks";

export function SecurityCheck() {
  const { tasks } = useSecurityTasks();

  if (!tasks) return null;
  return <SecurityPrompt tasks={tasks} />;
}
