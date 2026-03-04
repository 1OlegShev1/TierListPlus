// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageUploader } from "@/components/shared/ImageUploader";

describe("ImageUploader", () => {
  it("reports upload state changes while a file is uploading", async () => {
    const onUploaded = vi.fn();
    const onUploadStateChange = vi.fn();
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    let resolveResponse: ((value: Response) => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    );

    render(
      <ImageUploader onUploaded={onUploaded} onUploadStateChange={onUploadStateChange} />,
    );

    fireEvent.change(screen.getByLabelText("Upload image"), {
      target: {
        files: [new File(["png"], "rust.png", { type: "image/png" })],
      },
    });

    expect(onUploadStateChange).toHaveBeenCalledWith(true);

    if (!resolveResponse) {
      throw new Error("Expected upload request to start");
    }

    resolveResponse(
      new Response(JSON.stringify({ url: "/uploads/rust.webp" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith({
        url: "/uploads/rust.webp",
        suggestedLabel: "rust",
        originalName: "rust.png",
      });
    });

    await waitFor(() => {
      expect(onUploadStateChange).toHaveBeenLastCalledWith(false);
    });
  });
});
