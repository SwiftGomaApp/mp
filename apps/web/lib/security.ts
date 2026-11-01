import { account } from "@/lib/account";

export const SECURITY_TASK_KEYS = [
  "TWO_FACTOR",
  "RECOVERY_CONTACT",
  "PASSKEY",
  "PASSWORD",
] as const;

export type SecurityTaskKey = (typeof SECURITY_TASK_KEYS)[number];

export interface SecurityTask {
  key: SecurityTaskKey;
  done: boolean;
}

export async function fetchSecurityTasks(): Promise<SecurityTask[]> {
  const [checklist, methods] = await Promise.all([account.security(), account.methods.list()]);
  const done = (key: string) => checklist.items.some((item) => item.key === key && item.done);

  const doneByKey: Record<SecurityTaskKey, boolean> = {
    TWO_FACTOR: done("TWO_FACTOR"),
    RECOVERY_CONTACT: done("RECOVERY_CONTACT"),
    PASSKEY: done("PASSKEY"),
    PASSWORD: methods.password,
  };

  return SECURITY_TASK_KEYS.map((key) => ({ key, done: doneByKey[key] }));
}

export function configureSecurityTask(key: SecurityTaskKey) {
  // TODO: open the setup flow for this task (not built yet).
  console.info("Configure security task:", key);
}
