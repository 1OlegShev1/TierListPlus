import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListEditor } from "@/components/templates/ListEditor";
import { buttonVariants } from "@/components/ui/Button";
import { getCookieAuth } from "@/lib/auth";
import { canReadSpace, getSpaceAccessForUser } from "@/lib/space";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NewListPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const spaceId =
    typeof resolvedSearchParams.spaceId === "string" ? resolvedSearchParams.spaceId : null;
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  let accessSpaceId: string | null = null;
  let accessSpaceName: string | null = null;

  if (spaceId) {
    const spaceAccess = await getSpaceAccessForUser(spaceId, userId);
    if (!spaceAccess) notFound();
    if (!canReadSpace(spaceAccess.visibility, spaceAccess.isMember)) notFound();
    if (!spaceAccess.isMember) {
      redirect(`/spaces/${spaceAccess.id}`);
    }
    accessSpaceId = spaceAccess.id;
    accessSpaceName = spaceAccess.name;
  }

  return (
    <div>
      <Link
        href={accessSpaceId ? `/spaces/${accessSpaceId}` : "/templates"}
        className={`${buttonVariants.ghost} mb-3 inline-flex items-center`}
      >
        {accessSpaceId ? "\u2190 Back to Space" : "\u2190 Back to Lists"}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Make a Starter List</h1>
      <ListEditor spaceId={accessSpaceId} spaceName={accessSpaceName} />
    </div>
  );
}
