import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { Match } from "@shared/engine/types";
import { SUPABASE_KEY, SUPABASE_URL, WEB_BASE } from "./env";
import { fingerprint as fp, newKeyJwk, sign, verify, type Jwk } from "./livecrypto";

// Live sharing rides on Supabase Realtime broadcast: no table, the scorer's phone is the source of truth.
// Anyone with the code can join the channel, so every update is signed and viewers pin the first key they see.
export const liveSupported = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;
const db = () => (client ??= createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false } }));
const channelName = (code: string) => `gully:${code.toUpperCase()}`;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
// Links open the web app, so a friend without the app can still watch or take over scoring.
export const watchLink = (code: string, f?: string) => `${WEB_BASE}?watch=${code}${f ? `&k=${f}` : ""}`;
export const scoreLink = (code: string, key: JsonWebKey, token: string) => `${WEB_BASE}?score=${code}#k=${key.d}.${key.x}.${key.y}&h=${token}`;
export const parseMoveToken = (hash: string) => /[#&]h=([A-Z0-9]{12})/.exec(hash)?.[1] ?? null;
export const newMoveToken = () => newCode() + newCode();
export function parseScoreKey(hash: string): JsonWebKey | null {
  const k = /k=([\w-]{40,48})\.([\w-]{40,48})\.([\w-]{40,48})/.exec(hash);
  return k ? { kty: "EC", crv: "P-256", d: k[1], x: k[2], y: k[3], ext: true, key_ops: ["sign"] } : null;
}

export const fingerprint = async (x?: string, y?: string) => fp(x, y);

/** Private signing key for a shared match, kept only in the scorer's own copy of the match. */
export async function newLiveKey(): Promise<{ liveKey: JsonWebKey; liveFp: string }> {
  const liveKey = newKeyJwk() as JsonWebKey;
  return { liveKey, liveFp: fp(liveKey.x, liveKey.y) };
}

export interface LiveState { match: Match; at: number }
interface Wire { body: string; pub: JsonWebKey; sig: string }

/** Scorer side: answers every viewer's hello with the current match, and pushes on each change. */
export function publish(code: string, current: () => Match | undefined, onRemote?: (m: Match) => void) {
  const ch: RealtimeChannel = db().channel(channelName(code), { config: { broadcast: { self: false, ack: false } } });
  const send = () => {
    const m = current();
    if (!m?.liveKey) return;
    const { liveKey, liveFp: _fp, ...match } = m;
    const body = JSON.stringify({ match, at: Date.now() } satisfies LiveState);
    const pub: JsonWebKey = { kty: liveKey.kty, crv: liveKey.crv, x: liveKey.x, y: liveKey.y };
    void ch.send({ type: "broadcast", event: "state", payload: { body, pub, sig: sign(liveKey as Jwk, body) } satisfies Wire });
  };
  // Another phone holding the same key scored a ball: take its copy when it's newer.
  const take = (w: Wire) => {
    const m = current();
    if (!onRemote || !m?.liveKey || w.pub.x !== m.liveKey.x || w.pub.y !== m.liveKey.y) return;
    const state = verified(w);
    if (state && (state.match.editedAt ?? 0) > (m.editedAt ?? 0)) onRemote(state.match);
  };
  ch.on("broadcast", { event: "hello" }, () => send())
    .on("broadcast", { event: "state" }, ({ payload }) => take(payload as Wire))
    .subscribe((s) => { if (s === "SUBSCRIBED") send(); });
  const beat = setInterval(send, 15000);
  return { push: send, stop: () => { clearInterval(beat); void db().removeChannel(ch); } };
}

function looksLikeMatch(x: unknown): x is LiveState {
  const s = x as LiveState;
  return !!s && typeof s.at === "number" && !!s.match && Array.isArray(s.match.teams) && s.match.teams.length === 2
    && Array.isArray(s.match.innings) && typeof s.match.rules === "object" && typeof s.match.status === "string";
}

function verified(w: Wire): LiveState | null {
  try {
    if (!verify(w.pub as Jwk, w.sig, w.body)) return null;
    const state: unknown = JSON.parse(w.body);
    return looksLikeMatch(state) ? state : null;
  } catch { return null; }
}

/** Viewer side: follows updates signed by the key in the link, or by the first valid key when joined by code alone. */
export function watch(code: string, f: string | null, onState: (s: LiveState) => void, onStatus: (s: string) => void) {
  const ch = db().channel(channelName(code), { config: { broadcast: { self: false } } });
  let pinned: string | null = null;
  let last = 0;
  const hello = () => { if (!pinned) void ch.send({ type: "broadcast", event: "hello", payload: {} }); };
  const receive = (w: Wire) => {
    try {
      const id = `${w.pub.x}.${w.pub.y}`;
      if (pinned && id !== pinned) return;
      if (f && fp(w.pub.x, w.pub.y) !== f) return;
      const state = verified(w);
      // Two phones may score this match, so order by the last edit, not by who sent last.
      const rev = state ? state.match.editedAt ?? state.at : 0;
      if (!state || rev < last) return;
      pinned ??= id;
      last = rev;
      onState(state);
    } catch { /* malformed message: ignore */ }
  };
  ch.on("broadcast", { event: "state" }, ({ payload }) => receive(payload as Wire))
    .subscribe((s) => { onStatus(s); if (s === "SUBSCRIBED") hello(); });
  const retry = setInterval(hello, 4000);
  return () => { clearInterval(retry); void db().removeChannel(ch); };
}
