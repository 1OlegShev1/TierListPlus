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
    expect(screen.queryByText("ABCD1234")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reveal invite code" }));

    expect(screen.getByText("ABCD1234")).toBeTruthy();
  });

  it("copies invite link while code remains hidden", async () => {
    render(<JoinCodeBanner joinCode="ABCD1234" hideCodeByDefault />);

    fireEvent.click(screen.getByRole("button", { name: "Copy invite link" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/sessions/join?code=ABCD1234`,
      );
    });

    expect(screen.getByText("**** ****")).toBeTruthy();
    expect(screen.queryByText("ABCD1234")).toBeNull();
  });
});
