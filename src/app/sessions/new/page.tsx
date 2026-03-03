import { Suspense } from "react";
import { NewVoteForm } from "@/components/sessions/NewVoteForm";
import { Loading } from "@/components/ui/Loading";

export default function NewVotePage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewVoteForm />
    </Suspense>
  );
}
