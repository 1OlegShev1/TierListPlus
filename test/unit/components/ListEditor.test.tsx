// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ListEditor } from "@/components/templates/ListEditor";
import {
  buildListEditorScopeId,
  createListEditorDraftSnapshot,
  getListDraftStorageKey,
} from "@/lib/list-draft-storage";

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerBack: vi.fn(),
  useUser: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiFetch: vi.fn(),
  getErrorMessage: vi.fn((error: unknown, fallback?: string) =>
    error instanceof Error ? error.message : (fallback ?? "Request failed"),
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    back: mocks.routerBack,
  }),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: mocks.useUser,
}));

vi.mock("@/lib/api-client", () => ({
  apiPost: mocks.apiPost,
  apiPatch: mocks.apiPatch,
  apiFetch: mocks.apiFetch,
  getErrorMessage: mocks.getErrorMessage,
}));

vi.mock("@/components/shared/CombinedAddItemTile", () => ({
  CombinedAddItemTile: () => <div data-testid="add-item-tile" />,
}));

vi.mock("@/components/templates/ListRankingPreviewTeaser", () => ({
  ListRankingPreviewTeaser: ({ items }: { items: Array<unknown> }) => (
    <div data-testid="preview-teaser">{`preview:${items.length}`}</div>
  ),
}));

vi.mock("@/components/ui/ItemArtwork", () => ({
  ItemArtwork: ({ alt }: { alt: string }) => <div data-testid="item-artwork">{alt}</div>,
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <p>{description}</p>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel ?? "Confirm"}
        </button>
      </div>
    ) : null,
}));

const baseItem = {
  id: "item_1",
  label: "Base item",
  imageUrl: "/img/base.webp",
  sortOrder: 0,
};

const baseProps = {
  initialName: "Base list",
  initialDescription: "Base description",
  initialIsPublic: false,
  initialItems: [baseItem],
};

const draftContext = {
  userId: "user_1",
  scopeId: buildListEditorScopeId({}),
};
const draftKey = getListDraftStorageKey(draftContext);

async function flushAsyncEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("ListEditor draft behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.routerPush.mockReset();
    mocks.routerBack.mockReset();
    mocks.apiPost.mockReset().mockResolvedValue({});
    mocks.apiPatch.mockReset().mockResolvedValue({});
    mocks.apiFetch.mockReset().mockResolvedValue({});
    mocks.useUser.mockReset().mockReturnValue({
      userId: "user_1",
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-restores valid draft and shows discard action", async () => {
    const restored = createListEditorDraftSnapshot({
      name: "Recovered list",
      description: "Recovered description",
      isPublic: true,
      items: [
        { ...baseItem, label: "Recovered item", sortOrder: 0 },
        { label: "Second", imageUrl: "/img/second.webp", sortOrder: 1 },
      ],
    });
    localStorage.setItem(draftKey, JSON.stringify(restored));

    render(<ListEditor {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Recovered list")).toBeTruthy();
      expect(screen.getByText("Draft restored.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Discard draft" })).toBeTruthy();
    });
    expect(screen.getByDisplayValue("Recovered item")).toBeTruthy();
    expect(screen.getByDisplayValue("Second")).toBeTruthy();
  });

  it("reloads draft when editor scope changes on rerender", async () => {
    const scopeOneKey = getListDraftStorageKey({
      userId: "user_1",
      scopeId: buildListEditorScopeId({ listId: "tpl_1" }),
    });
    const scopeTwoKey = getListDraftStorageKey({
      userId: "user_1",
      scopeId: buildListEditorScopeId({ listId: "tpl_2" }),
    });

    localStorage.setItem(
      scopeOneKey,
      JSON.stringify(
        createListEditorDraftSnapshot({
          name: "Draft One",
          description: "One",
          isPublic: false,
          items: [{ ...baseItem, label: "Item One", sortOrder: 0 }],
        }),
      ),
    );
    localStorage.setItem(
      scopeTwoKey,
      JSON.stringify(
        createListEditorDraftSnapshot({
          name: "Draft Two",
          description: "Two",
          isPublic: true,
          items: [{ ...baseItem, label: "Item Two", sortOrder: 0 }],
        }),
      ),
    );

    const { rerender } = render(<ListEditor {...baseProps} listId="tpl_1" />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Draft One")).toBeTruthy();
      expect(screen.getByDisplayValue("Item One")).toBeTruthy();
    });

    rerender(<ListEditor {...baseProps} listId="tpl_2" />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Draft Two")).toBeTruthy();
      expect(screen.getByDisplayValue("Item Two")).toBeTruthy();
    });
  });

  it("autosaves with debounce when draft becomes dirty", async () => {
    vi.useFakeTimers();
    render(<ListEditor {...baseProps} />);
    await flushAsyncEffects();

    fireEvent.change(screen.getByPlaceholderText("List name"), {
      target: { value: "Updated list name" },
    });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(localStorage.getItem(draftKey)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const storedRaw = localStorage.getItem(draftKey);
    expect(storedRaw).not.toBeNull();
    const stored = JSON.parse(storedRaw ?? "{}") as { name?: string };
    expect(stored.name).toBe("Updated list name");
    vi.useRealTimers();
  });

  it("clears draft before navigating after successful save", async () => {
    localStorage.setItem(
      draftKey,
      JSON.stringify(
        createListEditorDraftSnapshot({
          name: "Saved draft",
          description: "x",
          isPublic: false,
          items: [baseItem],
        }),
      ),
    );

    mocks.apiPost.mockImplementation((url: string) => {
      if (url === "/api/templates") return Promise.resolve({ id: "template_saved" });
      return Promise.resolve({});
    });

    render(<ListEditor {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Create List" }));

    await waitFor(() => {
      expect(mocks.routerPush).toHaveBeenCalledWith("/templates/template_saved");
    });
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it("discard draft action clears storage and reverts to baseline", async () => {
    localStorage.setItem(
      draftKey,
      JSON.stringify(
        createListEditorDraftSnapshot({
          name: "Draft Name",
          description: "Draft Desc",
          isPublic: true,
          items: [{ ...baseItem, label: "Draft item", sortOrder: 0 }],
        }),
      ),
    );

    render(<ListEditor {...baseProps} />);

    await screen.findByText("Draft restored.");
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Base list")).toBeTruthy();
      expect(screen.getByDisplayValue("Base description")).toBeTruthy();
    });
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(screen.queryByText("Draft restored.")).toBeNull();
  });

  it("cancel dialog supports keep-draft-leave and discard-draft-leave", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<ListEditor {...baseProps} />);
    await flushAsyncEffects();

    fireEvent.change(screen.getByPlaceholderText("List name"), {
      target: { value: "Dirty list" },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(localStorage.getItem(draftKey)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const keepDialog = screen.getByTestId("confirm-dialog");
    fireEvent.click(within(keepDialog).getByRole("button", { name: "Cancel" }));
    expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(draftKey)).not.toBeNull();

    unmount();
    mocks.routerBack.mockReset();

    render(<ListEditor {...baseProps} />);
    await flushAsyncEffects();
    fireEvent.change(screen.getByPlaceholderText("List name"), {
      target: { value: "Dirty again" },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const discardDialog = screen.getByTestId("confirm-dialog");
    fireEvent.click(within(discardDialog).getByRole("button", { name: "Discard draft and leave" }));
    await flushAsyncEffects();
    expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(draftKey)).toBeNull();
    vi.useRealTimers();
  });

  it("only blocks beforeunload while dirty", async () => {
    render(<ListEditor {...baseProps} />);

    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByPlaceholderText("List name"), {
      target: { value: "Dirty name" },
    });
    await waitFor(() => {
      const dirtyEvent = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(dirtyEvent);
      expect(dirtyEvent.defaultPrevented).toBe(true);
    });

    fireEvent.change(screen.getByPlaceholderText("List name"), {
      target: { value: "Base list" },
    });
    await waitFor(() => {
      const resetEvent = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(resetEvent);
      expect(resetEvent.defaultPrevented).toBe(false);
    });
  });
});
