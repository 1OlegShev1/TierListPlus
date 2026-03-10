import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
          Error 404
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--fg-primary)] sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-[var(--fg-muted)] sm:text-base">
          The page you requested does not exist or may have moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
