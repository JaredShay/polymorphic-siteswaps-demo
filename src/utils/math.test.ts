import { describe, it, expect } from "vitest";
import { gcd, lcm } from "./math";

describe("gcd", () => {
  it("gcd(12, 8) = 4", () => expect(gcd(12, 8)).toBe(4));
  it("gcd(7, 3) = 1 (co-prime)", () => expect(gcd(7, 3)).toBe(1));
  it("gcd(6, 6) = 6", () => expect(gcd(6, 6)).toBe(6));
});

describe("lcm", () => {
  it("lcm(4, 6) = 12", () => expect(lcm(4, 6)).toBe(12));
  it("lcm(3, 4) = 12", () => expect(lcm(3, 4)).toBe(12));
  it("lcm(6, 6) = 6 (equal)", () => expect(lcm(6, 6)).toBe(6));
  it("lcm(2, 8) = 8 (one divides other)", () => expect(lcm(2, 8)).toBe(8));
  it("lcm(3, 5) = 15 (co-prime)", () => expect(lcm(3, 5)).toBe(15));
});
