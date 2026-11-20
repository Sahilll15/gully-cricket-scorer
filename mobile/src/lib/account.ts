import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyKitty, mergeBackup, type KittyBackup } from "@shared/kitty";
import { useStore } from "./store";
import { myStats, type GullyWorld } from "@shared/globalStats";
import { track } from "./track";
import { EV } from "@shared/events";
import { cleanInfos } from "@shared/photo";
import { googleError, loginFor, whoIs, type GoogleWho, type Who } from "@shared/accountName";
import { SUPABASE_KEY as KEY, SUPABASE_URL as URL } from "./env";
// Off until the backup table exists and email confirmation is switched off in Supabase.
export const accountsSupported = Boolean(URL && KEY && process.env.EXPO_PUBLIC_ACCOUNTS === "1");
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
// Off until the Google OAuth clients exist, so builds without the client id keep phone sign-in only.
export const googleSupported = accountsSupported && Boolean(GOOGLE_WEB_CLIENT_ID);

let client: SupabaseClient | null = null;
const db = () => (client ??= createClient(URL!, KEY!, { auth: { persistSession: true, storageKey: "gully-auth", storage: AsyncStorage, autoRefreshToken: true, detectSessionInUrl: false } }));
let uid: string | null = null;
// Stays false until the account's copy is merged in, so a fresh phone never overwrites the cloud.
let merged = false;


type Sync = "idle" | "saving" | "saved" | "error";
interface Account { phone: string | null; google: GoogleWho | null; sync: Sync; savedAt: number | null }
const signedOut: Account = { phone: null, google: null, sync: "idle", savedAt: null };
export const useAccount = create<Account>(() => signedOut);

const snapshot = (): KittyBackup => { const s = useStore.getState(); return { v: 1, matches: s.matches, teams: s.teams, cups: s.cups, series: s.series, infos: s.infos, groups: s.groups, kitty: s.kitty }; };

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
  // Plain totals for the world card; a failure here never affects the backup.
  if (!error) void db().from("gully_stats").upsert({ user_id: uid, ...myStats(useStore.getState().matches), updated_at: new Date().toISOString() });
  // Only when the outcome changes, or every ball scored would send one.
  if (was !== (error ? "error" : "saved")) track(EV.backup_sync, { result: error ? "error" : "ok" });
}

const syncFailed = () => {
  if (useAccount.getState().sync !== "error") track(EV.backup_sync, { result: "error" });
  useAccount.setState({ sync: "error" });
};

/** Pulls the account's copy, merges it into this phone, and saves the result back. */
async function syncNow() {
  // No await between the snapshot and setState, or balls scored during the pull are lost.
  const cloud = await pull();
  const both = mergeBackup(snapshot(), cloud);
  useStore.setState({ matches: both.matches, teams: both.teams, cups: both.cups, series: both.series ?? [], infos: cleanInfos(both.infos), groups: both.groups ?? [], kitty: both.kitty ?? emptyKitty() });
  merged = true;
  await push();
}

function startSession(id: string, who: Who) {
  uid = id;
  useAccount.setState({ phone: who.phone, google: who.google });
  return syncNow().catch(syncFailed);
}

export async function signIn(phone: string, passcode: string, isNew: boolean): Promise<string | null> {
  const auth = db().auth, email = loginFor(phone);
  const { data, error } = isNew ? await auth.signUp({ email, password: passcode }) : await auth.signInWithPassword({ email, password: passcode });
  if (error) {
    if (/already registered/i.test(error.message)) return "This number already has an account. Sign in instead.";
    if (/invalid login/i.test(error.message)) return "Number or passcode doesn't match.";
    if (/rate|too many/i.test(error.message)) return "Too many tries. Wait a minute and try again.";
    if (/at least|weak|short/i.test(error.message)) return "Pick a passcode of at least 6 characters.";
    if (/network|fetch|timeout/i.test(error.message)) return "No internet right now. Your matches are safe on this phone. Try again when you're online.";
    return "Something went wrong on our side. Try again in a minute.";
  }
  if (!data.session) return "Sign-up isn't open yet. Try again later.";
  await startSession(data.session.user.id, { phone, google: null });
  return null;
}

export type GoogleResult = { ok: true } | { ok: false; error: string | null };

// Loaded on tap, so a build without the native module still opens; the button is hidden there anyway.
const googleModule = () => import("@react-native-google-signin/google-signin");

/** Signs in with the Google account picker. A cancel comes back with no error to show. */
export async function signInWithGoogle(): Promise<GoogleResult> {
  let gs: Awaited<ReturnType<typeof googleModule>> | null = null;
  try {
    gs = await googleModule();
    gs.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    await gs.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await gs.GoogleSignin.signIn();
    if (!gs.isSuccessResponse(res)) return { ok: false, error: null };
    const token = res.data.idToken;
    if (!token) return { ok: false, error: googleError("") };
    const { data, error } = await db().auth.signInWithIdToken({ provider: "google", token });
    if (error) return { ok: false, error: googleError(error.message) };
    const who = whoIs(data.user);
    if (!who) return { ok: false, error: googleError("") };
    await startSession(data.user.id, who);
    return { ok: true };
  } catch (e) {
    const { statusCodes } = gs ?? {};
    if (gs?.isErrorWithCode(e) && (e.code === statusCodes?.SIGN_IN_CANCELLED || e.code === statusCodes?.IN_PROGRESS)) return { ok: false, error: null };
    if (gs?.isErrorWithCode(e) && e.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) return { ok: false, error: "Google sign-in needs Google Play services. Use your phone number instead." };
    return { ok: false, error: googleError(e instanceof Error ? e.message : "") };
  }
}

/** Forgets the Google account on this phone so the next sign-in shows the picker again. */
async function leaveGoogle() {
  if (!useAccount.getState().google) return;
  try { await (await googleModule()).GoogleSignin.signOut(); } catch { /* already signed out */ }
}

export async function signOut() {
  await leaveGoogle();
  await db().auth.signOut();
  uid = null; merged = false;
  useAccount.setState(signedOut);
}

/** Deletes the login and its cloud backup for good. Matches on this phone stay. */
export async function deleteAccount(): Promise<string | null> {
  const { error } = await db().rpc("gully_delete_my_account");
  if (error) return "Couldn't delete the account. Check your internet and try again.";
  uid = null; merged = false;
  await leaveGoogle();
  await db().auth.signOut({ scope: "local" }).catch(() => {});
  useAccount.setState(signedOut);
  return null;
}

export const retrySync = () => { if (uid) void (merged ? push() : syncNow().catch(syncFailed)); };

/** Restores the session on load and saves a few seconds after every change while signed in. */
export function startAccountSync() {
  if (!accountsSupported) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  void db().auth.getSession().then(({ data }) => {
    const who = whoIs(data.session?.user);
    if (data.session && who) void startSession(data.session.user.id, who);
  });
  const unsub = useStore.subscribe((s, prev) => {
    if (!uid || (s.matches === prev.matches && s.teams === prev.teams && s.cups === prev.cups && s.series === prev.series && s.infos === prev.infos && s.groups === prev.groups && s.kitty === prev.kitty)) return;
    clearTimeout(timer);
    timer = setTimeout(() => void push(), 3000);
  });
  return () => { clearTimeout(timer); unsub(); };
}

/** Totals across every scorer, for the Gully world card. Null when offline or accounts are off. */
export async function fetchWorld(): Promise<GullyWorld | null> {
  if (!accountsSupported) return null;
  const { data, error } = await db().rpc("gully_global");
  return error ? null : (data as GullyWorld);
}

export interface BoardRow { nickname: string; matches: number; runs: number; sixes: number; wickets: number; me?: boolean }
export type BoardMetric = "matches" | "runs" | "sixes" | "wickets";

/** Top scorers who chose to appear, by one metric. Empty when offline or accounts are off. */
export async function fetchTop(metric: BoardMetric): Promise<BoardRow[]> {
  if (!accountsSupported) return [];
  const { data, error } = await db().rpc("gully_top", { metric });
  return error ? [] : (data as BoardRow[]);
}

export interface MyBoard { nickname: string; on: boolean }

/** This scorer's board handle, or null before their first backup creates it. */
export async function myBoard(): Promise<MyBoard | null> {
  if (!uid) return null;
  const { data } = await db().from("gully_stats").select("nickname,on_board").maybeSingle();
  return data?.nickname ? { nickname: data.nickname as string, on: !!data.on_board } : null;
}

/** Renames this scorer on the board. Returns an error message, or null. */
export async function renameBoard(nick: string): Promise<string | null> {
  if (!uid) return "Sign in first.";
  const clean = nick.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,19}$/.test(clean)) return "Use 2 to 20 letters, numbers, spaces, dots or dashes.";
  const { error } = await db().from("gully_stats").update({ nickname: clean }).eq("user_id", uid);
  return error ? "Couldn't save. Check your internet and try again." : null;
}

/** Shows or hides this scorer on the board. Returns an error message, or null. */
export async function showOnBoard(on: boolean): Promise<string | null> {
  if (!uid) return "Sign in first.";
  const { error } = await db().from("gully_stats").update({ on_board: on }).eq("user_id", uid);
  return error ? "Couldn't save. Check your internet and try again." : null;
}
