// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { JoinVotePageClient } from "@/app/sessions/join/JoinVotePageClient";

const originalFetch = globalThis.fetch;

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useSearchParams: vi.fn(),
  useUser: vi.fn(),
  saveParticipant: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
  useSearchParams: () => mocks.useSearchParams(),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: mocks.useUser,
}));

vi.mock("@/hooks/useParticipant", () => ({
  saveParticipant: mocks.saveParticipant,
}));

describe("JoinVotePageClient", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.saveParticipant.mockReset();
    mocks.useSearchParams.mockReset().mockReturnValue(new URLSearchParams("code=join1"));
    mocks.useUser.mockReset().mockReturnValue({
      userId: "user_1",
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("prefills nickname when provided", () => {
    render(<JoinVotePageClient initialNickname="KnownNick" />);

    const nicknameInput = screen.getByPlaceholderText("e.g., Alex") as HTMLInputElement;
    expect(nicknameInput.value).toBe("KnownNick");
  });

  it("shows private-space guidance when join requires space membership", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Only members of this private space can join this vote",
        code: "SPACE_MEMBERSHIP_REQUIRED",
        spaceId: "space_1",
        spaceName: "Anime Club",
      }),
    } as Response);

    render(<JoinVotePageClient />);

    fireEvent.change(screen.getByPlaceholderText("e.g., Alex"), {
      target: { value: "Nick" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join Vote" }));

    await waitFor(() => {
      expect(
        screen.getByText('This vote lives in "Anime Club", and that space is private.'),
      ).toBeTruthy();
    });
    expect(screen.getByRole("link", { name: "Open spaces" }).getAttribute("href")).toBe("/spaces");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("joins private space with invite and continues into vote", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("code=join1&spaceInvite=SPACE1234"));

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "Only members of this private space can join this vote",
          code: "SPACE_MEMBERSHIP_REQUIRED",
          spaceId: "space_1",
          spaceName: "Anime Club",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ spaceId: "space_1", joined: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: "session_1",
          participantId: "participant_1",
          nickname: "Nick",
        }),
      } as Response);

    render(<JoinVotePageClient />);

    fireEvent.change(screen.getByPlaceholderText("e.g., Alex"), {
      target: { value: "Nick" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join Vote" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Join space and continue" })).toBeTruthy();
    });
    expect(screen.getByRole("link", { name: "Open spaces" }).getAttribute("href")).toBe(
      "/spaces?joinCode=SPACE1234&expectedSpaceId=space_1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Join space and continue" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenNthCalledWith(
        2,
        "/api/spaces/join",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ code: "SPACE1234", expectedSpaceId: "space_1" }),
        }),
      );
    });
    await waitFor(() => {
      expect(mocks.saveParticipant).toHaveBeenCalledWith("session_1", "participant_1", "Nick");
    });
    expect(mocks.push).toHaveBeenCalledWith("/sessions/session_1/vote");
  });

  it("joins private space and opens closed results when invite flow is enabled", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("code=join1&spaceInvite=SPACE1234"));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ spaceId: "space_1", joined: true }),
    } as Response);

    render(
      <JoinVotePageClient
        initialSession={{
          id: "session_closed",
          status: "CLOSED",
          spaceId: "space_1",
          spaceName: "Anime Club",
          spaceVisibility: "PRIVATE",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Join space and view results" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/spaces/join",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ code: "SPACE1234", expectedSpaceId: "space_1" }),
        }),
      );
    });
    expect(mocks.push).toHaveBeenCalledWith("/sessions/session_closed/results?code=JOIN1");
  });
});
