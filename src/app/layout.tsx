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
    <html lang="en" data-theme="dark">
      <body className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-canvas)] pt-[env(safe-area-inset-top)] text-[var(--fg-primary)] antialiased">
        <NavBar />
        <main className="w-full min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-3 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-4 sm:pt-8 sm:pb-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
