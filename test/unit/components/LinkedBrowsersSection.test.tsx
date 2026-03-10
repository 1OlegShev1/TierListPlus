// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LinkedBrowsersSection } from "@/components/dashboard/LinkedBrowsersSection";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: mocks.apiFetch,
  apiPatch: mocks.apiPatch,
  apiDelete: mocks.apiDelete,
  getErrorMessage: mocks.getErrorMessage,
}));

describe("LinkedBrowsersSection", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiPatch.mockReset();
    mocks.apiDelete.mockReset();
    mocks.getErrorMessage.mockClear();
  });

  it("loads devices and syncs active link code to parent", async () => {
    const onActiveLinkCodeChange = vi.fn();
    mocks.apiFetch.mockResolvedValue({
      currentDeviceId: "device_1",
      devices: [
        {
          id: "device_1",
          displayName: "This Browser",
          createdAt: "2026-03-10T10:00:00.000Z",
          lastSeenAt: "2026-03-10T11:00:00.000Z",
          revokedAt: null,
          isCurrent: true,
        },
        {
          id: "device_2",
          displayName: "Phone Safari",
          createdAt: "2026-03-10T10:00:00.000Z",
          lastSeenAt: "2026-03-10T11:00:00.000Z",
          revokedAt: null,
          isCurrent: false,
        },
      ],
      activeLinkCode: { linkCode: "ABCD-1234", expiresAt: "2026-03-10T12:00:00.000Z" },
    });

    render(
      <LinkedBrowsersSection
        userId="user_1"
        userLoading={false}
        onActiveLinkCodeChange={onActiveLinkCodeChange}
      />,
    );

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith("/api/users/devices");
    });
    expect(onActiveLinkCodeChange).toHaveBeenCalledWith({
      linkCode: "ABCD-1234",
      expiresAt: "2026-03-10T12:00:00.000Z",
    });

    fireEvent.click(screen.getByRole("button", { name: /linked browsers & access/i }));
    expect(await screen.findByText("Phone Safari")).toBeTruthy();
  });

  it("does not fetch when user is missing and clears parent link code", async () => {
    const onActiveLinkCodeChange = vi.fn();

    render(
      <LinkedBrowsersSection
        userId={null}
        userLoading={false}
        onActiveLinkCodeChange={onActiveLinkCodeChange}
      />,
    );

    await waitFor(() => {
      expect(onActiveLinkCodeChange).toHaveBeenCalledWith(null);
    });
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("ignores repeated rename submits while rename is in flight", async () => {
    const onActiveLinkCodeChange = vi.fn();
    mocks.apiFetch.mockResolvedValue({
      currentDeviceId: "device_1",
      devices: [
        {
          id: "device_2",
          displayName: "Old Phone",
          createdAt: "2026-03-10T10:00:00.000Z",
          lastSeenAt: "2026-03-10T11:00:00.000Z",
          revokedAt: null,
          isCurrent: false,
        },
      ],
      activeLinkCode: null,
    });

    let resolveRename: ((value: { id: string; displayName: string }) => void) | undefined;
    mocks.apiPatch.mockReturnValue(
      new Promise((resolve) => {
        resolveRename = resolve;
      }),
    );

    render(
      <LinkedBrowsersSection
        userId="user_1"
        userLoading={false}
        onActiveLinkCodeChange={onActiveLinkCodeChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /linked browsers & access/i }));
    await screen.findByText("Old Phone");

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByDisplayValue("Old Phone");
    fireEvent.change(input, { target: { value: "Renamed Phone" } });

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mocks.apiPatch).toHaveBeenCalledTimes(1);
    expect(mocks.apiPatch).toHaveBeenCalledWith("/api/users/devices/device_2", {
      displayName: "Renamed Phone",
    });

    if (!resolveRename) throw new Error("Expected rename request to start");
    const resolveRenameRequest = resolveRename;
    await act(async () => {
      resolveRenameRequest({ id: "device_2", displayName: "Renamed Phone" });
      await Promise.resolve();
    });

    expect(await screen.findByText("Renamed Phone")).toBeTruthy();
  });
});
