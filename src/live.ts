import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { Match } from "./engine/types";

// Live sharing rides on Supabase Realtime broadcast: no table, the scorer's phone is the source of truth.
// Anyone with the code can join the channel, so every update is signed and viewers pin the first key they see.
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const liveSupported = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
const db = () => (client ??= createClient(URL!, KEY!, { auth: { persistSession: false } }));
const channelName = (code: string) => `gully:${code.toUpperCase()}`;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
export const watchLink = (code: string, fp?: string) => `${location.origin}${import.meta.env.BASE_URL}?watch=${code}${fp ? `&k=${fp}` : ""}`;

const ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN = { name: "ECDSA", hash: "SHA-256" } as const;
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Short hash of a public key; it rides in the share link so link viewers trust only that scorer. */
export async function fingerprint(x?: string, y?: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${x}.${y}`)));
  return b64(h.buffer).replace(/\+/g, "-").replace(/\//g, "_").slice(0, 16);
}

/** Private signing key for a shared match, kept only in the scorer's own copy of the match. */
export async function newLiveKey(): Promise<{ liveKey: JsonWebKey; liveFp: string }> {
  const pair = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
  const liveKey = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { liveKey, liveFp: await fingerprint(liveKey.x, liveKey.y) };
}

export interface LiveState { match: Match; at: number }
interface Wire { body: string; pub: JsonWebKey; sig: string }

/** Scorer side: answers every viewer's hello with the current match, and pushes on each change. */
export function publish(code: string, current: () => Match | undefined) {
  const ch: RealtimeChannel = db().channel(channelName(code), { config: { broadcast: { self: false, ack: false } } });
  let signer: Promise<CryptoKey> | null = null;
  const send = async () => {
    const m = current();
    if (!m?.liveKey) return;
    signer ??= crypto.subtle.importKey("jwk", m.liveKey, ALG, false, ["sign"]);
    const { liveKey, liveFp: _fp, ...match } = m;
    const body = JSON.stringify({ match, at: Date.now() } satisfies LiveState);
    const sig = b64(await crypto.subtle.sign(SIGN, await signer, new TextEncoder().encode(body)));
    const pub: JsonWebKey = { kty: liveKey.kty, crv: liveKey.crv, x: liveKey.x, y: liveKey.y };
    void ch.send({ type: "broadcast", event: "state", payload: { body, pub, sig } satisfies Wire });
  };
  ch.on("broadcast", { event: "hello" }, () => void send()).subscribe((s) => { if (s === "SUBSCRIBED") void send(); });
  const beat = setInterval(() => void send(), 15000);
  return { push: () => void send(), stop: () => { clearInterval(beat); void db().removeChannel(ch); } };
}

function looksLikeMatch(x: unknown): x is LiveState {
  const s = x as LiveState;
  return !!s && typeof s.at === "number" && !!s.match && Array.isArray(s.match.teams) && s.match.teams.length === 2
    && Array.isArray(s.match.innings) && typeof s.match.rules === "object" && typeof s.match.status === "string";
}

/** Viewer side: follows updates signed by the key in the link, or by the first valid key when joined by code alone. */
export function watch(code: string, fp: string | null, onState: (s: LiveState) => void, onStatus: (s: string) => void) {
  const ch = db().channel(channelName(code), { config: { broadcast: { self: false } } });
  let pinned: string | null = null;
  let last = 0;
  const hello = () => { if (!pinned) void ch.send({ type: "broadcast", event: "hello", payload: {} }); };
  const receive = async (w: Wire) => {
    try {
      const id = `${w.pub.x}.${w.pub.y}`;
      if (pinned && id !== pinned) return;
      if (fp && (await fingerprint(w.pub.x, w.pub.y)) !== fp) return;
      const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: w.pub.x, y: w.pub.y }, ALG, false, ["verify"]);
      if (!(await crypto.subtle.verify(SIGN, key, unb64(w.sig), new TextEncoder().encode(w.body)))) return;
      const state: unknown = JSON.parse(w.body);
      if (!looksLikeMatch(state) || state.at < last) return;
      pinned ??= id;
      last = state.at;
      onState(state);
    } catch { /* malformed message: ignore */ }
  };
  ch.on("broadcast", { event: "state" }, ({ payload }) => void receive(payload as Wire))
    .subscribe((s) => { onStatus(s); if (s === "SUBSCRIBED") hello(); });
  const retry = setInterval(hello, 4000);
  return () => { clearInterval(retry); void db().removeChannel(ch); };
}
