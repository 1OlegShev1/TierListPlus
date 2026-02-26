import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-12 pt-20">
      <div className="text-center">
        <h1 className="text-5xl font-bold">
          TierList<span className="text-amber-400">+</span>
        </h1>
        <p className="mt-3 text-lg text-neutral-400">
          Collaborative tier list voting for your team
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-3">
        <Link
          href="/templates/new"
          className="flex flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6 transition-colors hover:border-amber-500/50 hover:bg-neutral-900/80"
        >
          <span className="text-3xl">+</span>
          <span className="font-medium">Create Template</span>
          <span className="text-center text-xs text-neutral-500">
            Upload images and name your items
          </span>
        </Link>

        <Link
          href="/sessions/new"
          className="flex flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6 transition-colors hover:border-amber-500/50 hover:bg-neutral-900/80"
        >
          <span className="text-3xl">&#9654;</span>
          <span className="font-medium">Start Session</span>
          <span className="text-center text-xs text-neutral-500">
            Pick a template and invite colleagues
          </span>
        </Link>

        <Link
          href="/sessions/join"
          className="flex flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6 transition-colors hover:border-amber-500/50 hover:bg-neutral-900/80"
        >
          <span className="text-3xl">&#8618;</span>
          <span className="font-medium">Join Session</span>
          <span className="text-center text-xs text-neutral-500">
            Enter a code to start voting
          </span>
        </Link>
      </div>

      <Link
        href="/sessions"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
      >
        Browse past sessions &rarr;
      </Link>
    </div>
  );
}
