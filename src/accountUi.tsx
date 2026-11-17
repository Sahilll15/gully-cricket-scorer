import { useRef, useState } from "react";
import { accountsSupported, deleteAccount, retrySync, signIn, signOut, useAccount } from "./account";
import { cleanPhone, validPasscode } from "./backup";
import { backupFileName, readBackupFile, restoreFrom, toBackupFile } from "./backupFile";
import { useStore } from "./store";
import { track } from "./track";
import { EV } from "./events";
import { flag } from "./matchEvents";
import { cx, PrimaryButton, Sheet } from "./ui";

const pretty = (p: string) => (p.startsWith("+") ? p : `+91 ${p.slice(0, 5)} ${p.slice(5)}`);
const ago = (t: number | null) => { if (!t) return ""; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? "just now" : `${Math.round(s / 60)} min ago`; };

function Digits({ value, set, label, auto }: { value: string; set: (v: string) => void; label: string; auto?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-teal">{label}</span>
      <input value={value} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete={auto}
        placeholder="••••••" className="min-h-14 w-full rounded-2xl border-2 border-line bg-panel px-4 text-center text-2xl font-extrabold tracking-[0.5em] text-fg outline-none focus:border-sun" />
    </label>
  );
}

/** Save everything to a JSON file, or merge one back in. Works without an account. */
export function FileBackup() {
  const { snapshot, restoreBackup } = useStore();
  const pickRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = () => {
    const url = URL.createObjectURL(new Blob([toBackupFile(snapshot())], { type: "application/json" }));
    const a = document.createElement("a");
    track(EV.backup_file_save);
    a.href = url; a.download = backupFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({ ok: true, text: "Backup file saved. Keep it somewhere safe, like your Drive or a chat with yourself." });
  };
  const restore = async (f: File | undefined) => {
    if (!f) return;
    const file = readBackupFile(await f.text());
    if (!file) return setMsg({ ok: false, text: "That file isn't a Gully Scorer backup." });
    const { data, added } = restoreFrom(snapshot(), file);
    track(EV.backup_file_restore);
    restoreBackup(data);
    setMsg({ ok: true, text: added });
  };
  return (
    <div>
      <p className="text-sm font-semibold text-teal">Backup file</p>
      <p className="mt-1 text-xs text-mute">Matches, teams, cups, series, player details and the kitty in one file. Restoring adds to what's here, it never deletes.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={save} className="press min-h-12 rounded-2xl border-2 border-line px-2 text-sm font-semibold text-fg">Save a backup file</button>
        <button onClick={() => pickRef.current?.click()} className="press min-h-12 rounded-2xl border-2 border-line px-2 text-sm font-semibold text-fg">Restore from a file</button>
      </div>
      <input ref={pickRef} type="file" accept="application/json,.json" hidden
        onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ""; }} />
      {msg && <p className={cx("mt-3 text-sm font-medium", msg.ok ? "text-fg" : "text-out")}>{msg.text}</p>}
    </div>
  );
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { phone, sync, savedAt } = useAccount();
  const [isNew, setIsNew] = useState(false);
  const [cc, setCc] = useState("91"), [num, setNum] = useState(""), [pass, setPass] = useState(""), [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [del, setDel] = useState(false), [delErr, setDelErr] = useState("");
  const clean = cleanPhone(num, cc), india = cc === "91" && !num.trim().startsWith("+");
  const ok = clean && validPasscode(pass) && (!isNew || pass === again);

  if (phone) return (
    <Sheet title="Your account" onClose={onClose}>
      <div className="rounded-3xl bg-key p-4 text-center">
        <p className="text-sm text-mute">Signed in as</p>
        <p className="mt-1 text-2xl font-extrabold text-fg">{pretty(phone)}</p>
        <p className={cx("mt-2 text-sm font-semibold", sync === "error" ? "text-out" : "text-sun")}>
          {sync === "saving" ? "Saving…" : sync === "error" ? "Couldn't save. Will retry when you're online." : savedAt ? `All matches saved ${ago(savedAt)}` : "Matches are saved to your account"}
        </p>
      </div>
      <p className="mt-3 text-sm text-mute">Sign in with the same number on any phone to get your matches, teams and tournaments back.</p>
      <div className="mt-4 grid gap-2">
        {sync === "error" && <PrimaryButton onClick={retrySync}>Try saving again</PrimaryButton>}
        <button onClick={() => { track(EV.sign_out); void signOut(); onClose(); }} className="press min-h-12 w-full rounded-2xl border-2 border-line font-semibold text-fg">Sign out</button>
      </div>
      <p className="mt-3 text-center text-xs text-mute">Signing out keeps everything on this phone too.</p>
      <div className="mt-5 border-t border-line pt-4"><FileBackup /></div>
      <div className="mt-5 border-t border-line pt-4">
        {del ? (
          <div className="rounded-3xl border-2 border-out p-4">
            <p className="font-bold text-fg">Delete your account?</p>
            <p className="mt-1 text-sm text-mute">Your login and the cloud copy of your matches are removed for good. Matches on this phone stay.</p>
            {delErr && <p className="mt-2 text-sm text-out">{delErr}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => { setDel(false); setDelErr(""); }} className="press min-h-12 rounded-2xl border-2 border-line font-semibold text-fg">Cancel</button>
              <button disabled={busy} onClick={async () => { setBusy(true); const e = await deleteAccount(); setBusy(false); if (e) setDelErr(e); else { track(EV.account_delete); onClose(); } }}
                className="press min-h-12 rounded-2xl bg-out font-semibold text-ink">{busy ? "Deleting…" : "Delete for good"}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setDel(true)} className="press min-h-11 w-full text-sm font-semibold text-out">Delete my account</button>
        )}
      </div>
    </Sheet>
  );

  async function go() {
    if (!ok || busy) return;
    setBusy(true); setErr("");
    const e = await signIn(clean!, pass, isNew);
    setBusy(false);
    if (e) setErr(e); else { track(EV.sign_in, { new: flag(isNew) }); onClose(); }
  }

  return (
    <Sheet title="Save your matches" onClose={onClose}
      footer={<PrimaryButton disabled={!ok || busy} onClick={() => void go()}>{busy ? "One sec…" : isNew ? "Create account" : "Sign in"}</PrimaryButton>}>
      <div className="mb-4 flex rounded-full bg-key p-1 text-sm font-semibold">
        {[false, true].map((v) => (
          <button key={String(v)} onClick={() => { setIsNew(v); setErr(""); }}
            className={cx("press min-h-10 flex-1 rounded-full", isNew === v ? "bg-sun text-ink" : "text-mute")}>{v ? "New here" : "I have an account"}</button>
        ))}
      </div>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-teal">Mobile number</span>
          <div className="flex min-h-14 items-center rounded-2xl border-2 border-line bg-panel focus-within:border-sun">
            <span className="pl-4 text-lg font-bold text-mute">+</span>
            <input value={cc} onChange={(e) => setCc(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" aria-label="Country code"
              className="min-h-12 w-12 bg-transparent text-lg font-bold text-fg outline-none" />
            <span className="h-7 w-px bg-line" />
            <input value={num} onChange={(e) => setNum(e.target.value.replace(/[^\d +]/g, "").slice(0, 18))} inputMode="tel" autoComplete="tel-national"
              placeholder={india ? "98765 43210" : "Mobile number"} className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-lg font-bold text-fg outline-none" />
          </div>
          <span className="mt-1 block text-xs text-mute">Country code first. 91 is India.</span>
          {num.replace(/\D/g, "").length >= (india ? 10 : 8) && !clean && <span className="mt-1 block text-xs text-out">That doesn't look like a mobile number.</span>}
        </label>
        <Digits label={isNew ? "Pick a 6-digit passcode" : "Passcode"} value={pass} set={setPass} auto={isNew ? "new-password" : "current-password"} />
        {isNew && <Digits label="Type it again" value={again} set={setAgain} auto="new-password" />}
        {isNew && again.length === 6 && pass !== again && <p className="-mt-2 text-xs text-out">The two passcodes don't match.</p>}
        <button hidden />
      </form>
      {err && <p className="mt-4 rounded-2xl bg-out/15 p-3 text-sm font-medium text-out">{err}</p>}
      <p className="mt-4 text-xs text-mute">No SMS is sent. Your number is just your login name. Remember the passcode, it can't be reset from the app yet.</p>
      <div className="mt-5 border-t border-line pt-4"><FileBackup /></div>
    </Sheet>
  );
}

/** Small header button that opens the account sheet. */
export function AccountButton() {
  const phone = useAccount((s) => s.phone), sync = useAccount((s) => s.sync);
  const [open, setOpen] = useState(false);
  if (!accountsSupported) return (
    <>
      <button onClick={() => setOpen(true)} className="press flex min-h-10 items-center rounded-full border border-line bg-key px-3 text-xs font-bold text-fg">Backup</button>
      {open && <Sheet title="Backup" onClose={() => setOpen(false)}><FileBackup /></Sheet>}
    </>
  );
  return (
    <>
      <button onClick={() => setOpen(true)} className="press flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-key px-3 text-xs font-bold text-fg">
        <span className={cx("h-2 w-2 rounded-full", !phone ? "bg-mute" : sync === "error" ? "bg-out" : "bg-sun")} />
        {phone ? `${phone.slice(0, 2)}•••${phone.slice(-3)}` : "Sign in"}
      </button>
      {open && <AccountSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/** Nudge on Home once someone has matches worth losing. */
export function BackupCard() {
  const phone = useAccount((s) => s.phone);
  const [open, setOpen] = useState(false);
  if (!accountsSupported || phone) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="press flex w-full items-center gap-3 rounded-3xl border border-sun/40 bg-sun-soft p-4 text-left">
        <span className="text-2xl">☁</span>
        <span className="flex-1"><span className="block font-bold text-fg">Don't lose your matches</span>
          <span className="block text-sm text-fg/75">Sign in with your number and passcode. A new phone gets everything back.</span></span>
        <span className="text-mute">›</span>
      </button>
      {open && <AccountSheet onClose={() => setOpen(false)} />}
    </>
  );
}
