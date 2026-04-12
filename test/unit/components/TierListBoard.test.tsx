// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import { useTierListStore } from "@/hooks/useTierList";
import {
  buildVoteBoardScopeId,
  createVoteBoardDraftSnapshot,
  getVoteDraftStorageKey,
} from "@/lib/vote-draft-storage";

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default:
    () =>
    ({
      items,
      onComplete,
    }: {
      items?: Array<{ id: string }>;
      onComplete?: (rankedIds: string[]) => void;
    }) =>
      items && onComplete ? (
        <button type="button" onClick={() => onComplete(items.map((item) => item.id).reverse())}>
          Complete bracket
        </button>
      ) : null,
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: mocks.useUser,
}));

vi.mock("@/lib/api-client", () => ({
  apiPost: mocks.apiPost,
  apiPatch: mocks.apiPatch,
  apiDelete: mocks.apiDelete,
  tryCleanupUnattachedUpload: async (imageUrl: string) => {
    await fetch("/api/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });
    return true;
  },
  getErrorMessage: (error: unknown, fallback = "Something went wrong") =>
    error instanceof Error ? error.message : fallback,
}));

vi.mock("@/components/shared/ImageUploader", () => ({
  ImageUploader: ({
    onUploadStateChange,
    onUploaded,
  }: {
    onUploadStateChange?: (uploading: boolean) => void;
    onUploaded?: (image: { url: string; suggestedLabel: string; originalName: string }) => void;
  }) => (
    <>
      <button type="button" onClick={() => onUploadStateChange?.(true)}>
        Simulate upload
      </button>
      <button
        type="button"
        onClick={() =>
          onUploaded?.({
            url: "/img/new.webp",
            suggestedLabel: "New item",
            originalName: "new.png",
          })
        }
      >
        Simulate uploaded image
      </button>
    </>
  ),
}));

function resetStore() {
  useTierListStore.setState({
    tiers: {},
    unranked: [],
    items: new Map(),
    activeId: null,
  });
}

describe("TierListBoard", () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })) as typeof fetch;
    mocks.useUser.mockReset().mockReturnValue({
      userId: "user_1",
      isLoading: false,
      error: null,
    });
    mocks.apiPost.mockReset();
    mocks.apiPatch.mockReset();
    mocks.apiDelete.mockReset();
  });

  it("gates submit, save, and bracket actions while file uploads are still in flight", async () => {
    render(
      <TierListBoard
        sessionId="session_1"
        participantId="participant_1"
        tierConfig={[
          { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
          { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
        ]}
        sessionItems={[
          { id: "item_1", label: "Rust", imageUrl: "/img/rust.webp" },
          { id: "item_2", label: "Go", imageUrl: "/img/go.webp" },
        ]}
        seededTiers={{ S: ["item_1"], A: ["item_2"] }}
        canManageItems
        canSaveTemplate
        templateIsHidden
        onSubmitted={vi.fn()}
      />,
    );

    const submitButton = screen.getByRole("button", { name: /lock in ranking/i });
    const saveButton = screen.getByRole("button", { name: /save as new list/i });
    const bracketButton = screen.getByRole("button", { name: /quick bracket/i });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
      expect((saveButton as HTMLButtonElement).disabled).toBe(false);
      expect((bracketButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Simulate upload" }));

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(true);
      expect((saveButton as HTMLButtonElement).disabled).toBe(true);
      expect((bracketButton as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("does not write late upload results into the shared store after unmount", async () => {
    let resolveItemCreate:
      | ((value: { id: string; label: string; imageUrl: string }) => void)
      | undefined;
    mocks.apiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveItemCreate = resolve;
      }),
    );

    const { unmount } = render(
      <TierListBoard
        sessionId="session_1"
        participantId="participant_1"
        tierConfig={[
          { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
          { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
        ]}
        sessionItems={[]}
        canManageItems
        templateIsHidden
        onSubmitted={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Simulate uploaded image" }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/sessions/session_1/items", {
        label: "New item",
        imageUrl: "/img/new.webp",
      });
    });

    unmount();

    if (!resolveItemCreate) {
      throw new Error("Expected item creation request to start");
    }
    const resolvePendingItemCreate = resolveItemCreate;

    await act(async () => {
      resolvePendingItemCreate({
        id: "item_new",
        label: "New item",
        imageUrl: "/img/new.webp",
      });
      await Promise.resolve();
    });

    expect(useTierListStore.getState().items.has("item_new")).toBe(false);
    expect(useTierListStore.getState().unranked).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith("/api/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: "/img/new.webp" }),
    });
  });

  it("submits tier votes after quick bracket seeding is completed", async () => {
    const onSubmitted = vi.fn();
    mocks.apiPost.mockResolvedValue({ createdCount: 2 });

    render(
      <TierListBoard
        sessionId="session_1"
        participantId="participant_1"
        tierConfig={[
          { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
          { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
        ]}
        sessionItems={[
          { id: "item_1", label: "Rust", imageUrl: "/img/rust.webp" },
          { id: "item_2", label: "Go", imageUrl: "/img/go.webp" },
        ]}
        onSubmitted={onSubmitted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /quick bracket/i }));
    fireEvent.click(screen.getByRole("button", { name: /complete bracket/i }));
    fireEvent.click(screen.getByRole("button", { name: /lock in ranking/i }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/sessions/session_1/votes", {
        participantId: "participant_1",
        votes: [
          { sessionItemId: "item_2", tierKey: "S", rankInTier: 0 },
          { sessionItemId: "item_1", tierKey: "A", rankInTier: 0 },
        ],
      });
    });
    expect(onSubmitted).toHaveBeenCalled();
  });

  it("keeps tier spotlight interaction available when item management is enabled", () => {
    render(
      <TierListBoard
        sessionId="session_1"
        participantId="participant_1"
        tierConfig={[
          { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
          { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
        ]}
        sessionItems={[
          { id: "item_1", label: "Rust", imageUrl: "/img/rust.webp" },
          { id: "item_2", label: "Go", imageUrl: "/img/go.webp" },
        ]}
        seededTiers={{ S: ["item_1"], A: ["item_2"] }}
        canManageItems
        onSubmitted={vi.fn()}
      />,
    );

    const itemLabel = screen.getByText("Rust");
    const spotlightButton = itemLabel.closest("button");
    if (!spotlightButton) {
      throw new Error("Expected spotlight button for tier item");
    }

    fireEvent.click(spotlightButton);
    expect(spotlightButton.className.includes("border-[var(--accent-primary-hover)]")).toBe(true);
  });

  it("restores stored vote drafts on mount and emits a notice", async () => {
    const sessionId = "session_1";
    const participantId = "participant_1";
    const tierKeys = ["S", "A"];
    const validItemIds = new Set(["item_1", "item_2"]);
    const draftContext = {
      userId: "user_1",
      scopeId: buildVoteBoardScopeId({ sessionId, participantId }),
      tierKeys,
      validItemIds,
    };
    const restored = createVoteBoardDraftSnapshot({
      tierKeys,
      validItemIds,
      tiers: { S: ["item_2"], A: [] },
      unranked: ["item_1"],
    });
    localStorage.setItem(getVoteDraftStorageKey(draftContext), JSON.stringify(restored));

    const onNotice = vi.fn();
    render(
      <TierListBoard
        sessionId={sessionId}
        participantId={participantId}
        tierConfig={[
          { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
          { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
        ]}
        sessionItems={[
          { id: "item_1", label: "Rust", imageUrl: "/img/rust.webp" },
          { id: "item_2", label: "Go", imageUrl: "/img/go.webp" },
        ]}
        onSubmitted={vi.fn()}
        onNotice={onNotice}
      />,
    );

    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: "amber",
          message: "Draft restored.",
        }),
      );
    });
    expect(screen.getByText("1/2 ranked")).toBeTruthy();
  });

  it("persists live-added items in vote draft snapshots", async () => {
    const sessionId = "session_1";
    const participantId = "participant_1";
    mocks.apiPost.mockImplementation(async (path) => {
      if (path === `/api/sessions/${sessionId}/items`) {
        return { id: "item_new", label: "New item", imageUrl: "/img/new.webp" };
      }
      return { createdCount: 0 };
    });

    render(
      <TierListBoard
        sessionId={sessionId}
        participantId={participantId}
        tierConfig={[
          { key: "S", label: "S", color: "#ff7f7f", sortOrder: 0 },
          { key: "A", label: "A", color: "#ffbf7f", sortOrder: 1 },
        ]}
        sessionItems={[{ id: "item_1", label: "Rust", imageUrl: "/img/rust.webp" }]}
        canManageItems
        onSubmitted={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Simulate uploaded image" }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith(`/api/sessions/${sessionId}/items`, {
        label: "New item",
        imageUrl: "/img/new.webp",
      });
    });

    const context = {
      userId: "user_1",
      scopeId: buildVoteBoardScopeId({ sessionId, participantId }),
    };

    await waitFor(
      () => {
        const saved = localStorage.getItem(getVoteDraftStorageKey(context));
        expect(saved).toBeTruthy();
      },
      { timeout: 3000 },
    );

    const saved = localStorage.getItem(getVoteDraftStorageKey(context));
    expect(saved).toContain("item_new");
  });
});
