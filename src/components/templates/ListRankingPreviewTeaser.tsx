import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { DEFAULT_TIER_CONFIG } from "@/lib/constants";

interface ListRankingPreviewItem {
  id?: string;
  imageUrl: string;
  label: string;
}

const PREVIEW_LIMIT = 6;
const TIER_ROWS = DEFAULT_TIER_CONFIG.slice(0, 3);

export function ListRankingPreviewTeaser({ items }: { items: ListRankingPreviewItem[] }) {
  const previewItems = items.slice(0, PREVIEW_LIMIT);
  const sItems = previewItems.slice(0, 1);
  const aItems = previewItems.slice(1, 3);
  const bItems = previewItems.slice(3, 5);
  const unrankedItems = previewItems.slice(5);
  const hiddenCount = Math.max(items.length - previewItems.length, 0);

  const rows = [
    { ...TIER_ROWS[0], items: sItems },
    { ...TIER_ROWS[1], items: aItems },
    { ...TIER_ROWS[2], items: bItems },
  ];

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--fg-primary)]">
            How this becomes a ranking
          </h2>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            This list is a starter set. Ranking starts after you click Start Ranking From List.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
          Preview only
        </span>
      </div>

      <div className="pointer-events-none relative select-none overflow-hidden" aria-hidden="true">
        <div className="divide-y divide-[var(--border-subtle)]">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[72px_1fr]">
              <div
                className="flex min-h-14 items-center justify-center border-r border-[var(--border-subtle)] text-lg font-bold text-black/85"
                style={{ backgroundColor: row.color }}
              >
                {row.label}
              </div>
              <div className="flex min-h-14 items-center gap-2 px-3 py-2">
                {row.items.length > 0 ? (
                  row.items.map((item, index) => (
                    <div
                      key={item.id ?? `${row.key}-${index}`}
                      className="w-11 shrink-0 overflow-hidden rounded-md border border-[var(--border-subtle)] opacity-60"
                    >
                      <ItemArtwork
                        src={item.imageUrl}
                        alt={item.label}
                        className="aspect-square w-full"
                        presentation="ambient"
                        inset="compact"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-[var(--fg-subtle)]">Preview lane</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border-subtle)] px-3 py-2">
          <p className="text-xs font-medium text-[var(--fg-secondary)]">Unranked</p>
          <div className="mt-2 flex items-center gap-2 overflow-hidden">
            {unrankedItems.length > 0 ? (
              unrankedItems.map((item, index) => (
                <div
                  key={item.id ?? `unranked-${index}`}
                  className="w-11 shrink-0 overflow-hidden rounded-md border border-[var(--border-subtle)] opacity-60"
                >
                  <ItemArtwork
                    src={item.imageUrl}
                    alt={item.label}
                    className="aspect-square w-full"
                    presentation="ambient"
                    inset="compact"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))
            ) : (
              <span className="text-xs text-[var(--fg-subtle)]">Preview lane</span>
            )}
            {hiddenCount > 0 && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--fg-muted)] opacity-60">
                +{hiddenCount}
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[var(--bg-surface)]" />
      </div>
    </section>
  );
}
