import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { merge, type Backup } from "./backup";
import { useStore } from "./store";

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
const loginFor = (phone: string) => `${phone}@phone.gully-scorer.app`;
const phoneOf = (email?: string) => email?.split("@")[0] ?? null;

type Sync = "idle" | "saving" | "saved" | "error";
interface Account { phone: string | null; sync: Sync; savedAt: number | null }
export const useAccount = create<Account>(() => ({ phone: null, sync: "idle", savedAt: null }));

const snapshot = (): Backup => { const s = useStore.getState(); return { v: 1, matches: s.matches, teams: s.teams, cups: s.cups }; };

async function pull(): Promise<Backup | null> {
  const { data, error } = await db().from("gully_backups").select("data").maybeSingle();
  if (error) throw error;
  return (data?.data as Backup | undefined) ?? null;
}

async function push() {
  if (!uid || !merged) return;
  useAccount.setState({ sync: "saving" });
  const { error } = await db().from("gully_backups").upsert({ user_id: uid, data: snapshot(), updated_at: new Date().toISOString() });
  useAccount.setState(error ? { sync: "error" } : { sync: "saved", savedAt: Date.now() });
}

/** Pulls the account's copy, merges it into this phone, and saves the result back. */
async function syncNow() {
  const both = merge(snapshot(), await pull());
  useStore.setState({ matches: both.matches, teams: both.teams, cups: both.cups });
  merged = true;
  await push();
}

function startSession(id: string, phone: string) {
  uid = id;
  useAccount.setState({ phone });
  return syncNow().catch(() => useAccount.setState({ sync: "error" }));
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

export const retrySync = () => { if (uid) void (merged ? push() : syncNow().catch(() => useAccount.setState({ sync: "error" }))); };

/** Restores the session on load and saves a few seconds after every change while signed in. */
export function startAccountSync() {
  if (!accountsSupported) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  void db().auth.getSession().then(({ data }) => {
    const phone = phoneOf(data.session?.user.email);
    if (data.session && phone) void startSession(data.session.user.id, phone);
  });
  const unsub = useStore.subscribe((s, prev) => {
    if (!uid || (s.matches === prev.matches && s.teams === prev.teams && s.cups === prev.cups)) return;
    clearTimeout(timer);
    timer = setTimeout(() => void push(), 3000);
  });
  return () => { clearTimeout(timer); unsub(); };
}
