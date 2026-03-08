// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareVoteButton } from "@/components/sessions/ShareVoteButton";

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  toDataURL: vi.fn(),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: mocks.useUser,
}));

vi.mock("qrcode", () => ({
  toDataURL: mocks.toDataURL,
}));

describe("ShareVoteButton", () => {
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

  beforeEach(() => {
    mocks.useUser.mockReset().mockReturnValue({ userId: "user_1" });
    mocks.toDataURL.mockReset().mockResolvedValue("data:image/png;base64,abc");

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it("generates QR and copies both code and full link", async () => {
    render(
      <ShareVoteButton
        joinCode="ABCD1234"
        creatorId="user_1"
        status="OPEN"
        isLocked={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share link" }));

    await waitFor(() => {
      expect(mocks.toDataURL).toHaveBeenCalledWith(
        `${window.location.origin}/sessions/join?code=ABCD1234`,
        expect.any(Object),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ABCD1234");
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy full link" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/sessions/join?code=ABCD1234`,
      );
    });
  });

  it("stays hidden for non-owners", () => {
    mocks.useUser.mockReturnValue({ userId: "user_2" });

    render(
      <ShareVoteButton
        joinCode="ABCD1234"
        creatorId="user_1"
        status="OPEN"
        isLocked={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Share link" })).toBeNull();
  });

  it("renders for closed votes too", () => {
    render(
      <ShareVoteButton
        joinCode="ABCD1234"
        creatorId="user_1"
        status="CLOSED"
        isLocked={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Share link" })).toBeTruthy();
  });

  it("can re-render from hidden to visible when user ownership resolves", () => {
    mocks.useUser.mockReturnValue({ userId: "user_2" });
    const { rerender } = render(
      <ShareVoteButton joinCode="ABCD1234" creatorId="user_1" status="OPEN" isLocked={false} />,
    );

    expect(screen.queryByRole("button", { name: "Share link" })).toBeNull();

    mocks.useUser.mockReturnValue({ userId: "user_1" });
    rerender(
      <ShareVoteButton joinCode="ABCD1234" creatorId="user_1" status="OPEN" isLocked={false} />,
    );

    expect(screen.getByRole("button", { name: "Share link" })).toBeTruthy();
  });
});
