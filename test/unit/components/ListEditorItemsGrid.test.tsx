// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { ListEditorItemsGrid } from "@/components/templates/ListEditorItemsGrid";
import type { TemplateItemData } from "@/types";

vi.mock("@/components/shared/CombinedAddItemTile", () => ({
  CombinedAddItemTile: () => <div data-testid="add-item-tile" />,
}));

vi.mock("@/components/ui/ItemArtwork", () => ({
  ItemArtwork: ({ alt, animate }: { alt: string; animate?: boolean }) => (
    <div data-animate={animate ? "true" : "false"}>{alt}</div>
  ),
}));

const item: TemplateItemData = {
  id: "item_1",
  label: "Alpha",
  imageUrl: "/img/a.webp",
  sortOrder: 0,
};

function renderGrid(overrides?: Partial<ComponentProps<typeof ListEditorItemsGrid>>) {
  const addByUrlTriggerRef = { current: null as HTMLButtonElement | null };
  const uploadTriggerRef = { current: null as HTMLButtonElement | null };
  const itemCardRefs = { current: [] as Array<HTMLDivElement | null> };
  const itemLabelRefs = { current: [] as Array<HTMLInputElement | null> };

  return render(
    <ListEditorItemsGrid
      addByUrlTriggerRef={addByUrlTriggerRef}
      uploadTriggerRef={uploadTriggerRef}
      itemCardRefs={itemCardRefs}
      itemLabelRefs={itemLabelRefs}
      items={[item]}
      previewingItemIndex={0}
      uploadsDisabled={false}
      userLoading={false}
      onLabelEnter={vi.fn()}
      onOpenAddByUrl={vi.fn()}
      onOpenItemSource={vi.fn()}
      onCloseItemPreview={vi.fn()}
      onFocusItemPreview={vi.fn()}
      onRemoveItem={vi.fn()}
      onToggleItemPreview={vi.fn()}
      onUpdateItemLabel={vi.fn()}
      onUploaded={vi.fn()}
      onUploadStateChange={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ListEditorItemsGrid", () => {
  it("closes preview on blur using explicit close handler", () => {
    const onCloseItemPreview = vi.fn();
    const onToggleItemPreview = vi.fn();
    renderGrid({ onCloseItemPreview, onToggleItemPreview });

    const previewButton = screen.getByRole("button", { name: "Preview animation for Alpha" });
    fireEvent.blur(previewButton, { relatedTarget: document.body });

    expect(onCloseItemPreview).toHaveBeenCalledTimes(1);
    expect(onCloseItemPreview).toHaveBeenCalledWith(0);
    expect(onToggleItemPreview).not.toHaveBeenCalled();
  });

  it("toggles preview on click", () => {
    const onToggleItemPreview = vi.fn();
    renderGrid({ previewingItemIndex: null, onToggleItemPreview });

    fireEvent.click(screen.getByRole("button", { name: "Preview animation for Alpha" }));
    expect(onToggleItemPreview).toHaveBeenCalledWith(0);
  });

  it("animates focused artwork", () => {
    renderGrid({ previewingItemIndex: 0 });

    expect(screen.getByText("Alpha").getAttribute("data-animate")).toBe("true");
  });

  it("opens an existing source from a double-click on artwork", () => {
    const onOpenItemSource = vi.fn();
    const onFocusItemPreview = vi.fn();
    renderGrid({
      items: [{ ...item, sourceUrl: "https://example.com/alpha" }],
      onOpenItemSource,
      onFocusItemPreview,
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Preview animation for Alpha" }));

    expect(onFocusItemPreview).toHaveBeenCalledWith(0);
    expect(onOpenItemSource).toHaveBeenCalledWith(0);
  });

  it("opens source editing from a double-click when no source exists", () => {
    const onOpenItemSource = vi.fn();
    const onFocusItemPreview = vi.fn();
    renderGrid({ onOpenItemSource, onFocusItemPreview });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Preview animation for Alpha" }));

    expect(onFocusItemPreview).toHaveBeenCalledWith(0);
    expect(onOpenItemSource).toHaveBeenCalledWith(0);
  });

  it("does not toggle preview off after touch double-tap opens source editing", () => {
    const onOpenItemSource = vi.fn();
    const onFocusItemPreview = vi.fn();
    const onToggleItemPreview = vi.fn();
    renderGrid({
      previewingItemIndex: null,
      onOpenItemSource,
      onFocusItemPreview,
      onToggleItemPreview,
    });
    const button = screen.getByRole("button", { name: "Preview animation for Alpha" });

    fireEvent.pointerUp(button, { pointerType: "touch", timeStamp: 100 });
    fireEvent.click(button);
    fireEvent.pointerUp(button, { pointerType: "touch", timeStamp: 250 });
    fireEvent.click(button);

    expect(onFocusItemPreview).toHaveBeenCalledWith(0);
    expect(onOpenItemSource).toHaveBeenCalledWith(0);
    expect(onToggleItemPreview).toHaveBeenCalledTimes(1);
  });
});
