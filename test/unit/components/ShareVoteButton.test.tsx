// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareVoteButton } from "@/components/sessions/ShareVoteButton";

const mocks = vi.hoisted(() => ({
  useUser: vi.fn(),
  toDataURL: vi.fn(),
  fetchPrivateSpaceInvite: vi.fn(),
  rotatePrivateSpaceInvite: vi.fn(),
}));
const originalFetch = globalThis.fetch;

vi.mock("@/hooks/useUser", () => ({
  useUser: mocks.useUser,
}));

vi.mock("qrcode", () => ({
  toDataURL: mocks.toDataURL,
}));

vi.mock("@/lib/space-invite-client", () => ({
  fetchPrivateSpaceInvite: mocks.fetchPrivateSpaceInvite,
  rotatePrivateSpaceInvite: mocks.rotatePrivateSpaceInvite,
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
    mocks.fetchPrivateSpaceInvite.mockReset().mockResolvedValue(null);
    mocks.rotatePrivateSpaceInvite.mockReset().mockResolvedValue({
      code: "SPACE1234",
      expiresAt: "2026-03-17T10:00:00.000Z",
    });
    globalThis.fetch = vi.fn();

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("generates QR and copies both code and full link", async () => {
    render(
      <ShareVoteButton joinCode="ABCD1234" creatorId="user_1" status="OPEN" isLocked={false} />,
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
      <ShareVoteButton joinCode="ABCD1234" creatorId="user_1" status="OPEN" isLocked={false} />,
    );

    expect(screen.queryByRole("button", { name: "Share link" })).toBeNull();
  });

  it("renders for space owners even when they did not create the vote", () => {
    mocks.useUser.mockReturnValue({ userId: "space_owner_1" });

    render(
      <ShareVoteButton
        joinCode="ABCD1234"
        creatorId="vote_creator_1"
        status="OPEN"
        isLocked={false}
        spaceVisibility="PRIVATE"
        spaceId="space_1"
        canShareSpaceInvite
      />,
    );

    expect(screen.getByRole("button", { name: "Share link" })).toBeTruthy();
  });

  it("renders for closed votes too", () => {
    render(
      <ShareVoteButton joinCode="ABCD1234" creatorId="user_1" status="CLOSED" isLocked={false} />,
    );

    expect(screen.getByRole("button", { name: "Share link" })).toBeTruthy();
  });

  it("shows private-space join guidance in the share modal", async () => {
    render(
      <ShareVoteButton
        joinCode="ABCD1234"
        creatorId="user_1"
        status="OPEN"
        isLocked={false}
        spaceVisibility="PRIVATE"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share link" }));

    expect(screen.getByText("Private Space Access")).toBeTruthy();
    expect(
      screen.getByText(
        "People outside the space can open this link, but they will need a space invite before they can vote.",
      ),
    ).toBeTruthy();
  });

  it("optionally includes private-space invite in shared link", async () => {
    mocks.fetchPrivateSpaceInvite.mockResolvedValue({
      code: "SPACE1234",
      expiresAt: "2026-03-17T10:00:00.000Z",
    });

    render(
      <ShareVoteButton
        joinCode="ABCD1234"
        creatorId="user_1"
        status="OPEN"
        isLocked={false}
        spaceVisibility="PRIVATE"
        spaceId="space_1"
        canShareSpaceInvite
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share link" }));

    await waitFor(() => {
      expect(mocks.fetchPrivateSpaceInvite).toHaveBeenCalledWith("space_1");
    });

    fireEvent.click(screen.getByLabelText("Include space invite"));
    fireEvent.click(screen.getByRole("button", { name: "Copy full link" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/sessions/join?code=ABCD1234&spaceInvite=SPACE1234`,
      );
    });
  });

  it("loads private-space invite once per modal open", async () => {
    mocks.fetchPrivateSpaceInvite.mockResolvedValue({
      code: "SPACE1234",
      expiresAt: "2026-03-17T10:00:00.000Z",
    });

    render(
      <ShareVoteButton
        joinCode="ABCD1234"
        creatorId="user_1"
        status="OPEN"
        isLocked={false}
        spaceVisibility="PRIVATE"
        spaceId="space_1"
        canShareSpaceInvite
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share link" }));

    await waitFor(() => {
      expect(mocks.fetchPrivateSpaceInvite).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));

    await waitFor(() => {
      expect(mocks.fetchPrivateSpaceInvite).toHaveBeenCalledTimes(2);
    });
  });

  it("fails closed when invite refresh fails after being previously loaded", async () => {
    mocks.fetchPrivateSpaceInvite
      .mockResolvedValueOnce({
        code: "SPACE1234",
        expiresAt: "2026-03-17T10:00:00.000Z",
      })
      .mockRejectedValueOnce(new Error("Network down"));

    render(
      <ShareVoteButton
        joinCode="ABCD1234"
        creatorId="user_1"
        status="OPEN"
        isLocked={false}
        spaceVisibility="PRIVATE"
        spaceId="space_1"
        canShareSpaceInvite
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    await waitFor(() => {
      expect(mocks.fetchPrivateSpaceInvite).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByLabelText("Include space invite"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));

    await waitFor(() => {
      expect(mocks.fetchPrivateSpaceInvite).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByLabelText("Include space invite").getAttribute("disabled")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Copy full link" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/sessions/join?code=ABCD1234`,
      );
    });
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
