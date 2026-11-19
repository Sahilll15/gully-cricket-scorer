export const PHOTO_SIZE = 128;
/** A 128px JPEG is about 6 KB. This caps what a backup or an imported file can carry per player. */
export const MAX_PHOTO_CHARS = 40000;

/** Only small JPEG or PNG data URLs are kept. Anything else is dropped, so a stray string never reaches an img tag. */
export const validPhoto = (s: unknown): s is string =>
  typeof s === "string" && s.length <= MAX_PHOTO_CHARS && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(s);

/** The photo saved for a player, looked up like the rest of their details (lower-case name). */
export const photoOf = (infos: Record<string, { photo?: string } | undefined>, name: string): string | null => {
  const p = infos[name.trim().toLowerCase()]?.photo;
  return validPhoto(p) ? p : null;
};

/** Largest centred square of a w by h picture, scaled to `size`: where to cut and how big to draw. */
export function squareCrop(w: number, h: number, size = PHOTO_SIZE) {
  const side = Math.min(w, h);
  return { sx: (w - side) / 2, sy: (h - side) / 2, side, size };
}

/** Player details from a backup or the cloud with any photo that is not a small image data URL removed. */
export function cleanInfos<T extends { photo?: string }>(infos: Record<string, T> | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(infos ?? {})) {
    if (!v || typeof v !== "object") continue;
    out[k] = v.photo === undefined || validPhoto(v.photo) ? v : { ...v, photo: undefined };
  }
  return out;
}
