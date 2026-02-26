export function ErrorMessage({ message }: { message: string }) {
  return <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{message}</p>;
}
