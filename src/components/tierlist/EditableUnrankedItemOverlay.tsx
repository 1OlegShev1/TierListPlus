"use client";

import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { EDITABLE_UNRANKED_ITEM_METRICS_CLASS } from "./sizing";

interface EditableUnrankedItemOverlayProps {
  label: string;
  imageUrl: string;
}

export function EditableUnrankedItemOverlay({
  label,
  imageUrl,
}: EditableUnrankedItemOverlayProps) {
  const labelText = label.trim().length > 0 ? label : "Untitled item";

  return (
    <div
      className={`flex h-[var(--editable-item-height)] w-[var(--editable-item-width)] flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-[var(--editable-item-padding)] shadow-xl ${EDITABLE_UNRANKED_ITEM_METRICS_CLASS}`}
    >
      <div className="h-[var(--editable-item-media-size)] w-full overflow-hidden rounded">
        <ItemArtwork
          src={imageUrl}
          alt={labelText}
          className="h-full w-full"
          presentation="ambient"
          inset="compact"
          draggable={false}
        />
      </div>
      <div className="mt-[var(--editable-item-label-gap)] h-[var(--editable-item-label-height)] w-full truncate rounded border border-transparent px-1 py-1 text-left text-xs text-[var(--fg-secondary)]">
        {labelText}
      </div>
    </div>
  );
}
