import type { Metadata } from "next";
import "./globals.css";
import { AppDataProvider } from "@/lib/AppDataContext";
import { LOGO_ICON } from "@/lib/logo";

export const metadata: Metadata = {
  title: "GoGlobe Ops — Client & Case Portal",
  description: "GoGlobe Consultants staff portal",
  icons: { icon: LOGO_ICON },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full" style={{
        // Font variables set here so Tailwind/CSS can reference them, without
        // requiring the build itself to fetch fonts (that step is what failed
        // in this sandbox's restricted network — a real host has no such issue,
        // but this approach sidesteps the risk entirely either way).
        // @ts-ignore
        '--font-fraunces': "'Fraunces', serif",
        '--font-inter': "'Inter', sans-serif",
        '--font-plex-mono': "'IBM Plex Mono', monospace",
      }}>
        <AppDataProvider>{children}</AppDataProvider>
      </body>
    </html>
  );
}
