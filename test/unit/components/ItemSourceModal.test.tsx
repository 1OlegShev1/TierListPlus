// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ItemSourceModal } from "@/components/items/ItemSourceModal";

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SPOTIFY_URL = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";

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

    const startInput = screen.getByLabelText("Start (sec)");
    const endInput = screen.getByLabelText("End (sec)");
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
    expect(screen.queryByLabelText("Start (sec)")).toBeNull();
    expect(screen.queryByLabelText("End (sec)")).toBeNull();
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
});
