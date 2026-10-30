import { useEffect, useState } from "react";
import { Card } from "./ui";

type InstallEvent = Event & { prompt: () => Promise<void> };
const KEY = "gully-install-dismissed";

/** "Add to Home Screen" help on iPhone (Safari has no install prompt), the real install button elsewhere. */
export function InstallCard() {
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(() => localStorage.getItem(KEY) === "1");

  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    addEventListener("beforeinstallprompt", on);
    return () => removeEventListener("beforeinstallprompt", on);
  }, []);
  if (standalone || hidden || (!ios && !evt)) return null;
  const close = () => { localStorage.setItem(KEY, "1"); setHidden(true); };

  return (
    <Card className="relative !p-4">
      <button onClick={close} aria-label="Dismiss" className="press absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full text-mute">✕</button>
      <p className="pr-8 font-bold text-fg">Install it like an app</p>
      {ios ? (
        <p className="mt-1 text-sm text-mute">
          In Safari, tap <span className="font-semibold text-fg">Share</span> <span aria-hidden>⬆︎</span>, then <span className="font-semibold text-fg">Add to Home Screen</span>. It opens full screen and works offline.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-mute">Opens full screen from your home screen and works offline.</p>
          <button onClick={() => { void evt!.prompt(); close(); }} className="press mt-3 min-h-12 w-full rounded-2xl bg-sun font-bold text-ink">Install app</button>
        </>
      )}
    </Card>
  );
}
