import crypto from "node:crypto";
import { generateRecoveryCode } from "@/lib/recovery-code";

describe("generateRecoveryCode", () => {
  it("uses cryptographic random indexes and skips duplicate words", () => {
    const randomValues = [0, 0, 1, 2, 10];
    const randomIntSpy = vi.spyOn(crypto, "randomInt").mockImplementation((() => {
      return randomValues.shift() ?? 0;
    }) as typeof crypto.randomInt);

    expect(generateRecoveryCode()).toBe("TIGER-MAPLE-RIVER-10");
    expect(randomIntSpy).toHaveBeenCalledWith(48);
    expect(randomIntSpy).toHaveBeenLastCalledWith(10, 100);
  });
});
