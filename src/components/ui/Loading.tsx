export function Loading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-base text-neutral-500">
      {message}
    </div>
  );
}
