// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { VoteSettingsButton } from "@/components/sessions/VoteSettingsButton";

const mocks = vi.hoisted(() => ({
  apiPatch: vi.fn(),
  getErrorMessage: vi.fn((_error: unknown, fallback?: string) => fallback ?? "Request failed"),
}));

vi.mock("@/lib/api-client", () => ({
  apiPatch: mocks.apiPatch,
  getErrorMessage: mocks.getErrorMessage,
}));

describe("VoteSettingsButton", () => {
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
    mocks.apiPatch.mockReset();
    mocks.getErrorMessage.mockClear();
  });

  it("shows a disabled visibility toggle for space votes", () => {
    render(
      <VoteSettingsButton
        sessionId="session_1"
        initialNickname="Host"
        initialIsPrivate
        canManageSession
        isSpaceSession
        onNicknameChange={vi.fn()}
        onPrivacyChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ranking settings/i }));

    const privateOption = screen.getByRole("radio", { name: "Private" });
    const publicOption = screen.getByRole("radio", { name: "Public" });
    expect(privateOption.getAttribute("disabled")).not.toBeNull();
    expect(publicOption.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByText("Show in public Rankings list")).toBeTruthy();
    expect(
      screen.getByText("Visibility for space rankings is managed in Space Settings."),
    ).toBeTruthy();
  });

  it("keeps the visibility toggle enabled for regular votes", () => {
    render(
      <VoteSettingsButton
        sessionId="session_1"
        initialNickname="Host"
        initialIsPrivate
        canManageSession
        isSpaceSession={false}
        onNicknameChange={vi.fn()}
        onPrivacyChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /open ranking settings/i }));

    const privateOption = screen.getByRole("radio", { name: "Private" });
    const publicOption = screen.getByRole("radio", { name: "Public" });
    expect(privateOption.getAttribute("disabled")).toBeNull();
    expect(publicOption.getAttribute("disabled")).toBeNull();
    expect(
      screen.getByText("Off by default. People can still join private rankings with the code."),
    ).toBeTruthy();
  });
});
