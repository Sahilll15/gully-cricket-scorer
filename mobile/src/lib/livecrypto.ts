import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";

// Same ECDSA P-256 / SHA-256 wire format as the web app's WebCrypto, so app and browser phones trust each other.
export interface Jwk { kty?: string; crv?: string; d?: string; x?: string; y?: string; ext?: boolean; key_ops?: string[] }

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function b64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
  }
  return s;
}
export function unb64(s: string) {
  const clean = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0, acc = 0, k = 0;
  for (const c of clean) {
    acc = (acc << 6) | B64.indexOf(c); bits += 6;
    if (bits >= 8) { bits -= 8; out[k++] = (acc >> bits) & 255; }
  }
  return out.slice(0, k);
}
const url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const utf8 = (s: string) => new TextEncoder().encode(s);

/** Short hash of a public key; it rides in the share link so link viewers trust only that scorer. */
export const fingerprint = (x?: string, y?: string) => b64(sha256(utf8(`${x}.${y}`))).replace(/\+/g, "-").replace(/\//g, "_").slice(0, 16);

export function newKeyJwk(): Jwk {
  const d = p256.utils.randomSecretKey(), pub = p256.getPublicKey(d, false);
  return { kty: "EC", crv: "P-256", d: url(d), x: url(pub.slice(1, 33)), y: url(pub.slice(33, 65)), ext: true, key_ops: ["sign"] };
}

/** Raw r||s signature, base64, exactly what crypto.subtle.sign returns for ECDSA. */
export const sign = (key: Jwk, body: string) => b64(p256.sign(utf8(body), unb64(key.d!), { prehash: true, lowS: false }));

export function verify(pub: Jwk, sig: string, body: string) {
  try {
    const point = new Uint8Array([4, ...unb64(pub.x!), ...unb64(pub.y!)]);
    return p256.verify(unb64(sig), utf8(body), point, { prehash: true, lowS: false });
  } catch { return false; }
}
