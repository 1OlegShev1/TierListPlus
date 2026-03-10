import { RecoverySection } from "@/components/dashboard/RecoverySection";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DevicesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Devices"
        subtitle="Link browser profiles across phones, tablets, and computers to keep your votes with you."
      />
      <RecoverySection />
    </div>
  );
}
