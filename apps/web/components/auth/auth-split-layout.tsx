import Image from "next/image";

import { AuthShowcase } from "@/components/auth/auth-showcase";

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  topRight?: React.ReactNode;
}

export function AuthSplitLayout({ children, topRight }: AuthSplitLayoutProps) {
  return (
    <div className="grid min-h-svh p-3 lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:p-5">
      <div className="relative hidden overflow-hidden rounded-3xl lg:block">
        <Image
          src="/login-image.jpg"
          alt="Chariot rempli de casques audio dans une allée de supermarché"
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 0px"
          className="object-cover"
        />
        <AuthShowcase />
      </div>

      <div className="relative flex items-center justify-center py-10">
        {topRight && <div className="absolute top-3 right-3 lg:top-5 lg:right-5">{topRight}</div>}
        {children}
      </div>
    </div>
  );
}
