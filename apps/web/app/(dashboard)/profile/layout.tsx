import { ProfileTabs } from "@/components/dashboard/profile-tabs";
import { ModeToggle } from "@/components/global/theme-button";

export default function ProfileLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <header className="grid gap-4 border-b px-4 pt-2 sm:px-8 md:pt-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Profil</h1>
          <div className="hidden md:block">
            <ModeToggle />
          </div>
        </div>
        <ProfileTabs />
      </header>
      <div className="px-4 py-6 sm:px-8">{children}</div>
    </div>
  );
}
