import { FileText, Link2, Music, Play } from "lucide-react";
import {
  parseSourceArtworkPlaceholderImageUrl,
  type SourceArtworkPlaceholderKind,
} from "@/lib/item-artwork-placeholder";
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

function SourcePlaceholderIcon({
  kind,
  className,
}: {
  kind: SourceArtworkPlaceholderKind;
  className: string;
}) {
  if (kind === "VIDEO") return <Play className={className} aria-hidden="true" />;
  if (kind === "AUDIO") return <Music className={className} aria-hidden="true" />;
  if (kind === "DOCUMENT") return <FileText className={className} aria-hidden="true" />;
  return <Link2 className={className} aria-hidden="true" />;
}

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
  const placeholderKind = parseSourceArtworkPlaceholderImageUrl(src);
  if (placeholderKind) {
    return (
      <div className={cn("relative overflow-hidden bg-[var(--bg-canvas)]", className)}>
        <div
          className="absolute inset-0"
          style={{ background: "var(--bg-media-ambient)" }}
          aria-hidden="true"
        />
        <div className="relative flex h-full w-full items-center justify-center">
          <div className="flex h-[72%] w-[72%] items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]/75">
            <SourcePlaceholderIcon
              kind={placeholderKind}
              className="h-10 w-10 text-[var(--fg-secondary)]"
            />
          </div>
        </div>
      </div>
    );
  }

  const isAnimated = isAnimatedImageUrl(src);
  const staticSrc = getStaticArtworkSrc(src);
  const displaySrc = animate && isAnimated ? src : staticSrc;
  const renderAnimatedHint = showAnimatedHint && isAnimated && !animate;

  if (presentation === "cover") {
    return (
      <div className={cn("relative overflow-hidden bg-[var(--bg-canvas)]", className)}>
        <img
          src={displaySrc}
          alt={alt}
          loading={loading}
          decoding={decoding}
          draggable={draggable}
          className={cn("pointer-events-none h-full w-full object-cover", imageClassName)}
        />
        {renderAnimatedHint && (
          <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-[var(--bg-media-overlay)] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-[var(--fg-on-media-overlay)]">
            GIF
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-[var(--bg-canvas)]", className)}>
      <img
        src={staticSrc}
        alt=""
        aria-hidden="true"
        loading={loading}
        decoding={decoding}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.15] object-cover opacity-25 blur-md saturate-150"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--bg-media-ambient)" }}
        aria-hidden="true"
      />
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
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-[var(--bg-media-overlay)] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-[var(--fg-on-media-overlay)]">
          GIF
        </span>
      )}
    </div>
  );
}
