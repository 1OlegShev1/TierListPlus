import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_ENTITY_NAME,
  LEGAL_LAST_UPDATED,
  LEGAL_PRIVACY_EMAIL,
  LEGAL_SERVICE_NAME,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | TierList+",
  description: "How TierList+ collects, uses, and protects personal data in Norway and the EEA.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-neutral-100">Privacy Policy</h1>
        <p className="text-sm text-neutral-400">Last updated: {LEGAL_LAST_UPDATED}</p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-neutral-300">
        <p>
          This Privacy Policy explains how {LEGAL_ENTITY_NAME} ({LEGAL_SERVICE_NAME}, "we", "us")
          handles personal data when you use this service.
        </p>
        <p>
          We operate this service for users in Norway and the EEA and process personal data under
          the GDPR and the Norwegian Personal Data Act.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Data We Process</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
          <li>
            Device and account identifiers created by the app (for example `userId`, `deviceId`,
            linked device names).
          </li>
          <li>
            Content you create: list names, vote names, nicknames, uploaded images, and links.
          </li>
          <li>
            Session and membership data: space membership, join/invite codes, participation state.
          </li>
          <li>
            Security and abuse-prevention data, including request metadata such as IP-derived
            rate-limit keys and user-agent strings in selected endpoints.
          </li>
          <li>
            Client storage data used by the app (local identity keys) and an auth session cookie.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Why We Process Data</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
          <li>To provide core functionality: creating lists, votes, spaces, and sharing access.</li>
          <li>To keep accounts/devices linked and allow recovery flows.</li>
          <li>To secure the service and prevent abuse (rate limiting, integrity checks).</li>
          <li>To operate, maintain, and back up the service.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Legal Bases (GDPR)</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
          <li>Article 6(1)(b): processing necessary to provide the service you request.</li>
          <li>
            Article 6(1)(f): legitimate interests in security, fraud prevention, and operations.
          </li>
          <li>
            Article 6(1)(a): consent where required, including non-essential cookies or tracking if
            introduced.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Retention</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
          <li>Session cookie lifetime: up to 1 year unless cleared earlier.</li>
          <li>Device link codes: short-lived (about 15 minutes).</li>
          <li>
            Private space invite codes: active for up to 7 days unless rotated/revoked earlier.
          </li>
          <li>Unattached uploads: cleaned up on a short cycle (about 24 hours).</li>
          <li>Operational backups: retained on a rolling window (typically up to 21 days).</li>
          <li>We may keep data longer when legally required or needed for disputes/security.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Sharing and Processors</h2>
        <p className="text-sm leading-6 text-neutral-300">
          We use infrastructure and software providers to host and run the service. These providers
          process data only under our instructions and contractual terms (including data processing
          agreements where required).
        </p>
        <p className="text-sm leading-6 text-neutral-300">
          If you use external media links, your browser may connect directly to third-party services
          (for example YouTube, Spotify, Vimeo, TikTok, X, Instagram, SoundCloud, Twitch) and those
          services process your data under their own policies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">International Transfers</h2>
        <p className="text-sm leading-6 text-neutral-300">
          If data is transferred outside the EEA, we use GDPR-compliant safeguards such as adequacy
          decisions or Standard Contractual Clauses, as applicable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Your Rights</h2>
        <p className="text-sm leading-6 text-neutral-300">
          You may request access, rectification, erasure, restriction, portability, and object to
          certain processing. You may also withdraw consent where consent is the legal basis.
        </p>
        <p className="text-sm leading-6 text-neutral-300">
          Contact us at{" "}
          <a
            href={`mailto:${LEGAL_PRIVACY_EMAIL}`}
            className="text-amber-300 underline decoration-amber-500/50 underline-offset-2"
          >
            {LEGAL_PRIVACY_EMAIL}
          </a>{" "}
          for privacy requests. You can also complain to Datatilsynet.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Children</h2>
        <p className="text-sm leading-6 text-neutral-300">
          This service is not directed to children under 13. If you believe a child has provided
          personal data, contact us and we will take appropriate action.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Related Policies</h2>
        <p className="text-sm text-neutral-300">
          See also our{" "}
          <Link href="/terms" className="text-amber-300 underline">
            Terms
          </Link>
          ,{" "}
          <Link href="/cookies" className="text-amber-300 underline">
            Cookie Notice
          </Link>
          , and{" "}
          <Link href="/copyright" className="text-amber-300 underline">
            Copyright Policy
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
