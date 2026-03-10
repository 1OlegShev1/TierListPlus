export function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-[var(--state-danger-bg)] px-4 py-2 text-sm text-[var(--state-danger-fg)]">
      {message}
    </p>
  );
}
