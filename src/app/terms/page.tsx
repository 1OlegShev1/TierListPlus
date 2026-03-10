import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_COPYRIGHT_EMAIL,
  LEGAL_ENTITY_NAME,
  LEGAL_LAST_UPDATED,
  LEGAL_SERVICE_NAME,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Use | TierList+",
  description: "Terms of Use for TierList+.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-neutral-100">Terms of Use</h1>
        <p className="text-sm text-neutral-400">Last updated: {LEGAL_LAST_UPDATED}</p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-neutral-300">
        <p>
          These Terms govern your use of {LEGAL_SERVICE_NAME} operated by {LEGAL_ENTITY_NAME}.
        </p>
        <p>By using the service, you agree to these Terms.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Eligibility and Acceptable Use</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
          <li>You must use the service lawfully and in good faith.</li>
          <li>The service is not directed to children under 13.</li>
          <li>You may not upload or share content that infringes IP or privacy rights.</li>
          <li>You may not upload unlawful, abusive, harassing, or fraudulent content.</li>
          <li>You may not attempt unauthorized access, scraping abuse, or service disruption.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">
          Accounts, Devices, and Access Codes
        </h2>
        <p className="text-sm leading-6 text-neutral-300">
          The service uses device-based identity, join codes, and invite codes. You are responsible
          for handling your shared links/codes carefully. Anyone with a valid code may access the
          related vote or space according to that resource&apos;s settings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Your Content</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
          <li>You keep ownership of content you create and upload.</li>
          <li>
            You grant us a non-exclusive license to host, process, display, and distribute that
            content only to operate the service.
          </li>
          <li>
            You confirm you have the rights needed for all uploaded and linked material you publish.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">External Content and Platforms</h2>
        <p className="text-sm leading-6 text-neutral-300">
          The service can preview or link to third-party platforms (for example YouTube, Spotify,
          Vimeo, TikTok, X, Instagram, SoundCloud, Twitch). Use of those services is governed by
          their own terms and policies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Enforcement</h2>
        <p className="text-sm leading-6 text-neutral-300">
          We may remove content, suspend access, rotate/revoke codes, or restrict use where needed
          for policy enforcement, legal compliance, or service security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Copyright Complaints</h2>
        <p className="text-sm leading-6 text-neutral-300">
          If you believe content on the service infringes your copyright, send a notice to{" "}
          <a
            href={`mailto:${LEGAL_COPYRIGHT_EMAIL}`}
            className="text-amber-300 underline decoration-amber-500/50 underline-offset-2"
          >
            {LEGAL_COPYRIGHT_EMAIL}
          </a>{" "}
          with enough detail for us to identify and evaluate the claim.
        </p>
        <p className="text-sm leading-6 text-neutral-300">
          We may suspend repeat infringers in appropriate circumstances.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Disclaimers and Liability</h2>
        <p className="text-sm leading-6 text-neutral-300">
          The service is provided "as is" and "as available". To the maximum extent permitted by
          law, we disclaim warranties and are not liable for indirect or consequential damages.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Changes to Terms</h2>
        <p className="text-sm leading-6 text-neutral-300">
          We may update these Terms. Material updates will be reflected by changing the "Last
          updated" date and, where appropriate, by additional notice.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Governing Law</h2>
        <p className="text-sm leading-6 text-neutral-300">
          These Terms are governed by Norwegian law, without prejudice to mandatory consumer rights
          under applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Contact</h2>
        <p className="text-sm text-neutral-300">
          Legal inquiries:{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-amber-300 underline decoration-amber-500/50 underline-offset-2"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
        <p className="text-sm text-neutral-300">
          See also{" "}
          <Link href="/privacy" className="text-amber-300 underline">
            Privacy Policy
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
