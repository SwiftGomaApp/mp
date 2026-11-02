import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/providers/providers";
import { ThemeProvider } from "@/providers/theme-provider";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SwiftGoma Admin", template: "%s | SwiftGoma Admin" },
  description: "Console d'administration SwiftGoma pour le Support et les Administrateurs.",
  icons: { icon: "/logo-icon.png", apple: "/logo-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#c2410c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
