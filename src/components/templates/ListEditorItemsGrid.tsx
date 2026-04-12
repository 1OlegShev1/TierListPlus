import { Link2 } from "lucide-react";
import type { RefObject } from "react";
import { CombinedAddItemTile } from "@/components/shared/CombinedAddItemTile";
import type { UploadedImage } from "@/components/shared/ImageUploader";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { CloseIcon } from "@/components/ui/icons";
import { MAX_ITEM_LABEL_LENGTH } from "@/lib/item-source";
import type { TemplateItemData } from "@/types";

interface ListEditorItemsGridProps {
  addByUrlTriggerRef: RefObject<HTMLButtonElement | null>;
  itemCardRefs: RefObject<Array<HTMLDivElement | null>>;
  itemLabelRefs: RefObject<Array<HTMLInputElement | null>>;
  items: TemplateItemData[];
  onLabelEnter: (index: number, currentInput: HTMLInputElement) => void;
  onOpenAddByUrl: () => void;
  onOpenItemSource: (index: number) => void;
  onCloseItemPreview: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onToggleItemPreview: (index: number) => void;
  onUpdateItemLabel: (index: number, value: string) => void;
  onUploaded: (uploaded: UploadedImage) => void;
  onUploadStateChange: (uploading: boolean) => void;
  previewingItemIndex: number | null;
  uploadTriggerRef: RefObject<HTMLButtonElement | null>;
  uploadsDisabled: boolean;
  userLoading: boolean;
}

export function ListEditorItemsGrid({
  addByUrlTriggerRef,
  itemCardRefs,
  itemLabelRefs,
  items,
  onLabelEnter,
  onOpenAddByUrl,
  onOpenItemSource,
  onCloseItemPreview,
  onRemoveItem,
  onToggleItemPreview,
  onUpdateItemLabel,
  onUploaded,
  onUploadStateChange,
  previewingItemIndex,
  uploadTriggerRef,
  uploadsDisabled,
  userLoading,
}: ListEditorItemsGridProps) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-[var(--fg-muted)]">Picks ({items.length})</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item, index) => (
          <div
            key={item.id ?? `new-${index}`}
            ref={(node) => {
              itemCardRefs.current[index] = node;
            }}
            className="group relative rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2"
          >
            <button
              type="button"
              onClick={() => onRemoveItem(index)}
              className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-media-overlay)] text-[var(--fg-on-media-overlay)] opacity-0 transition-all hover:border-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] hover:text-[var(--action-danger-fg)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label={`Remove ${item.label || "pick"}`}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenItemSource(index)}
              className={`absolute left-1 top-1 z-10 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                item.sourceUrl
                  ? "border-[var(--source-control-linked-border)] bg-[var(--source-control-linked-bg)] text-[var(--source-control-linked-fg)] hover:border-[var(--source-control-linked-border-hover)] hover:bg-[var(--source-control-linked-bg-hover)] hover:text-[var(--source-control-linked-fg-hover)]"
                  : "border-[var(--source-control-unlinked-border)] bg-[var(--source-control-unlinked-bg)] text-[var(--source-control-unlinked-fg)] hover:border-[var(--source-control-unlinked-border-hover)] hover:bg-[var(--source-control-unlinked-bg-hover)] hover:text-[var(--source-control-unlinked-fg-hover)]"
              } ${
                item.sourceUrl
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
              }`}
              aria-label={
                item.sourceUrl
                  ? `Open source for ${item.label || "pick"}`
                  : `Add source for ${item.label || "pick"}`
              }
              title={item.sourceUrl ? "Open source link" : "Add source link"}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {item.sourceUrl ? "See" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => onToggleItemPreview(index)}
              onBlur={(event) => {
                const card = itemCardRefs.current[index];
                const nextFocused = event.relatedTarget;
                if (card && nextFocused instanceof Node && card.contains(nextFocused)) return;
                onCloseItemPreview(index);
              }}
              className="block w-full overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
              aria-label={`Preview animation for ${item.label || "pick"}`}
            >
              <ItemArtwork
                src={item.imageUrl}
                alt={item.label}
                className="aspect-square w-full rounded"
                presentation="ambient"
                inset="compact"
                animate={previewingItemIndex === index}
                showAnimatedHint
              />
            </button>
            <input
              ref={(node) => {
                itemLabelRefs.current[index] = node;
              }}
              type="text"
              placeholder="Name this pick"
              value={item.label}
              onChange={(event) => onUpdateItemLabel(index, event.target.value)}
              maxLength={MAX_ITEM_LABEL_LENGTH}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key !== "Enter") return;
                event.preventDefault();
                onLabelEnter(index, event.currentTarget);
              }}
              className="mt-2 w-full rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>
        ))}
        <CombinedAddItemTile
          onAddByUrlClick={onOpenAddByUrl}
          addByUrlDisabled={uploadsDisabled}
          addByUrlTriggerRef={addByUrlTriggerRef}
          onUploaded={onUploaded}
          onUploadStateChange={onUploadStateChange}
          multiple
          className="w-full"
          matchUploadedItemCardHeight
          labelPlaceholder="Name this pick"
          uploadDisabled={uploadsDisabled}
          uploadTriggerRef={uploadTriggerRef}
          uploadIdleLabel={
            userLoading ? "Getting ready..." : uploadsDisabled ? "Device needed" : undefined
          }
        />
      </div>
    </div>
  );
}
