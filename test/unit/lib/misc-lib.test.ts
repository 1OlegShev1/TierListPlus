import { z } from "zod/v4";
import { pickParticipantSurvivor } from "@/lib/account-linking-helpers";
import {
  ApiError,
  forbidden,
  formatZodError,
  mapApiError,
  notFound,
  requireOwner,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { DEFAULT_TIER_CONFIG, deriveTierKeys } from "@/lib/constants";
import {
  canAccessTemplate,
  getTemplateVisibilityWhere,
  isTemplateOwner,
} from "@/lib/template-access";
import {
  addTemplateItemSchema,
  createSessionSchema,
  createSpaceSchema,
  joinSessionSchema,
  submitVotesSchema,
  tierConfigSchema,
  updateSessionSchema,
  updateSpaceSchema,
} from "@/lib/validators";
import { makeKnownRequestError, makeParticipant } from "../../helpers/mocks";

describe("template helpers and constants", () => {
  it("handles visibility and ownership checks", () => {
    expect(getTemplateVisibilityWhere(null)).toEqual({
      spaceId: null,
      isPublic: true,
      isHidden: false,
      isModeratedHidden: false,
    });
    expect(getTemplateVisibilityWhere("user_1")).toEqual({
      spaceId: null,
      isHidden: false,
      OR: [{ isPublic: true, isModeratedHidden: false }, { creatorId: "user_1" }],
    });
    expect(isTemplateOwner({ creatorId: "user_1" }, "user_1")).toBe(true);
    expect(canAccessTemplate({ creatorId: "user_2", isPublic: true }, null)).toBe(true);
    expect(canAccessTemplate({ creatorId: "user_1", isPublic: false }, "user_1")).toBe(true);
    expect(
      canAccessTemplate({ creatorId: "user_1", isPublic: true, isHidden: true }, "user_1"),
    ).toBe(false);
    expect(
      canAccessTemplate({ creatorId: "user_2", isPublic: true, isModeratedHidden: true }, null),
    ).toBe(false);
    expect(DEFAULT_TIER_CONFIG).toHaveLength(5);
  });

  it("derives unique sanitized keys", () => {
    expect(
      deriveTierKeys([
        { key: "", label: "S+", color: "#111111", sortOrder: 99 },
        { key: "", label: "S+", color: "#222222", sortOrder: 99 },
        { key: "", label: "!!!", color: "#333333", sortOrder: 99 },
      ]),
    ).toEqual([
      { key: "S", label: "S+", color: "#111111", sortOrder: 0 },
      { key: "S1", label: "S+", color: "#222222", sortOrder: 1 },
      { key: "T2", label: "!!!", color: "#333333", sortOrder: 2 },
    ]);
  });
});

describe("validators", () => {
  it("accepts valid payloads and rejects malformed ones", () => {
    expect(
      createSessionSchema.parse({
        templateId: "template_1",
        name: "Session",
        tierConfig: DEFAULT_TIER_CONFIG,
        nickname: "Host",
      }),
    ).toBeTruthy();
    expect(
      createSessionSchema.parse({
        name: "  Session with padding  ",
      }).name,
    ).toBe("Session with padding");
    expect(joinSessionSchema.safeParse({ joinCode: "", nickname: "Nick" }).success).toBe(false);
    expect(
      submitVotesSchema.safeParse({
        participantId: "p1",
        votes: [{ sessionItemId: "i1", tierKey: "S", rankInTier: -1 }],
      }).success,
    ).toBe(false);
    expect(
      tierConfigSchema.safeParse([{ key: "S", label: "S", color: "red", sortOrder: 0 }]).success,
    ).toBe(false);
    expect(updateSessionSchema.safeParse({ status: "BAD" }).success).toBe(false);
    expect(
      createSpaceSchema.safeParse({
        name: "Anime lovers",
        accentColor: "PINK",
        visibility: "OPEN",
      }).success,
    ).toBe(true);
    expect(
      updateSpaceSchema.safeParse({
        accentColor: "TEAL",
      }).success,
    ).toBe(true);
    expect(
      updateSpaceSchema.safeParse({
        accentColor: "VIOLET",
      }).success,
    ).toBe(false);
    expect(
      addTemplateItemSchema.safeParse({
        label: "From URL",
        sourceUrl: "https://example.com/article",
      }).success,
    ).toBe(true);
    expect(
      addTemplateItemSchema.safeParse({
        label: "Missing media",
      }).success,
    ).toBe(false);
  });
});

describe("api helpers", () => {
  it("formats zod errors and validates request bodies", async () => {
    const schema = z.object({ name: z.string().min(2), age: z.number().int() });
    const request = new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Oleg", age: 1 }),
    });

    await expect(validateBody(request, schema)).resolves.toEqual({ name: "Oleg", age: 1 });

    const badJson = new Request("https://example.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    await expect(validateBody(badJson, schema)).rejects.toMatchObject({
      status: 400,
      details: "Invalid JSON body",
    });

    const parsed = schema.safeParse({ name: "O", age: 1.5 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatZodError(parsed.error)).toContain("name:");
      expect(formatZodError(parsed.error)).toContain("age:");
    }
  });

  it("enforces ownership and maps handled errors", () => {
    expect(() => requireOwner("user_1", "user_1")).not.toThrow();
    expect(() => requireOwner("user_1", "user_2")).toThrow(ApiError);

    expect(mapApiError(new ApiError(403, "Nope"))).toEqual({
      status: 403,
      body: { error: "Nope" },
    });
    expect(mapApiError(makeKnownRequestError("P2002"))).toEqual({
      status: 409,
      body: { error: "A record with that value already exists" },
    });
    expect(mapApiError(makeKnownRequestError("P2025"))).toEqual({
      status: 404,
      body: { error: "Record not found" },
    });
    expect(mapApiError(makeKnownRequestError("P2003"))).toEqual({
      status: 400,
      body: { error: "Referenced record not found" },
    });
    expect(mapApiError(new Error("boom"))).toBeNull();
  });

  it("wraps handlers and maps structured, prisma, and unknown errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const success = withHandler(async () => Response.json({ ok: true }));
    const missing = withHandler(async () => {
      notFound("Missing");
    });
    const duplicate = withHandler(async () => {
      throw makeKnownRequestError("P2002");
    });
    const denied = withHandler(async () => {
      forbidden("Denied");
    });
    const boom = withHandler(async () => {
      throw new Error("boom");
    });

    await expect(
      success(new Request("https://example.test"), { params: Promise.resolve({}) }).then((res) =>
        res.json(),
      ),
    ).resolves.toEqual({ ok: true });

    let response = await missing(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Missing" });

    response = await duplicate(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "A record with that value already exists",
    });

    response = await denied(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Denied" });

    response = await boom(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe("account linking", () => {
  it("prefers submitted target participants, then oldest", () => {
    const participants = [
      makeParticipant({
        id: "p1",
        userId: "target",
        submittedAt: new Date("2026-03-01T00:00:00.000Z"),
      }),
      makeParticipant({
        id: "p2",
        userId: "target",
        createdAt: new Date("2026-03-03T00:00:00.000Z"),
      }),
      makeParticipant({
        id: "p3",
        userId: "other",
        createdAt: new Date("2026-03-04T00:00:00.000Z"),
      }),
    ];

    expect(pickParticipantSurvivor(participants, "target").id).toBe("p1");
    expect(pickParticipantSurvivor([participants[2]], "target").id).toBe("p3");
  });
});
