export const COMPACT_DRAGGABLE_ITEM_METRICS_CLASS =
  "[--compact-item-size:62px] sm:[--compact-item-size:70px] md:[--compact-item-size:78px] lg:[--compact-item-size:96px]";

export const TIGHT_DRAGGABLE_ITEM_METRICS_CLASS =
  "[--compact-item-size:52px] sm:[--compact-item-size:58px] md:[--compact-item-size:64px] lg:[--compact-item-size:76px]";

export const EDITABLE_UNRANKED_ITEM_METRICS_CLASS =
  "[--editable-item-width:112px] [--editable-item-height:144px] [--editable-item-media-size:100px] [--editable-item-label-gap:4px] [--editable-item-label-height:26px] [--editable-item-padding:6px] sm:[--editable-item-width:120px] sm:[--editable-item-height:152px] sm:[--editable-item-media-size:108px] md:[--editable-item-width:128px] md:[--editable-item-height:160px] md:[--editable-item-media-size:116px]";

export const COMPACT_UNRANKED_POOL_METRICS_CLASS = `${COMPACT_DRAGGABLE_ITEM_METRICS_CLASS} [--unranked-item-height:var(--compact-item-size)] [--unranked-gap:4px] [--unranked-padding:4px] sm:[--unranked-gap:6px] sm:[--unranked-padding:6px] md:[--unranked-gap:6px] md:[--unranked-padding:6px] lg:[--unranked-gap:8px] lg:[--unranked-padding:12px]`;

export const EDITABLE_UNRANKED_POOL_METRICS_CLASS = `${EDITABLE_UNRANKED_ITEM_METRICS_CLASS} [--unranked-item-height:var(--editable-item-height)] [--unranked-gap:4px] [--unranked-padding:4px] sm:[--unranked-gap:6px] sm:[--unranked-padding:6px] md:[--unranked-gap:6px] md:[--unranked-padding:6px] lg:[--unranked-gap:8px] lg:[--unranked-padding:12px]`;
