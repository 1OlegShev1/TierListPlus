// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpaceInvitePanel } from "@/components/spaces/SpaceInvitePanel";

const mocks = vi.hoisted(() => ({
  fetchPrivateSpaceInvite: vi.fn(),
  rotatePrivateSpaceInvite: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
  toDataURL: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getErrorMessage: mocks.getErrorMessage,
}));

vi.mock("@/lib/space-invite-client", () => ({
  fetchPrivateSpaceInvite: mocks.fetchPrivateSpaceInvite,
  rotatePrivateSpaceInvite: mocks.rotatePrivateSpaceInvite,
}));

vi.mock("qrcode", () => ({
  toDataURL: mocks.toDataURL,
}));

describe("SpaceInvitePanel", () => {
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
    mocks.fetchPrivateSpaceInvite.mockReset().mockResolvedValue({
      code: "ABCD1234",
      expiresAt: "2026-03-20T00:00:00.000Z",
    });
    mocks.rotatePrivateSpaceInvite.mockReset().mockResolvedValue({
      code: "ZXCV9999",
      expiresAt: "2026-03-21T00:00:00.000Z",
    });
    mocks.toDataURL.mockReset().mockResolvedValue("data:image/png;base64,abc");
    mocks.getErrorMessage.mockClear();

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it("shares invite code and full link from modal", async () => {
    render(<SpaceInvitePanel spaceId="space_1" />);

    await screen.findByRole("button", { name: "Rotate code" });

    fireEvent.click(screen.getByRole("button", { name: "Share invite" }));

    await waitFor(() => {
      expect(mocks.toDataURL).toHaveBeenCalledWith(
        `${window.location.origin}/spaces?joinCode=ABCD1234`,
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
        `${window.location.origin}/spaces?joinCode=ABCD1234`,
      );
    });
  });

  it("rotates invite code", async () => {
    render(<SpaceInvitePanel spaceId="space_1" />);

    await screen.findByRole("button", { name: "Rotate code" });
    fireEvent.click(screen.getByRole("button", { name: "Rotate code" }));

    await waitFor(() => {
      expect(mocks.rotatePrivateSpaceInvite).toHaveBeenCalledWith("space_1");
    });
    const codeNodes = await screen.findAllByText("ZXCV9999");
    expect(codeNodes.length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Invite rotated\. People can join this space until .* Previous invite links were revoked\./,
      ),
    ).toBeTruthy();
  });
});
