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
      <body className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100 antialiased">
        <NavBar />
        <main className="mx-auto w-full min-h-0 max-w-6xl flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
