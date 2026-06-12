import { describe, it, expect } from "vitest";
import { orgCode } from "./orgCode.js";

describe("orgCode", () => {
  it("returns exactly 5 characters", () => {
    expect(orgCode("Euro Rastpark Eichenzell")).toHaveLength(5);
  });

  it("is deterministic — same name always yields same code", () => {
    const a = orgCode("Meine Tankstelle");
    const b = orgCode("Meine Tankstelle");
    expect(a).toBe(b);
  });

  it("different names yield different codes (high probability)", () => {
    expect(orgCode("Alpha GmbH")).not.toBe(orgCode("Beta GmbH"));
  });

  it("only uses alphabet chars (no 0/O/1/I/L)", () => {
    const AB = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    for (const name of ["foo", "bar", "test", "Ö-Werk 24/7"]) {
      for (const ch of orgCode(name)) {
        expect(AB.includes(ch)).toBe(true);
      }
    }
  });

  it("handles German umlauts without crashing", () => {
    expect(() => orgCode("Öl & Güter GmbH")).not.toThrow();
  });

  it("handles empty string with a fallback", () => {
    expect(orgCode("")).toHaveLength(5);
    expect(orgCode("   ")).toHaveLength(5);
  });
});
