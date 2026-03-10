import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie Notice | TierList+",
  description: "Cookie and local storage notice for TierList+.",
};

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-neutral-100">Cookie Notice</h1>
        <p className="text-sm text-neutral-400">Last updated: {LEGAL_LAST_UPDATED}</p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-neutral-300">
        <p>
          This notice explains how TierList+ uses cookies and similar storage technologies when you
          use the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">What We Use Today</h2>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <p className="text-sm font-medium text-neutral-100">Essential authentication cookie</p>
          <p className="mt-1 text-sm text-neutral-300">
            Name: <code>tierlistplus_session</code>
          </p>
          <p className="text-sm text-neutral-300">
            Purpose: keeps your signed-in device identity and session continuity.
          </p>
          <p className="text-sm text-neutral-300">
            Typical lifetime: up to 1 year unless cleared earlier.
          </p>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <p className="text-sm font-medium text-neutral-100">Local storage keys</p>
          <p className="mt-1 text-sm text-neutral-300">
            Keys used by the client include <code>tierlistplus_identity</code> and a legacy key{" "}
            <code>tierlistplus_user_id</code>.
          </p>
          <p className="text-sm text-neutral-300">
            Purpose: local device identity continuity and migration compatibility.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Consent</h2>
        <p className="text-sm leading-6 text-neutral-300">
          Essential cookies required to provide the service are used without optional opt-in. If we
          add non-essential cookies (for example analytics or marketing), we will request consent
          before setting them where required by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">How to Control Cookies</h2>
        <p className="text-sm leading-6 text-neutral-300">
          You can clear cookies and site data in your browser settings. Blocking essential cookies
          may break login and core functionality.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Related Policies</h2>
        <p className="text-sm text-neutral-300">
          See{" "}
          <Link href="/privacy" className="text-amber-300 underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-amber-300 underline">
            Terms of Use
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
