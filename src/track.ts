// gtag comes from /analytics.js, which only runs on the live domains, so calls are no-ops in dev.
export const track = (name: string, params: Record<string, string | number> = {}) =>
  (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", name, params);
