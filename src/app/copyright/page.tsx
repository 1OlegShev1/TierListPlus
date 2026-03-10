import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_COPYRIGHT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Copyright Policy | TierList+",
  description: "How to report copyright and trademark complaints on TierList+.",
};

export default function CopyrightPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-neutral-100">Copyright Policy</h1>
        <p className="text-sm text-neutral-400">Last updated: {LEGAL_LAST_UPDATED}</p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-neutral-300">
        <p>
          We respect intellectual property rights. If you believe content on this service infringes
          your copyright or trademark rights, report it to us.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">How to File a Copyright Notice</h2>
        <p className="text-sm leading-6 text-neutral-300">
          Send your notice to{" "}
          <a
            href={`mailto:${LEGAL_COPYRIGHT_EMAIL}`}
            className="text-amber-300 underline decoration-amber-500/50 underline-offset-2"
          >
            {LEGAL_COPYRIGHT_EMAIL}
          </a>{" "}
          and include:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
          <li>Your name and contact details.</li>
          <li>Identification of the copyrighted work claimed to be infringed.</li>
          <li>Direct URL(s) or enough detail to locate the allegedly infringing material.</li>
          <li>A statement of good-faith belief that the use is not authorized.</li>
          <li>A statement that your notice is accurate and you are authorized to act.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Counter-Notice</h2>
        <p className="text-sm leading-6 text-neutral-300">
          If your content was removed by mistake, you can contact us with a counter-notice that
          explains why the removal was incorrect and includes enough information for us to review.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Repeat Infringer Policy</h2>
        <p className="text-sm leading-6 text-neutral-300">
          We may suspend or terminate access for users who repeatedly infringe intellectual property
          rights.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Trademark Complaints</h2>
        <p className="text-sm leading-6 text-neutral-300">
          For trademark-related complaints, use the same contact and include the mark, registration
          details (if any), and the specific content URL(s).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-neutral-100">Related Policies</h2>
        <p className="text-sm text-neutral-300">
          See our{" "}
          <Link href="/terms" className="text-amber-300 underline">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-amber-300 underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
