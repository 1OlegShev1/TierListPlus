import { Suspense } from "react";
import { NewSessionForm } from "@/components/sessions/NewSessionForm";

export default function NewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-neutral-500">
          Loading...
        </div>
      }
    >
      <NewSessionForm />
    </Suspense>
  );
}
