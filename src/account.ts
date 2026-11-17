import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { emptyKitty, mergeBackup, type KittyBackup } from "./kitty";
import { useStore } from "./store";
import { track } from "./track";
import { EV } from "./events";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
// Off until the backup table exists and email confirmation is switched off in Supabase.
export const accountsSupported = Boolean(URL && KEY && import.meta.env.VITE_ACCOUNTS === "1");

let client: SupabaseClient | null = null;
const db = () => (client ??= createClient(URL!, KEY!, { auth: { persistSession: true, storageKey: "gully-auth" } }));
let uid: string | null = null;
// Stays false until the account's copy is merged in, so a fresh phone never overwrites the cloud.
let merged = false;

// The number is the login name only. No SMS is sent, so it maps to an address nobody receives mail at.
// Non-Indian numbers get an "intl" prefix so they can never collide with a 10-digit Indian login.
const loginFor = (phone: string) => `${phone.startsWith("+") ? `intl${phone.slice(1)}` : phone}@phone.gully-scorer.app`;
const phoneOf = (email?: string) => { const n = email?.split("@")[0]; return n?.startsWith("intl") ? `+${n.slice(4)}` : n ?? null; };

type Sync = "idle" | "saving" | "saved" | "error";
interface Account { phone: string | null; sync: Sync; savedAt: number | null }
export const useAccount = create<Account>(() => ({ phone: null, sync: "idle", savedAt: null }));

const snapshot = (): KittyBackup => { const s = useStore.getState(); return { v: 1, matches: s.matches, teams: s.teams, cups: s.cups, series: s.series, infos: s.infos, kitty: s.kitty }; };

async function pull(): Promise<KittyBackup | null> {
  const { data, error } = await db().from("gully_backups").select("data").maybeSingle();
  if (error) throw error;
  return (data?.data as KittyBackup | undefined) ?? null;
}

async function push() {
  if (!uid || !merged) return;
  const was = useAccount.getState().sync;
  useAccount.setState({ sync: "saving" });
  const { error } = await db().from("gully_backups").upsert({ user_id: uid, data: snapshot(), updated_at: new Date().toISOString() });
  useAccount.setState(error ? { sync: "error" } : { sync: "saved", savedAt: Date.now() });
  // Only when the outcome changes, or every ball scored would send one.
  if (was !== (error ? "error" : "saved")) track(EV.backup_sync, { result: error ? "error" : "ok" });
}

const syncFailed = () => {
  if (useAccount.getState().sync !== "error") track(EV.backup_sync, { result: "error" });
  useAccount.setState({ sync: "error" });
};

/** Pulls the account's copy, merges it into this phone, and saves the result back. */
async function syncNow() {
  // No await between the snapshot and setState, or changes made during the pull are lost.
  const cloud = await pull();
  const both = mergeBackup(snapshot(), cloud);
  useStore.setState({ matches: both.matches, teams: both.teams, cups: both.cups, series: both.series ?? [], infos: both.infos ?? {}, kitty: both.kitty ?? emptyKitty() });
  merged = true;
  await push();
}

function startSession(id: string, phone: string) {
  uid = id;
  useAccount.setState({ phone });
  return syncNow().catch(syncFailed);
}

export async function signIn(phone: string, passcode: string, isNew: boolean): Promise<string | null> {
  const auth = db().auth, email = loginFor(phone);
  const { data, error } = isNew ? await auth.signUp({ email, password: passcode }) : await auth.signInWithPassword({ email, password: passcode });
  if (error) {
    if (/already registered/i.test(error.message)) return "This number already has an account. Sign in instead.";
    if (/invalid login/i.test(error.message)) return "Number or passcode doesn't match.";
    if (/rate|too many/i.test(error.message)) return "Too many tries. Wait a minute and try again.";
    return "Couldn't reach the server. Check your internet.";
  }
  if (!data.session) return "Sign-up isn't open yet. Try again later.";
  await startSession(data.session.user.id, phone);
  return null;
}

export async function signOut() {
  await db().auth.signOut();
  uid = null; merged = false;
  useAccount.setState({ phone: null, sync: "idle", savedAt: null });
}

/** Deletes the login and its cloud backup for good. Matches on this phone stay. */
export async function deleteAccount(): Promise<string | null> {
  const { error } = await db().rpc("gully_delete_my_account");
  if (error) return "Couldn't delete the account. Check your internet and try again.";
  uid = null; merged = false;
  await db().auth.signOut({ scope: "local" }).catch(() => {});
  useAccount.setState({ phone: null, sync: "idle", savedAt: null });
  return null;
}

export const retrySync = () => { if (uid) void (merged ? push() : syncNow().catch(syncFailed)); };

/** Restores the session on load and saves a few seconds after every change while signed in. */
export function startAccountSync() {
  if (!accountsSupported) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  void db().auth.getSession().then(({ data }) => {
    const phone = phoneOf(data.session?.user.email);
    if (data.session && phone) void startSession(data.session.user.id, phone);
  });
  const unsub = useStore.subscribe((s, prev) => {
    if (!uid || (s.matches === prev.matches && s.teams === prev.teams && s.cups === prev.cups && s.series === prev.series && s.infos === prev.infos && s.kitty === prev.kitty)) return;
    clearTimeout(timer);
    timer = setTimeout(() => void push(), 3000);
  });
  return () => { clearTimeout(timer); unsub(); };
}
