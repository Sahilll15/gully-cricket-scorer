import { ExpoSpeechRecognitionModule, ExpoWebSpeechRecognition } from "expo-speech-recognition";
export { parse, type VoiceCmd } from "@shared/voice";

export const voiceSupported = (() => { try { return ExpoSpeechRecognitionModule.isRecognitionAvailable(); } catch { return false; } })();

const FATAL = ["not-allowed", "service-not-allowed", "network", "language-not-supported"];

/** Same contract as the web app: keeps listening until stopped, hands over each final phrase. */
export function listen(onText: (t: string) => void, onError: (e: string) => void) {
  let on = true, rec: ExpoWebSpeechRecognition | null = null, restarts = 0, timer: ReturnType<typeof setTimeout> | undefined;
  void ExpoSpeechRecognitionModule.requestPermissionsAsync().then(({ granted }) => {
    if (!on) return;
    if (!granted) { on = false; onError("not-allowed"); return; }
    rec = new ExpoWebSpeechRecognition();
    rec.lang = "en-IN"; rec.continuous = true; rec.interimResults = false;
    // Events come from one shared native module, so a stopped session must ignore them or balls count twice.
    rec.onresult = (e) => { if (!on) return; restarts = 0; onText(e.results[e.results.length - 1][0].transcript.trim()); };
    rec.onend = () => {
      if (!on || restarts > 20) return;
      restarts++;
      timer = setTimeout(() => { if (on) try { rec?.start(); } catch { /* already running */ } }, Math.min(2000, 150 * restarts));
    };
    rec.onerror = (e) => { if (on && FATAL.includes(e.error)) { on = false; onError(e.error); } };
    rec.start();
  });
  return () => {
    on = false; clearTimeout(timer);
    if (rec) { rec.onresult = null; rec.onerror = null; try { rec.stop(); } catch { /* stopped */ } }
  };
}
