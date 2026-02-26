export function Loading({ message = "Loading..." }: { message?: string }) {
  return <div className="flex items-center justify-center py-20 text-neutral-500">{message}</div>;
}
