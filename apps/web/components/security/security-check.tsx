"use client";

import { SecurityPrompt } from "@/components/security/security-prompt";
import { useSecurityTasks } from "@/components/security/use-security-tasks";
import { useVerificationScreenActive } from "@/lib/verification-screen";

export function SecurityCheck() {
  const { tasks } = useSecurityTasks();
  const isVerifying = useVerificationScreenActive();

  if (!tasks || isVerifying) return null;
  return <SecurityPrompt tasks={tasks} />;
}
