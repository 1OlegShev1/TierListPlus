export const SORT_ORDER_ASC = { sortOrder: "asc" } as const;

export const SESSION_TEMPLATE_SELECT = {
  name: true,
  isHidden: true,
} as const;

export const SESSION_PREVIEW_ITEM_SELECT = {
  id: true,
  imageUrl: true,
  label: true,
} as const;

export const SESSION_COUNTS_WITH_ITEMS_SELECT = {
  participants: true,
  items: true,
} as const;

export const SESSION_PARTICIPANT_COUNT_SELECT = {
  participants: true,
} as const;

export function buildSessionPreviewItemsInclude(take: number) {
  return {
    take,
    orderBy: SORT_ORDER_ASC,
    select: SESSION_PREVIEW_ITEM_SELECT,
  };
}

export function buildSessionCardInclude(previewItemCount: number) {
  return {
    template: { select: SESSION_TEMPLATE_SELECT },
    items: buildSessionPreviewItemsInclude(previewItemCount),
    _count: { select: SESSION_COUNTS_WITH_ITEMS_SELECT },
  };
}
