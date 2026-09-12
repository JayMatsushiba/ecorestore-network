import { describe, expect, it } from "vitest";
import { hashIdentifier, scaleQuantity } from "../identifiers.js";

describe("hashIdentifier", () => {
  it("is deterministic for identical input", () => {
    expect(hashIdentifier("kootenay-riparian-restoration-partial")).toBe(
      hashIdentifier("kootenay-riparian-restoration-partial"),
    );
  });

  it("produces a 32-byte (66-char, 0x-prefixed) hex hash", () => {
    const hash = hashIdentifier("h3sim_deadbeef");
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("produces different hashes for different input", () => {
    expect(hashIdentifier("a")).not.toBe(hashIdentifier("b"));
  });

  it("rejects an empty identifier rather than hashing an empty string", () => {
    expect(() => hashIdentifier("")).toThrow();
  });
});

describe("scaleQuantity", () => {
  it("scales a decimal quantity to a fixed-point integer at the given precision", () => {
    expect(scaleQuantity(18.1815, 6)).toBe(18181500n);
    expect(scaleQuantity(1, 6)).toBe(1000000n);
    expect(scaleQuantity(0, 6)).toBe(0n);
  });

  it("absorbs floating-point noise from the scaling multiplication", () => {
    // 1.005 * 100 is a well-known IEEE-754 case that does not land exactly
    // on an integer (it evaluates to 100.49999999999999); Math.round inside
    // scaleQuantity must still resolve to a definite integer rather than
    // truncating or throwing on the fractional residue.
    expect(Number.isInteger(1.005 * 100)).toBe(false);
    expect(scaleQuantity(1.005, 2)).toBe(100n);
  });

  it("rejects negative quantities", () => {
    expect(() => scaleQuantity(-1, 6)).toThrow();
  });

  it("rejects non-finite quantities", () => {
    expect(() => scaleQuantity(Number.NaN, 6)).toThrow();
    expect(() => scaleQuantity(Number.POSITIVE_INFINITY, 6)).toThrow();
  });

  it("rejects an invalid decimals argument", () => {
    expect(() => scaleQuantity(1, -1)).toThrow();
    expect(() => scaleQuantity(1, 1.5)).toThrow();
  });

  it("is deterministic across repeated calls", () => {
    expect(scaleQuantity(21.39, 6)).toBe(scaleQuantity(21.39, 6));
  });
});
