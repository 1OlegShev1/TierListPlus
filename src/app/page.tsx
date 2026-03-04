import { cookies } from "next/headers";
import { HomeContent } from "@/components/home/HomeContent";
import { getCookieAuth } from "@/lib/auth";
import { loadHomeData } from "@/lib/home-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const initialData = auth?.userId ? await loadHomeData(auth.userId) : null;

  return <HomeContent initialData={initialData} />;
}
