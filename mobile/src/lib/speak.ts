import * as Speech from "expo-speech";

export const speakSupported = true;

/** Says one line, cutting off the last one so a quick next ball doesn't queue up behind it. */
export function say(text: string) {
  if (!text) return;
  void Speech.stop();
  Speech.speak(text, { language: "en-IN", rate: 1.0 });
}
