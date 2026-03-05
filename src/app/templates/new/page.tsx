import { ListEditor } from "@/components/templates/ListEditor";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NewListPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const spaceId =
    typeof resolvedSearchParams.spaceId === "string" ? resolvedSearchParams.spaceId : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Make a Tier List</h1>
      <ListEditor spaceId={spaceId} />
    </div>
  );
}
