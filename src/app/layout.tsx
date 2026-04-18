import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { NavBar } from "@/components/layout/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "TierList+",
  description: "Make chaotic tier lists, roast picks, and settle fun debates.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg-canvas)] pt-[env(safe-area-inset-top)] text-[var(--fg-primary)] antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
  try {
    const key = "tierlist-theme-preference";
    const raw = window.localStorage.getItem(key);
    const theme = raw === "dark" || raw === "light" || raw === "system" ? raw : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();`}
        </Script>
        <NavBar />
        <main className="w-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none">
          <div className="mx-auto w-full max-w-6xl px-3 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-4 sm:pt-8 sm:pb-8">
            {children}
          </div>
        </main>
        <div id="overlay-root" />
      </body>
    </html>
  );
}
