import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-8 pt-8 sm:gap-12 sm:pt-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold sm:text-5xl">
          TierList<span className="text-amber-400">+</span>
        </h1>
        <p className="mt-2 text-sm text-neutral-400 sm:mt-3 sm:text-lg">
          Collaborative tier list voting for your team
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-3">
        <Link
          href="/templates/new"
          className="flex flex-col items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-amber-500/50 hover:bg-neutral-900/80 sm:gap-2 sm:p-6"
        >
          <span className="text-2xl sm:text-3xl">+</span>
          <span className="text-sm font-medium sm:text-base">Create Template</span>
          <span className="text-center text-[11px] text-neutral-500 sm:text-xs">
            Upload images and name your items
          </span>
        </Link>

        <Link
          href="/sessions/new"
          className="flex flex-col items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-amber-500/50 hover:bg-neutral-900/80 sm:gap-2 sm:p-6"
        >
          <span className="text-2xl sm:text-3xl">&#9654;</span>
          <span className="text-sm font-medium sm:text-base">Start Session</span>
          <span className="text-center text-[11px] text-neutral-500 sm:text-xs">
            Pick a template and invite colleagues
          </span>
        </Link>

        <Link
          href="/sessions/join"
          className="flex flex-col items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-amber-500/50 hover:bg-neutral-900/80 sm:gap-2 sm:p-6"
        >
          <span className="text-2xl sm:text-3xl">&#8618;</span>
          <span className="text-sm font-medium sm:text-base">Join Session</span>
          <span className="text-center text-[11px] text-neutral-500 sm:text-xs">
            Enter a code to start voting
          </span>
        </Link>
      </div>

      <Link
        href="/sessions"
        className="text-xs text-neutral-500 transition-colors hover:text-neutral-300 sm:text-sm"
      >
        Browse past sessions &rarr;
      </Link>
    </div>
  );
}
