import { useState } from "react";
import { Linking, TextInput, View, type TextInputProps } from "react-native";
import { ChevronRight, Cloud } from "lucide-react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { accountsSupported, deleteAccount, retrySync, signIn, signOut, useAccount } from "@/lib/account";
import { cleanPhone, validPasscode } from "@shared/backup";
import { backupFileName, readBackupFile, restoreFrom, toBackupFile } from "@shared/backupFile";
import { useStore } from "@/lib/store";
import { track } from "@/lib/track";
import { EV } from "@shared/events";
import { flag } from "@shared/matchEvents";
import { C, GhostButton, Num, Press, PrimaryButton, SectionTitle, Segmented, Sheet, Txt, tw } from "@/ui/ui";

const pretty = (p: string) => (p.startsWith("+") ? p : `+91 ${p.slice(0, 5)} ${p.slice(5)}`);
const ago = (t: number | null) => { if (!t) return ""; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? "just now" : `${Math.round(s / 60)} min ago`; };

function Digits({ value, set, label, auto, onSubmit }: { value: string; set: (v: string) => void; label: string; auto?: TextInputProps["autoComplete"]; onSubmit?: () => void }) {
  const [focus, setFocus] = useState(false);
  return (
    <View>
      <Txt style={tw`mb-2 text-[13px] font-medium text-teal`}>{label}</Txt>
      <TextInput value={value} onChangeText={(t) => set(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" secureTextEntry autoComplete={auto}
        placeholder="••••••" placeholderTextColor={C.mute} selectionColor={C.sun} accessibilityLabel={label} onSubmitEditing={onSubmit}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={[tw`min-h-14 w-full rounded-2xl border ${focus ? "border-sun" : "border-line"} bg-panel px-4 text-center text-[22px] text-fg`,
          { fontFamily: "JetBrainsMono_700Bold", letterSpacing: 12 }]} />
    </View>
  );
}

/** Save everything to a JSON file, or merge one back in. Works without an account. */
export function FileBackup() {
  const { snapshot, restoreBackup } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setBusy(true);
    try {
      const f = new File(Paths.cache, backupFileName());
      f.create({ overwrite: true });
      await f.write(toBackupFile(snapshot()));
      await Sharing.shareAsync(f.uri, { mimeType: "application/json", dialogTitle: "Save a backup file" });
      track(EV.backup_file_save);
      setMsg({ ok: true, text: "Backup file ready. Keep it somewhere safe, like your Drive or a chat with yourself." });
    } catch {
      setMsg({ ok: false, text: "Couldn't save the backup file. Try again." });
    }
    setBusy(false);
  };
  const restore = async () => {
    setBusy(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "application/octet-stream"], copyToCacheDirectory: true });
      if (!pick.canceled && pick.assets[0]) {
        const file = readBackupFile(await new File(pick.assets[0].uri).text());
        if (!file) setMsg({ ok: false, text: "That file isn't a Gully Scorer backup." });
        else {
          const { data, added } = restoreFrom(snapshot(), file);
          track(EV.backup_file_restore);
          restoreBackup(data);
          setMsg({ ok: true, text: added });
        }
      }
    } catch {
      setMsg({ ok: false, text: "Couldn't read that file." });
    }
    setBusy(false);
  };
  return (
    <View>
      <SectionTitle>Backup file</SectionTitle>
      <Txt style={tw`text-xs text-mute`}>Matches, teams, cups, series, player details and the kitty in one file. Restoring adds to what's here, it never deletes.</Txt>
      <View style={tw`mt-3 flex-row gap-2`}>
        <View style={tw`flex-1`}><GhostButton disabled={busy} onPress={() => void save()}>Save a backup file</GhostButton></View>
        <View style={tw`flex-1`}><GhostButton disabled={busy} onPress={() => void restore()}>Restore from a file</GhostButton></View>
      </View>
      {msg && <Txt style={tw`mt-3 text-[13px] font-medium ${msg.ok ? "text-fg" : "text-out"}`}>{msg.text}</Txt>}
    </View>
  );
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { phone, sync, savedAt } = useAccount();
  const [isNew, setIsNew] = useState(false);
  const [cc, setCc] = useState("91"), [num, setNum] = useState(""), [pass, setPass] = useState(""), [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [focus, setFocus] = useState(false);
  const [del, setDel] = useState(false), [delErr, setDelErr] = useState("");
  const clean = cleanPhone(num, cc), india = cc === "91" && !num.trim().startsWith("+");
  const ok = clean && validPasscode(pass) && (!isNew || pass === again);

  if (phone) return (
    <Sheet title="Your account" onClose={onClose}>
      <View style={tw`rounded-[22px] border border-line bg-panel px-4 py-5 items-center`}>
        <Txt style={tw`text-[13px] text-mute`}>Signed in as</Txt>
        <Num style={tw`mt-1.5 text-[24px] text-fg`}>{pretty(phone)}</Num>
        <Txt style={tw`mt-2 text-center text-[13px] font-medium ${sync === "error" ? "text-out" : "text-teal"}`}>
          {sync === "saving" ? "Saving…" : sync === "error" ? "Couldn't save. Will retry when you're online." : savedAt ? `All matches saved ${ago(savedAt)}` : "Matches are saved to your account"}
        </Txt>
      </View>
      <Txt style={tw`mt-3 text-[13px] text-mute`}>Sign in with the same number on any phone to get your matches, teams and tournaments back.</Txt>
      <View style={tw`mt-4 gap-2`}>
        {sync === "error" && <PrimaryButton onPress={retrySync}>Try saving again</PrimaryButton>}
        <GhostButton onPress={() => { track(EV.sign_out); void signOut(); onClose(); }}>Sign out</GhostButton>
      </View>
      <Txt style={tw`mt-3 text-center text-xs text-mute`}>Signing out keeps everything on this phone too.</Txt>
      <View style={tw`mt-5 border-t border-line pt-4`}><FileBackup /></View>
      <View style={tw`mt-5 border-t border-line pt-4`}>
        {del ? (
          <View style={tw`rounded-[22px] border border-out px-4 py-4`}>
            <Txt style={tw`text-[15px] font-semibold text-fg`}>Delete your account?</Txt>
            <Txt style={tw`mt-1.5 text-[13px] leading-5 text-teal`}>Your login and the cloud copy of your matches are removed for good. Matches on this phone stay.</Txt>
            {!!delErr && <Txt style={tw`mt-2 text-[13px] text-out`}>{delErr}</Txt>}
            <View style={tw`mt-3 flex-row gap-2`}>
              <View style={tw`flex-1`}><GhostButton onPress={() => { setDel(false); setDelErr(""); }}>Cancel</GhostButton></View>
              <View style={tw`flex-1`}>
                <Press disabled={busy} onPress={async () => { setBusy(true); const e = await deleteAccount(); setBusy(false); if (e) setDelErr(e); else { track(EV.account_delete); onClose(); } }}
                  style={tw`min-h-14 rounded-2xl items-center justify-center bg-out`}>
                  <Txt style={tw`font-semibold text-ink`}>{busy ? "Deleting…" : "Delete for good"}</Txt>
                </Press>
              </View>
            </View>
          </View>
        ) : (
          <Press onPress={() => setDel(true)} style={tw`min-h-11 items-center justify-center`}>
            <Txt style={tw`text-[14px] font-medium text-out`}>Delete my account</Txt>
          </Press>
        )}
      </View>
      <Press onPress={() => void Linking.openURL("https://ai.sahilchalke.com/privacy/gully-cricket-scorer/")} style={tw`mt-4 min-h-11 items-center justify-center`}>
        <Txt style={tw`text-[13px] text-mute underline`}>Privacy policy</Txt>
      </Press>
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
      footer={<PrimaryButton disabled={!ok || busy} onPress={() => void go()}>{busy ? "One sec…" : isNew ? "Create account" : "Sign in"}</PrimaryButton>}>
      <View style={tw`mb-5`}>
        <Segmented value={isNew ? "new" : "have"} set={(v) => { setIsNew(v === "new"); setErr(""); }}
          items={[{ v: "have", label: "I have an account" }, { v: "new", label: "New here" }]} />
      </View>
      <View style={tw`gap-4`}>
        <View>
          <Txt style={tw`mb-2 text-[13px] font-medium text-teal`}>Mobile number</Txt>
          <View style={tw`flex-row min-h-14 items-center rounded-2xl border ${focus ? "border-sun" : "border-line"} bg-panel`}>
            <Num style={tw`pl-4 text-[17px] text-mute`}>+</Num>
            <TextInput value={cc} onChangeText={(t) => setCc(t.replace(/\D/g, "").slice(0, 3))} keyboardType="number-pad" accessibilityLabel="Country code" returnKeyType="next"
              selectionColor={C.sun} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
              style={[tw`min-h-12 w-12 text-[17px] text-fg`, { fontFamily: "JetBrainsMono_700Bold" }]} />
            <View style={tw`h-6 w-px bg-line`} />
            <TextInput value={num} onChangeText={(t) => setNum(t.replace(/[^\d +]/g, "").slice(0, 18))} keyboardType="phone-pad" autoComplete="tel-national"
              placeholder={india ? "98765 43210" : "Mobile number"} placeholderTextColor={C.mute} selectionColor={C.sun} accessibilityLabel="Mobile number"
              onSubmitEditing={isNew ? undefined : () => void go()} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
              style={[tw`min-h-12 flex-1 px-3 text-[17px] text-fg`, { fontFamily: "JetBrainsMono_700Bold" }]} />
          </View>
          <Txt style={tw`mt-1.5 text-xs text-mute`}>Country code first. 91 is India.</Txt>
          {num.replace(/\D/g, "").length >= (india ? 10 : 8) && !clean && <Txt style={tw`mt-1 text-xs text-out`}>That doesn't look like a mobile number.</Txt>}
        </View>
        <Digits label={isNew ? "Pick a 6-digit passcode" : "Passcode"} value={pass} set={setPass} auto={isNew ? "new-password" : "current-password"}
          onSubmit={isNew ? undefined : () => void go()} />
        {isNew && <Digits label="Type it again" value={again} set={setAgain} auto="new-password" onSubmit={() => void go()} />}
        {isNew && again.length === 6 && pass !== again && <Txt style={tw`-mt-2 text-xs text-out`}>The two passcodes don't match.</Txt>}
      </View>
      {!!err && <Txt style={tw`mt-4 rounded-2xl border border-out/40 bg-out/10 p-3 text-[13px] font-medium text-out`}>{err}</Txt>}
      <Txt style={tw`mt-4 text-xs text-mute`}>No SMS is sent. Your number is just your login name. Remember the passcode, it can't be reset from the app yet.</Txt>
      <View style={tw`mt-5 border-t border-line pt-4`}><FileBackup /></View>
      <Press onPress={() => void Linking.openURL("https://ai.sahilchalke.com/privacy/gully-cricket-scorer/")} style={tw`mt-4 min-h-11 items-center justify-center`}>
        <Txt style={tw`text-[13px] text-mute underline`}>Privacy policy</Txt>
      </Press>
    </Sheet>
  );
}

/** Small header button that opens the account sheet. */
export function AccountButton() {
  const phone = useAccount((s) => s.phone), sync = useAccount((s) => s.sync);
  const [open, setOpen] = useState(false);
  if (!accountsSupported) return (
    <>
      <Press onPress={() => setOpen(true)} accessibilityLabel="Backup" style={tw`min-h-11 items-center justify-center rounded-full border border-line bg-panel px-3.5`}>
        <Txt style={tw`text-[13px] font-medium text-fg`}>Backup</Txt>
      </Press>
      {open && <Sheet title="Backup" onClose={() => setOpen(false)}><FileBackup /></Sheet>}
    </>
  );
  return (
    <>
      <Press onPress={() => setOpen(true)} accessibilityLabel={phone ? "Your account" : "Sign in"}
        style={tw`flex-row min-h-11 items-center gap-2 rounded-full border border-line bg-panel px-3.5`}>
        <View style={tw`h-2 w-2 rounded-full ${!phone ? "bg-mute" : sync === "error" ? "bg-out" : "bg-sun"}`} />
        {phone
          ? <Num style={tw`text-[12px] font-medium text-fg`}>{`${phone.slice(0, 2)}•••${phone.slice(-3)}`}</Num>
          : <Txt style={tw`text-[13px] font-medium text-fg`}>Sign in</Txt>}
      </Press>
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
      <Press onPress={() => setOpen(true)} style={[tw`flex-row w-full items-center gap-3 rounded-[22px] border bg-sun-soft p-4`, { borderColor: "#2e3a22" }]}>
        <View style={tw`h-10 w-10 rounded-full border border-line bg-panel items-center justify-center`}>
          <Cloud size={20} color={C.sun} strokeWidth={2} />
        </View>
        <View style={tw`flex-1`}>
          <Txt style={tw`text-[15px] font-semibold text-fg`}>Don't lose your matches</Txt>
          <Txt style={tw`mt-0.5 text-[13px] text-teal`}>Sign in with your number and passcode. A new phone gets everything back.</Txt>
        </View>
        <ChevronRight size={18} color={C.mute} strokeWidth={2} />
      </Press>
      {open && <AccountSheet onClose={() => setOpen(false)} />}
    </>
  );
}
