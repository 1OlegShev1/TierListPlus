// @vitest-environment jsdom

import {
  ensureUserIdentity,
  startFreshIdentity,
} from "@/lib/device-identity";

describe("device identity bootstrap", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not silently create a user when a remembered identity loses its cookie", async () => {
    localStorage.setItem(
      "tierlistplus_identity",
      JSON.stringify({ userId: "user_old", deviceId: "device_old" }),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "User identity required",
          code: "SESSION_COOKIE_MISSING",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureUserIdentity()).rejects.toMatchObject({
      name: "IdentityRecoveryRequiredError",
      code: "SESSION_COOKIE_MISSING",
      rememberedIdentity: { userId: "user_old", deviceId: "device_old" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/users/session", { cache: "no-store" });
  });

  it("creates an anonymous identity only when the browser has no remembered identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "User identity required",
            code: "SESSION_COOKIE_MISSING",
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ userId: "user_new", deviceId: "device_new" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureUserIdentity()).resolves.toEqual({
      userId: "user_new",
      deviceId: "device_new",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "FIRST_VISIT" }),
    });
    expect(JSON.parse(localStorage.getItem("tierlistplus_identity") ?? "null")).toEqual({
      userId: "user_new",
      deviceId: "device_new",
    });
  });

  it("requires an explicit action before replacing a remembered identity", async () => {
    localStorage.setItem(
      "tierlistplus_identity",
      JSON.stringify({ userId: "user_old", deviceId: "device_old" }),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ userId: "user_fresh", deviceId: "device_fresh" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(startFreshIdentity()).resolves.toEqual({
      userId: "user_fresh",
      deviceId: "device_fresh",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "EXPLICIT_FRESH_START" }),
    });
  });
});
