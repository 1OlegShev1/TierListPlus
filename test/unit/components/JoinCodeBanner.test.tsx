// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JoinCodeBanner } from "@/components/ui/JoinCodeBanner";

describe("JoinCodeBanner", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("keeps code hidden by default and reveals on toggle", () => {
    render(<JoinCodeBanner joinCode="ABCD1234" hideCodeByDefault />);

    expect(screen.getByText("**** ****")).toBeTruthy();
    expect(screen.queryByText("ABCD 1234")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reveal invite code" }));

    expect(screen.getByText("ABCD 1234")).toBeTruthy();
  });

  it("copies invite link while code remains hidden", async () => {
    render(<JoinCodeBanner joinCode="ABCD1234" hideCodeByDefault />);

    fireEvent.click(screen.getByRole("button", { name: "Copy full invite link" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/sessions/join?code=ABCD1234`,
      );
    });

    expect(screen.getByText("**** ****")).toBeTruthy();
    expect(screen.queryByText("ABCD 1234")).toBeNull();
  });

  it("normalizes copied code and link values", async () => {
    render(<JoinCodeBanner joinCode="ab cd1234" hideCodeByDefault />);

    fireEvent.click(screen.getByRole("button", { name: "Copy hidden invite code" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("ABCD1234");
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy full invite link" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/sessions/join?code=ABCD1234`,
      );
    });
  });

  it("reports successful copy results via callback", async () => {
    const onCopyResult = vi.fn();
    render(<JoinCodeBanner joinCode="ABCD1234" hideCodeByDefault onCopyResult={onCopyResult} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy hidden invite code" }));
    await waitFor(() => {
      expect(onCopyResult).toHaveBeenCalledWith({ target: "code", success: true });
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy full invite link" }));
    await waitFor(() => {
      expect(onCopyResult).toHaveBeenCalledWith({ target: "link", success: true });
    });
  });

  it("reports failed copy result when clipboard write throws", async () => {
    const failingWriteText = vi.fn().mockRejectedValueOnce(new Error("copy failed"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: failingWriteText },
      configurable: true,
    });
    const onCopyResult = vi.fn();
    render(<JoinCodeBanner joinCode="ABCD1234" hideCodeByDefault onCopyResult={onCopyResult} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy full invite link" }));
    await waitFor(() => {
      expect(onCopyResult).toHaveBeenCalledWith({ target: "link", success: false });
    });
  });
});
