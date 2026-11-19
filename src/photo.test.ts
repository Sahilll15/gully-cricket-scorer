import { describe, expect, it } from "vitest";
import { MAX_PHOTO_CHARS, photoOf, squareCrop, validPhoto } from "./photo";

const ok = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

describe("photo", () => {
  it("accepts a small image data URL only", () => {
    expect(validPhoto(ok)).toBe(true);
    expect(validPhoto("https://x.test/a.jpg")).toBe(false);
    expect(validPhoto("data:text/html;base64,PGI+")).toBe(false);
    expect(validPhoto(`data:image/jpeg;base64,${"A".repeat(MAX_PHOTO_CHARS)}`)).toBe(false);
    expect(validPhoto(null)).toBe(false);
  });
  it("finds a photo by lower-case name and ignores a bad one", () => {
    expect(photoOf({ ravi: { photo: ok } }, " Ravi ")).toBe(ok);
    expect(photoOf({ ravi: { photo: "javascript:alert(1)" } }, "Ravi")).toBeNull();
    expect(photoOf({}, "Sam")).toBeNull();
  });
  it("crops the centre square of a wide or tall picture", () => {
    expect(squareCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200, size: 128 });
    expect(squareCrop(200, 400)).toEqual({ sx: 0, sy: 100, side: 200, size: 128 });
  });
});
