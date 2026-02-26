import type { Metadata } from "next";
import { NavBar } from "@/components/layout/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "TierList+",
  description: "Collaborative tier list voting for teams",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100 antialiased">
        <NavBar />
        <main className="mx-auto w-full min-h-0 flex-1 max-w-6xl overflow-y-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
