import { squareCrop, PHOTO_SIZE, validPhoto } from "./photo";

/** Opens the picker, then returns the chosen picture cropped to a small square JPEG, or null if cancelled or unreadable. */
export function pickPhoto(): Promise<string | null> {
  return new Promise((done) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return done(null);
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const c = squareCrop(img.naturalWidth, img.naturalHeight), cv = document.createElement("canvas");
        cv.width = cv.height = PHOTO_SIZE;
        cv.getContext("2d")?.drawImage(img, c.sx, c.sy, c.side, c.side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
        URL.revokeObjectURL(url);
        const out = cv.toDataURL("image/jpeg", 0.8);
        done(validPhoto(out) ? out : null);
      };
      img.onerror = () => { URL.revokeObjectURL(url); done(null); };
      img.src = url;
    };
    input.oncancel = () => done(null);
    input.click();
  });
}
