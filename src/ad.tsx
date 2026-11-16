import { useEffect } from "react";

// One small AdSense box, filled by the site's /ads.js. Never place it on the live scoring screen.
export function AdBox() {
  useEffect(() => {
    (window as unknown as { chalkAds?: { render(): void } }).chalkAds?.render();
  }, []);
  return <div data-ad="small" />;
}
