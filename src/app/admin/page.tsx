import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AdminStatsPage } from "@/components/admin/AdminStatsPage";
import { getCookieAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);

  if (!auth || auth.role !== "ADMIN") {
    notFound();
  }

  return <AdminStatsPage />;
}
