import { RecoverySection } from "@/components/dashboard/RecoverySection";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DevicesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Devices"
        subtitle="Link browser profiles across phones, tablets, and computers to keep your votes with you."
      />
      <section className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--fg-primary)]">Appearance</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          Choose how TierList+ looks on this browser.
        </p>
        <ThemeSwitcher className="mt-3" />
      </section>
      <RecoverySection />
    </div>
  );
}
