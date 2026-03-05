import { getStaticArtworkSrc, isAnimatedImageUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type ItemArtworkPresentation = "ambient" | "cover";
type ItemArtworkInset = "tight" | "compact" | "default";

interface ItemArtworkProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  presentation?: ItemArtworkPresentation;
  inset?: ItemArtworkInset;
  loading?: "eager" | "lazy";
  decoding?: "async" | "auto" | "sync";
  draggable?: boolean;
  animate?: boolean;
  showAnimatedHint?: boolean;
}

const insetClasses: Record<ItemArtworkInset, string> = {
  tight: "p-[2%]",
  compact: "p-[4%]",
  default: "p-[6%]",
};

export function ItemArtwork({
  src,
  alt,
  className,
  imageClassName,
  presentation = "cover",
  inset = "default",
  loading,
  decoding,
  draggable,
  animate = false,
  showAnimatedHint = false,
}: ItemArtworkProps) {
  const isAnimated = isAnimatedImageUrl(src);
  const staticSrc = getStaticArtworkSrc(src);
  const displaySrc = animate && isAnimated ? src : staticSrc;
  const renderAnimatedHint = showAnimatedHint && isAnimated && !animate;

  if (presentation === "cover") {
    return (
      <div className={cn("relative overflow-hidden bg-neutral-950", className)}>
        <img
          src={displaySrc}
          alt={alt}
          loading={loading}
          decoding={decoding}
          draggable={draggable}
          className={cn("pointer-events-none h-full w-full object-cover", imageClassName)}
        />
        {renderAnimatedHint && (
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-white/95">
            GIF
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-neutral-950", className)}>
      <img
        src={staticSrc}
        alt=""
        aria-hidden="true"
        loading={loading}
        decoding={decoding}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.15] object-cover opacity-25 blur-md saturate-150"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_38%),linear-gradient(to_bottom,rgba(38,38,38,0.18),rgba(10,10,10,0.64))]" />
      <img
        src={displaySrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        draggable={draggable}
        className={cn(
          "pointer-events-none relative h-full w-full object-contain [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.2))_drop-shadow(0_6px_14px_rgba(0,0,0,0.48))]",
          insetClasses[inset],
          imageClassName,
        )}
      />
      {renderAnimatedHint && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-white/95">
          GIF
        </span>
      )}
    </div>
  );
}
