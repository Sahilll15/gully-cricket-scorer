import { Linking, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { create } from "zustand";
import * as E from "@shared/engine/engine";
import type { Match } from "@shared/engine/types";
import { scoresheetHtml } from "@shared/scoresheet";
import { summaryText } from "@shared/share";
import { track } from "./track";
import { EV, IMAGE_SHARE } from "@shared/events";

export { summaryText };

/** WhatsApp when it is installed, otherwise the Android share sheet. */
export async function sendText(text: string) {
  const wa = `whatsapp://send?text=${encodeURIComponent(text)}`;
  try { await Linking.openURL(wa); } catch { await Share.share({ message: text }).catch(() => {}); }
}
export const shareText = (m: Match) => { track(EV.share, { what: "text" }); return sendText(summaryText(m)); };
export const copyText = (text: string) => Clipboard.setStringAsync(text);

export type ImageKind = "full" | "card" | "match" | "winner";

/** The image that ShareHost is drawing offscreen right now, and who is waiting for it. */
interface Pending { m: Match; kind: ImageKind; done: (ok: boolean) => void }
export const useShareJob = create<{ job: Pending | null }>(() => ({ job: null }));

export function shareImage(m: Match, kind: ImageKind = "full") {
  track(EV.share, { what: IMAGE_SHARE[kind] });
  return new Promise<boolean>((done) => useShareJob.setState({ job: { m, kind, done } }));
}
export const resultText = (m: Match) => E.result(m)?.text ?? "";

const fileSafe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "match";

/** Renders the scoresheet to a PDF and opens the share sheet with it. False if it failed or was cancelled. */
export async function sharePdf(m: Match): Promise<boolean> {
  track(EV.share, { what: "pdf" });
  try {
    const { uri } = await Print.printToFileAsync({ html: scoresheetHtml(m), width: 595, height: 842 });
    const name = E.isSolo(m) ? "solo" : `${m.teams[0].name}-vs-${m.teams[1].name}`;
    const out = new File(Paths.cache, `gully-scoresheet-${fileSafe(name)}.pdf`);
    if (out.exists) out.delete();
    await new File(uri).move(out);
    await Sharing.shareAsync(out.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Send scoresheet" });
    return true;
  } catch { return false; }
}

/** Writes the CSV to the cache folder and opens the share sheet, so it can go to Drive, mail or WhatsApp. */
export async function shareCsv(text: string, name: string): Promise<boolean> {
  track(EV.share, { what: "csv" });
  try {
    const f = new File(Paths.cache, name);
    if (f.exists) f.delete();
    f.create();
    await f.write("\ufeff" + text);
    await Sharing.shareAsync(f.uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text", dialogTitle: "Send player stats" });
    return true;
  } catch { return false; }
}
