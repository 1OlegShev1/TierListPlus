import { takeRateLimitToken } from "@/lib/rate-limit";

describe("takeRateLimitToken", () => {
  it("allows requests until the limit is reached", () => {
    expect(
      takeRateLimitToken({
        key: "upload:test-1",
        maxRequests: 2,
        windowMs: 1_000,
        now: 1_000,
      }),
    ).toEqual({ allowed: true, retryAfterSeconds: 0 });

    expect(
      takeRateLimitToken({
        key: "upload:test-1",
        maxRequests: 2,
        windowMs: 1_000,
        now: 1_100,
      }),
    ).toEqual({ allowed: true, retryAfterSeconds: 0 });

    expect(
      takeRateLimitToken({
        key: "upload:test-1",
        maxRequests: 2,
        windowMs: 1_000,
        now: 1_200,
      }),
    ).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("resets once the window has passed", () => {
    takeRateLimitToken({
      key: "upload:test-2",
      maxRequests: 1,
      windowMs: 1_000,
      now: 1_000,
    });

    expect(
      takeRateLimitToken({
        key: "upload:test-2",
        maxRequests: 1,
        windowMs: 1_000,
        now: 2_001,
      }),
    ).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});
