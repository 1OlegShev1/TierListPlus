import { Suspense } from "react";
import { NewSessionForm } from "@/components/sessions/NewSessionForm";
import { Loading } from "@/components/ui/Loading";

export default function NewSessionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewSessionForm />
    </Suspense>
  );
}
