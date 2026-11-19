import { describe, expect, it } from "vitest";
import { tipLink } from "./upi";

describe("tipLink", () => {
  it("builds a UPI link with no amount, so the payer chooses", () => {
    const l = tipLink(" Sahil@OkAxis ", "Sahil Chalke")!;
    expect(l.startsWith("upi://pay?pa=sahil@okaxis&pn=Sahil%20Chalke")).toBe(true);
    expect(l).not.toContain("am=");
  });
  it("is null when no valid id is configured", () => {
    expect(tipLink(undefined, "x")).toBeNull();
    expect(tipLink("not an id", "x")).toBeNull();
  });
});
