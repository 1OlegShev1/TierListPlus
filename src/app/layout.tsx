import type { Metadata, Viewport } from "next";
import { NavBar } from "@/components/layout/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "TierList+",
  description: "Collaborative tier list voting for teams",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-[100dvh] flex-col overflow-hidden bg-neutral-950 pt-[env(safe-area-inset-top)] text-[0.96rem] text-neutral-100 antialiased sm:text-base">
        <NavBar />
        <main className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-6 sm:pt-10 sm:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
