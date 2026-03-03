import { RecoverySection } from "@/components/dashboard/RecoverySection";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DevicesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Devices"
        subtitle="Keep your votes with you when you switch phones, laptops, or browsers."
      />
      <RecoverySection />
    </div>
  );
}
