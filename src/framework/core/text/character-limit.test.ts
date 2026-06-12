// @vitest-environment node
import { describe, expect, it } from "vitest";
import { characterLimit } from "./character-limit";

describe("characterLimit — TextArea counter policy", () => {
  it("stays quiet far from the limit", () => {
    const s = characterLimit("hello", 100);
    expect(s).toMatchObject({ count: 5, remaining: 95, warn: false, overflow: false });
    expect(s.message).toBeNull();
  });

  it("enters the warning window at 10% of max (clamped to [5, 20])", () => {
    // max 100 → threshold 10
    expect(characterLimit("x".repeat(89), 100).warn).toBe(false);
    expect(characterLimit("x".repeat(90), 100).warn).toBe(true);
    // max 20 → threshold 5 (floor 10% = 2, clamped up)
    expect(characterLimit("x".repeat(15), 20).warn).toBe(true);
    expect(characterLimit("x".repeat(14), 20).warn).toBe(false);
    // max 1000 → threshold capped at 20
    expect(characterLimit("x".repeat(979), 1000).warn).toBe(false);
    expect(characterLimit("x".repeat(980), 1000).warn).toBe(true);
  });

  it("builds a pluralized SR message in the warning window", () => {
    expect(characterLimit("x".repeat(95), 100).message).toBe("5 caractères restants");
    expect(characterLimit("x".repeat(99), 100).message).toBe("1 caractère restant");
  });

  it("reports the overflow when past the limit", () => {
    const s = characterLimit("x".repeat(103), 100);
    expect(s.overflow).toBe(true);
    expect(s.message).toBe("Limite dépassée de 3 caractères");
    expect(characterLimit("x".repeat(101), 100).message).toBe("Limite dépassée de 1 caractère");
  });
});
