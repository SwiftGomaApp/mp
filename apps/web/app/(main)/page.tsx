import { CurrentUserCard } from "@/components/global/current-user-card";
import { ModeToggle } from "@/components/global/theme-button";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="absolute top-3 right-3">
        <ModeToggle />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">SwiftGoma</h1>
      <CurrentUserCard />
    </div>
  );
}
