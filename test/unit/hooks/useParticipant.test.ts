// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { clearAllParticipants, saveParticipant, useParticipant } from "@/hooks/useParticipant";

const { getLocalUserId } = vi.hoisted(() => ({
  getLocalUserId: vi.fn(() => "user_1"),
}));

vi.mock("@/lib/device-identity", () => ({
  getLocalUserId,
}));

describe("useParticipant", () => {
  beforeEach(() => {
    localStorage.clear();
    getLocalUserId.mockReturnValue("user_1");
  });

  it("saves, reads, and clears participant data", () => {
    saveParticipant("session_1", "participant_1", "Oleg");

    const { result, rerender } = renderHook(({ sessionId }) => useParticipant(sessionId), {
      initialProps: { sessionId: "session_1" },
    });

    expect(result.current.participantId).toBe("participant_1");
    expect(result.current.nickname).toBe("Oleg");

    result.current.save("participant_2", "Nina");
    rerender({ sessionId: "session_1" });
    expect(result.current.participantId).toBe("participant_2");

    result.current.clear();
    rerender({ sessionId: "session_1" });
    expect(result.current.participantId).toBeNull();

    clearAllParticipants();
    expect(localStorage.getItem("tierlistplus_participants")).toBeNull();
  });

  it("falls back on invalid storage and migrates legacy payloads", () => {
    localStorage.setItem("tierlistplus_participants", "{");
    expect(renderHook(() => useParticipant("session_1")).result.current.participantId).toBeNull();

    localStorage.setItem(
      "tierlistplus_participants",
      JSON.stringify({
        session_1: {
          participantId: "legacy_participant",
          nickname: "Legacy",
        },
      }),
    );

    const { result } = renderHook(() => useParticipant("session_1"));
    expect(result.current.participantId).toBe("legacy_participant");
    expect(JSON.parse(localStorage.getItem("tierlistplus_participants") || "{}")).toEqual({
      user_1: {
        session_1: {
          participantId: "legacy_participant",
          nickname: "Legacy",
        },
      },
    });
  });

  it("no-ops when there is no local user id", () => {
    getLocalUserId.mockReturnValue(null);
    saveParticipant("session_1", "participant_1", "Oleg");
    expect(localStorage.getItem("tierlistplus_participants")).toBeNull();
  });
});
