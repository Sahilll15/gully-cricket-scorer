import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { fingerprint, newKeyJwk, sign, verify, type Jwk } from "./livecrypto";

const subtle = webcrypto.subtle, ALG = { name: "ECDSA", namedCurve: "P-256" }, SIGN = { name: "ECDSA", hash: "SHA-256" };
const enc = (s: string) => new TextEncoder().encode(s);
const b64 = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64");

describe("live signing matches the web app's WebCrypto", () => {
  it("web verifies an app signature", async () => {
    const key = newKeyJwk(), body = JSON.stringify({ match: { id: "m1" }, at: 1 });
    const pub = await subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: key.x, y: key.y }, ALG, false, ["verify"]);
    expect(await subtle.verify(SIGN, pub, Buffer.from(sign(key, body), "base64"), enc(body))).toBe(true);
  });
  it("app verifies a web signature and imports a web key", async () => {
    for (let i = 0; i < 20; i++) {
      const pair = await subtle.generateKey(ALG, true, ["sign", "verify"]);
      const jwk = (await subtle.exportKey("jwk", pair.privateKey)) as Jwk, body = `ball ${i}`;
      const sig = b64(await subtle.sign(SIGN, pair.privateKey, enc(body)));
      expect(verify(jwk, sig, body)).toBe(true);
      expect(verify(jwk, sig, body + "x")).toBe(false);
      expect(verify(jwk, b64(await subtle.sign(SIGN, pair.privateKey, enc(body)))!, body)).toBe(true);
      expect(verify(jwk, sign(jwk, body), body)).toBe(true);
    }
  });
  it("fingerprint matches the web formula", async () => {
    const key = newKeyJwk();
    const h = Buffer.from(await subtle.digest("SHA-256", enc(`${key.x}.${key.y}`))).toString("base64");
    expect(fingerprint(key.x, key.y)).toBe(h.replace(/\+/g, "-").replace(/\//g, "_").slice(0, 16));
  });
});
