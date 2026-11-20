// Phone logins use a made-up address nobody receives mail at. Non-Indian numbers get an "intl" prefix
// so they can never collide with a 10-digit Indian login.
const PHONE_DOMAIN = "@phone.gully-scorer.app";

export const loginFor = (phone: string) => `${phone.startsWith("+") ? `intl${phone.slice(1)}` : phone}${PHONE_DOMAIN}`;

/** The phone number behind a phone login, or null for any other address. */
export function phoneOf(email?: string | null): string | null {
  if (!email?.endsWith(PHONE_DOMAIN)) return null;
  const n = email.slice(0, -PHONE_DOMAIN.length);
  if (!n) return null;
  return n.startsWith("intl") ? `+${n.slice(4)}` : n;
}

export interface GoogleWho { name: string; email: string | null }
export type Who = { phone: string; google: null } | { phone: null; google: GoogleWho };

/** The parts of a Supabase user this needs. */
export interface AuthUser { email?: string | null; user_metadata?: Record<string, unknown> | null }

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Who is signed in: a phone login, or anyone else by their Google name, falling back to the email. */
export function whoIs(user: AuthUser | null | undefined): Who | null {
  if (!user) return null;
  const phone = phoneOf(user.email);
  if (phone) return { phone, google: null };
  const meta = user.user_metadata ?? {};
  const email = text(user.email) || text(meta.email) || null;
  const name = text(meta.full_name) || text(meta.name) || [text(meta.given_name), text(meta.family_name)].filter(Boolean).join(" ") || email;
  return name ? { phone: null, google: { name, email } } : null;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** The short label on the account pill: a masked phone, or a first name or email. */
export function pillLabel(who: { phone: string | null; google: GoogleWho | null }): string {
  if (who.phone) return `${who.phone.slice(0, 2)}•••${who.phone.slice(-3)}`;
  const name = who.google?.name ?? "";
  return clip(name.includes("@") ? name : name.split(/\s+/)[0], 14);
}

/** One short line for a failed Google sign-in. */
export function googleError(message: string): string {
  if (/network|fetch|timeout|offline/i.test(message)) return "No internet right now. Try again when you're online.";
  if (/rate|too many/i.test(message)) return "Too many tries. Wait a minute and try again.";
  return "Google sign-in didn't work. Try again, or use your phone number.";
}
