"use client";

import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { Loading } from "@/components/ui/Loading";

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardContent />
    </Suspense>
  );
}
