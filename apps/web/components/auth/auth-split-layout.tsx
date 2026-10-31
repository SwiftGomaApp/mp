import Image from "next/image";

import { AuthShowcase } from "@/components/auth/auth-showcase";

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  topRight?: React.ReactNode;
  /** On the image, right of the tab row. */
  imageFooter?: React.ReactNode;
  /** Pinned to the bottom of the form side, level with the text over the image. */
  footer?: React.ReactNode;
}

export function AuthSplitLayout({ children, topRight, footer, imageFooter }: AuthSplitLayoutProps) {
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
        <AuthShowcase legal={imageFooter} />
      </div>

      <div className="relative flex flex-col pt-10 pb-3 lg:pb-6">
        {topRight && <div className="absolute top-3 right-3 lg:top-5 lg:right-5">{topRight}</div>}
        <div className="flex flex-1 items-center justify-center py-6">{children}</div>
        {footer && (
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
