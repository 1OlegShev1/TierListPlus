// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ItemSourceModal } from "@/components/items/ItemSourceModal";

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const YOUTUBE_SHORTS_URL = "https://www.youtube.com/shorts/dQw4w9WgXcQ";
const SPOTIFY_URL = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";
const GENERIC_URL = "https://example.com/song";
const VIMEO_URL = "https://vimeo.com/123456789";
const FACEBOOK_URL = "https://www.facebook.com/story.php?story_fbid=1&id=2";
const SOUNDCLOUD_SHORT_URL = "https://on.soundcloud.com/fLgl2lu5Ji84fMZUIr";
const SOUNDCLOUD_SHORT_URL_2 = "https://on.soundcloud.com/some-other-link";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  }
});

describe("ItemSourceModal", () => {
  it("does not block save after switching from invalid YouTube interval to Spotify", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <ItemSourceModal
        open
        editable
        itemLabel="Song"
        sourceUrl={YOUTUBE_URL}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    const startInput = screen.getByLabelText("Start time");
    const endInput = screen.getByLabelText("End time");
    fireEvent.change(startInput, { target: { value: "60" } });
    fireEvent.change(endInput, { target: { value: "30" } });

    expect(screen.getByText("End time must be greater than start time.")).toBeTruthy();
    const saveButton = screen.getByRole("button", { name: "Save Source" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    const sourceInput = screen.getByLabelText("Source URL");
    fireEvent.change(sourceInput, { target: { value: SPOTIFY_URL } });

    await waitFor(() => {
      expect(screen.queryByText("End time must be greater than start time.")).toBeNull();
    });
    expect(screen.queryByLabelText("Start time")).toBeNull();
    expect(screen.queryByLabelText("End time")).toBeNull();
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        sourceUrl: SPOTIFY_URL,
        sourceNote: null,
        sourceStartSec: null,
        sourceEndSec: null,
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("renders in read-only mode without editable form controls", () => {
    render(
      <ItemSourceModal
        open
        editable={false}
        itemLabel="Song"
        sourceUrl={YOUTUBE_URL}
        sourceProvider="YOUTUBE"
        sourceNote="Live"
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Source URL")).toBeNull();
    expect(screen.queryByText("Save Source")).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open source" })).toBeTruthy();
  });

  it("shows portrait treatment controls for YouTube Shorts", () => {
    render(
      <ItemSourceModal
        open
        editable={false}
        itemLabel="Short"
        sourceUrl={YOUTUBE_SHORTS_URL}
        sourceProvider="YOUTUBE"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Short YouTube Shorts preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Large preview" })).toBeTruthy();
  });

  it("allows saving generic source URLs", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(<ItemSourceModal open editable itemLabel="Song" onClose={onClose} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Source URL"), { target: { value: GENERIC_URL } });
    const saveButton = screen.getByRole("button", { name: "Save Source" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        sourceUrl: GENERIC_URL,
        sourceNote: null,
        sourceStartSec: null,
        sourceEndSec: null,
      });
    });
  });

  it("parses mm:ss YouTube intervals before save", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("includeDuration=1")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            provider: "YOUTUBE",
            youtubeContentKind: "VIDEO",
            durationSec: 180,
            kind: null,
            label: "YouTube",
            embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            embedType: "iframe",
            thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            title: "Clip",
            note: null,
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          provider: "YOUTUBE",
          youtubeContentKind: "VIDEO",
          durationSec: null,
          kind: null,
          label: "YouTube",
          embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          embedType: "iframe",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          title: "Clip",
          note: null,
        }),
      } as Response);
    });

    try {
      render(
        <ItemSourceModal
          open
          editable
          itemLabel="Song"
          sourceUrl={YOUTUBE_URL}
          onClose={vi.fn()}
          onSave={onSave}
        />,
      );

      fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "1:30" } });
      fireEvent.change(screen.getByLabelText("End time"), { target: { value: "2:15" } });

      await waitFor(() => {
        expect((screen.getByRole("button", { name: "Save Source" }) as HTMLButtonElement).disabled).toBe(
          false,
        );
      });
      fireEvent.click(screen.getByRole("button", { name: "Save Source" }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          sourceUrl: YOUTUBE_URL,
          sourceNote: null,
          sourceStartSec: 90,
          sourceEndSec: 135,
        });
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("treats trailing-colon interval as in-progress without showing format error", () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <ItemSourceModal
        open
        editable
        itemLabel="Song"
        sourceUrl={YOUTUBE_URL}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "2:" } });

    expect(screen.queryByText(/invalid end time/i)).toBeNull();
    expect((screen.getByRole("button", { name: "Save Source" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("enforces end time against resolved clip duration when available", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: "YOUTUBE",
        youtubeContentKind: "VIDEO",
        durationSec: 90,
        kind: null,
        label: "YouTube",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        embedType: "iframe",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        title: "Clip",
        note: null,
      }),
    } as Response);

    try {
      render(
        <ItemSourceModal
          open
          editable
          itemLabel="Song"
          sourceUrl={YOUTUBE_URL}
          onClose={vi.fn()}
          onSave={vi.fn().mockResolvedValue(true)}
        />,
      );

      fireEvent.change(screen.getByLabelText("End time"), { target: { value: "2:00" } });
      await waitFor(() => {
        expect(screen.getByText(/Clip length: 1:30\./)).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText("End time can be at most 1:30.")).toBeTruthy();
      });
      expect((screen.getByRole("button", { name: "Save Source" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("blocks save while duration check is in progress for entered YouTube interval", async () => {
    const originalFetch = globalThis.fetch;
    const deferredDurationResponse = createDeferred<Response>();
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("includeDuration=1")) {
        return deferredDurationResponse.promise;
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          provider: "YOUTUBE",
          youtubeContentKind: "VIDEO",
          durationSec: null,
          kind: null,
          label: "YouTube",
          embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          embedType: "iframe",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          title: "Clip",
          note: null,
        }),
      } as Response);
    });

    try {
      render(
        <ItemSourceModal
          open
          editable
          itemLabel="Song"
          sourceUrl={YOUTUBE_URL}
          onClose={vi.fn()}
          onSave={vi.fn().mockResolvedValue(true)}
        />,
      );

      fireEvent.change(screen.getByLabelText("End time"), { target: { value: "2:00" } });

      await waitFor(() => {
        expect(screen.getByText("Checking clip length...")).toBeTruthy();
      });
      expect((screen.getByRole("button", { name: "Save Source" }) as HTMLButtonElement).disabled).toBe(
        true,
      );

      deferredDurationResponse.resolve({
        ok: true,
        json: async () => ({
          provider: "YOUTUBE",
          youtubeContentKind: "VIDEO",
          durationSec: 180,
          kind: null,
          label: "YouTube",
          embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          embedType: "iframe",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          title: "Clip",
          note: null,
        }),
      } as Response);

      await waitFor(() => {
        expect(screen.queryByText("Checking clip length...")).toBeNull();
      });
      expect((screen.getByRole("button", { name: "Save Source" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("shows fallback note when duration cannot be verified and still allows save", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: "YOUTUBE",
        youtubeContentKind: "VIDEO",
        durationSec: null,
        kind: null,
        label: "YouTube",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        embedType: "iframe",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        title: "Clip",
        note: null,
      }),
    } as Response);

    try {
      render(
        <ItemSourceModal
          open
          editable
          itemLabel="Song"
          sourceUrl={YOUTUBE_URL}
          onClose={vi.fn()}
          onSave={onSave}
        />,
      );

      fireEvent.change(screen.getByLabelText("End time"), { target: { value: "2:00" } });

      await waitFor(() => {
        expect(
          screen.getByText(
            "Could not verify clip length right now. If end time is too high, playback stops at clip end.",
          ),
        ).toBeTruthy();
      });
      expect((screen.getByRole("button", { name: "Save Source" }) as HTMLButtonElement).disabled).toBe(
        false,
      );

      fireEvent.click(screen.getByRole("button", { name: "Save Source" }));
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith({
          sourceUrl: YOUTUBE_URL,
          sourceNote: null,
          sourceStartSec: null,
          sourceEndSec: 120,
        });
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("allows editing item label in create-from-url mode", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: null,
        youtubeContentKind: null,
        kind: "GENERIC",
        label: "External link",
        embedUrl: null,
        embedType: null,
        thumbnailUrl: null,
        title: "Resolved title",
        note: null,
      }),
    } as Response);

    try {
      render(
        <ItemSourceModal
          open
          mode="CREATE_FROM_URL"
          editable
          itemLabel="New item"
          onClose={onClose}
          onSave={onSave}
        />,
      );

      fireEvent.change(screen.getByLabelText("Item URL"), { target: { value: GENERIC_URL } });
      await waitFor(() => {
        expect(
          (screen.getByRole("button", { name: "Add item" }) as HTMLButtonElement).disabled,
        ).toBe(false);
      });
      fireEvent.change(screen.getByLabelText("Item label"), { target: { value: "Custom label" } });
      const addButton = screen.getByRole("button", { name: "Add item" });

      fireEvent.click(addButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceUrl: GENERIC_URL,
            itemLabel: "Custom label",
          }),
        );
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("disables add while create-from-url preview is resolving", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const deferred = createDeferred<Response>();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockReturnValue(deferred.promise);

    try {
      render(
        <ItemSourceModal
          open
          mode="CREATE_FROM_URL"
          editable
          itemLabel="New item"
          onClose={vi.fn()}
          onSave={onSave}
        />,
      );

      fireEvent.change(screen.getByLabelText("Item URL"), { target: { value: GENERIC_URL } });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Resolving..." })).toBeTruthy();
      });
      expect(
        (screen.getByRole("button", { name: "Resolving..." }) as HTMLButtonElement).disabled,
      ).toBe(true);

      deferred.resolve({
        ok: true,
        json: async () => ({
          provider: null,
          youtubeContentKind: null,
          kind: "GENERIC",
          label: "External link",
          embedUrl: null,
          embedType: null,
          thumbnailUrl: null,
          title: "Resolved title",
          note: null,
        }),
      } as Response);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Add item" })).toBeTruthy();
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders Vimeo embed preview in read-only mode", () => {
    render(
      <ItemSourceModal
        open
        editable={false}
        itemLabel="Clip"
        sourceUrl={VIMEO_URL}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTitle("Clip source preview")).toBeTruthy();
  });

  it("shows guidance for blocked social embeds", () => {
    render(
      <ItemSourceModal
        open
        editable={false}
        itemLabel="Post"
        sourceUrl={FACEBOOK_URL}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Facebook commonly blocks iframe preview here. Use Open source."),
    ).toBeTruthy();
  });

  it("resolves SoundCloud short links through oEmbed", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        kind: "SOUNDCLOUD",
        label: "SoundCloud",
        embedUrl:
          "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F1109034904",
        embedType: "iframe",
        note: null,
      }),
    } as Response);

    try {
      render(
        <ItemSourceModal
          open
          editable={false}
          itemLabel="SoundCloud Mix"
          sourceUrl={SOUNDCLOUD_SHORT_URL}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTitle("SoundCloud Mix SoundCloud preview")).toBeTruthy();
      });
      expect(globalThis.fetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("ignores stale resolver responses when URL changes", async () => {
    const originalFetch = globalThis.fetch;
    const firstResponse = createDeferred<Response>();
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return firstResponse.promise;
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          kind: "SOUNDCLOUD",
          label: "SoundCloud",
          embedUrl:
            "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F2",
          embedType: "iframe",
          note: null,
        }),
      } as Response);
    });

    try {
      render(
        <ItemSourceModal
          open
          editable
          itemLabel="SoundCloud Mix"
          sourceUrl={SOUNDCLOUD_SHORT_URL}
          onClose={vi.fn()}
          onSave={vi.fn().mockResolvedValue(true)}
        />,
      );

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      });

      fireEvent.change(screen.getByLabelText("Source URL"), {
        target: { value: SOUNDCLOUD_SHORT_URL_2 },
      });

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(screen.getByTitle("SoundCloud Mix SoundCloud preview")).toBeTruthy();
      });

      firstResponse.resolve({
        ok: true,
        json: async () => ({
          kind: "SOUNDCLOUD",
          label: "SoundCloud",
          embedUrl: null,
          embedType: null,
          note: "stale-note",
        }),
      } as Response);

      await waitFor(() => {
        expect(screen.queryByText("stale-note")).toBeNull();
      });
      expect(screen.getByTitle("SoundCloud Mix SoundCloud preview")).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
