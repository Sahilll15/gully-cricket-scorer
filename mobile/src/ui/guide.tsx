import { useEffect, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check, CircleHelp, Lightbulb, X } from "lucide-react-native";
import { GLOSSARY } from "@shared/glossary";
import { useStore } from "@/lib/store";
import { C, Card, Press, Sheet, Txt, tw } from "./ui";

const get = (k: string) => AsyncStorage.getItem(k).catch(() => null);
const set = (k: string) => { void AsyncStorage.setItem(k, "1").catch(() => {}); };

/** One-time hint above the keypad before the first ball of the first match. */
export function FirstBallCoach({ show }: { show: boolean }) {
  const [seen, setSeen] = useState(true);
  useEffect(() => { void get("gully-coach-live").then((v) => setSeen(!!v)); }, []);
  useEffect(() => { if (!show && !seen) { set("gully-coach-live"); setSeen(true); } }, [show, seen]);
  if (seen || !show) return null;
  return (
    <View style={[tw`mt-2 flex-row items-center gap-3 rounded-2xl px-3 py-2.5`, { backgroundColor: C.sunSoft, borderWidth: 1, borderColor: "rgba(255,138,61,0.35)" }]}>
      <Lightbulb size={18} color={C.sun} strokeWidth={2.2} />
      <Txt style={tw`flex-1 text-[13px] leading-5 text-teal`}>Tap what happened on each ball. Wrong tap? Hit Undo.</Txt>
      <Press onPress={() => { set("gully-coach-live"); setSeen(true); }} accessibilityLabel="Dismiss tip"><X size={16} color={C.mute} strokeWidth={2.2} /></Press>
    </View>
  );
}

/** "What do these mean?" link that opens the glossary sheet. */
export function GlossaryLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Press onPress={() => setOpen(true)} accessibilityLabel="What do these rules mean" style={tw`flex-row items-center gap-1.5 self-start py-1`}>
        <CircleHelp size={15} color={C.sun} strokeWidth={2.2} />
        <Txt style={tw`text-[13px] font-semibold text-sun`}>What do these rules mean?</Txt>
      </Press>
      {open && (
        <Sheet title="Gully rules, in plain words" onClose={() => setOpen(false)}>
          <View style={tw`gap-3 pb-2`}>
            {GLOSSARY.map((g) => (
              <View key={g.term}>
                <Txt style={tw`text-[15px] font-semibold`}>{g.term}</Txt>
                <Txt style={tw`text-[13px] leading-5 text-mute`}>{g.means}</Txt>
              </View>
            ))}
          </View>
        </Sheet>
      )}
    </>
  );
}

/** Getting-started ticks, derived from what the phone already holds. Hides itself when done or dismissed. */
export function GettingStarted() {
  const matches = useStore((s) => s.matches);
  const [off, setOff] = useState(true);
  const [book, setBook] = useState(false);
  useEffect(() => { void Promise.all([get("gully-checklist-off"), get("gully-seen-book")]).then(([o, b]) => { setOff(!!o); setBook(!!b); }); }, []);
  const steps: [string, boolean][] = [
    ["Score your first match", matches.length > 0],
    ["Finish a match", matches.some((m) => m.status === "done")],
    ["Share a match live", matches.some((m) => !!m.live)],
    ["Open the Gully Book", book],
  ];
  const n = steps.filter(([, ok]) => ok).length;
  if (off || n === steps.length || !matches.length) return null;
  return (
    <Card>
      <View style={tw`flex-row items-center justify-between`}>
        <Txt style={tw`text-[15px] font-semibold`}>Getting started · {n} of {steps.length}</Txt>
        <Press onPress={() => { set("gully-checklist-off"); setOff(true); }} accessibilityLabel="Hide checklist"><X size={16} color={C.mute} strokeWidth={2.2} /></Press>
      </View>
      <View style={tw`mt-2 h-1.5 overflow-hidden rounded-full bg-line`}><View style={{ height: 6, width: `${(n / steps.length) * 100}%`, backgroundColor: C.sun }} /></View>
      <View style={tw`mt-3 gap-2`}>
        {steps.map(([label, ok]) => (
          <View key={label} style={tw`flex-row items-center gap-2.5`}>
            <View style={[tw`h-5 w-5 items-center justify-center rounded-full`, ok ? { backgroundColor: C.sun } : { borderWidth: 1, borderColor: C.line }]}>{ok && <Check size={12} color={C.ink} strokeWidth={3} />}</View>
            <Txt style={tw`text-[13px] ${ok ? "text-mute" : "text-fg"}`}>{label}</Txt>
          </View>
        ))}
      </View>
    </Card>
  );
}

export const markBookSeen = () => set("gully-seen-book");
