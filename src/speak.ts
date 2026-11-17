export const speakSupported = typeof window !== "undefined" && "speechSynthesis" in window;

/** Says one line, cutting off the last one so a quick next ball doesn't queue up behind it. */
export function say(text: string) {
  if (!speakSupported || !text) return;
  const s = window.speechSynthesis, u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN"; u.rate = 1.05;
  s.cancel(); s.speak(u);
}
