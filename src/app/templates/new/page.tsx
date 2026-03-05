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
      {accessSpaceId ? (
        <Link
          href={`/spaces/${accessSpaceId}`}
          className={`${buttonVariants.ghost} mb-3 inline-flex`}
        >
          &larr; Back to Space
        </Link>
      ) : null}
      <h1 className="mb-6 text-2xl font-bold">Make a Tier List</h1>
      <ListEditor spaceId={accessSpaceId} spaceName={accessSpaceName} />
    </div>
  );
}
