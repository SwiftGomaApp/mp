import { CurrentUserCard } from "@/components/global/current-user-card";

export default function Home() {
  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">SwiftGoma</h1>
      <CurrentUserCard />
    </div>
  );
}
