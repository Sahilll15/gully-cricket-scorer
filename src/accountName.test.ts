import { describe, expect, it } from "vitest";
import { googleError, loginFor, phoneOf, pillLabel, whoIs } from "./accountName";

describe("phone logins", () => {
  it.each([["9876543210"], ["+447700900123"]])("%s round-trips through its login address", (phone) =>
    expect(phoneOf(loginFor(phone))).toBe(phone));

  it("keeps the old login addresses", () => {
    expect(loginFor("9876543210")).toBe("9876543210@phone.gully-scorer.app");
    expect(loginFor("+447700900123")).toBe("intl447700900123@phone.gully-scorer.app");
  });

  it("is not fooled by a real email", () => {
    expect(phoneOf("sahil@gmail.com")).toBeNull();
    expect(phoneOf("intl99@gmail.com")).toBeNull();
    expect(phoneOf(undefined)).toBeNull();
  });
});

describe("who is signed in", () => {
  it("reads a phone login as a phone", () =>
    expect(whoIs({ email: "9876543210@phone.gully-scorer.app", user_metadata: {} })).toEqual({ phone: "9876543210", google: null }));

  it("prefers the Google full name", () =>
    expect(whoIs({ email: "s@gmail.com", user_metadata: { full_name: " Sahil Chalke ", name: "Other" } }))
      .toEqual({ phone: null, google: { name: "Sahil Chalke", email: "s@gmail.com" } }));

  it("falls back to name, then given and family name, then email", () => {
    expect(whoIs({ email: "s@gmail.com", user_metadata: { name: "Sahil" } })?.google?.name).toBe("Sahil");
    expect(whoIs({ email: "s@gmail.com", user_metadata: { given_name: "Sahil", family_name: "C" } })?.google?.name).toBe("Sahil C");
    expect(whoIs({ email: "s@gmail.com", user_metadata: { full_name: "  ", picture: "x" } })?.google?.name).toBe("s@gmail.com");
  });

  it("uses the email from metadata when the user has none", () =>
    expect(whoIs({ email: "", user_metadata: { email: "m@gmail.com" } })).toEqual({ phone: null, google: { name: "m@gmail.com", email: "m@gmail.com" } }));

  it("is nobody without a session or anything to show", () => {
    expect(whoIs(null)).toBeNull();
    expect(whoIs({ email: null, user_metadata: { full_name: 42 } })).toBeNull();
  });
});

describe("account pill", () => {
  it("masks a phone the way it always has", () => expect(pillLabel({ phone: "9876543210", google: null })).toBe("98•••210"));
  it("shows a Google first name", () => expect(pillLabel({ phone: null, google: { name: "Sahil Chalke", email: "s@gmail.com" } })).toBe("Sahil"));
  it("clips a long name or email", () => {
    expect(pillLabel({ phone: null, google: { name: "Bartholomewsworth Smith", email: null } })).toBe("Bartholomewsw…");
    expect(pillLabel({ phone: null, google: { name: "averylongemail@gmail.com", email: "averylongemail@gmail.com" } })).toBe("averylongemai…");
  });
});

describe("google sign-in errors", () => {
  it("says when the phone is offline", () => expect(googleError("Network request failed")).toMatch(/No internet/));
  it("says when there were too many tries", () => expect(googleError("Request rate limit reached")).toMatch(/Too many tries/));
  it("gives one plain line otherwise", () => expect(googleError("")).toBe("Google sign-in didn't work. Try again, or use your phone number."));
});
