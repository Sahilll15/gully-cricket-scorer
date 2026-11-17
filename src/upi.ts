/** UPI payment links for the kitty. The app only draws the QR; the payer's own UPI app moves the money. */

/** Spaces dropped and lower-cased, since UPI IDs ignore case. */
export const cleanUpi = (raw: string) => raw.replace(/\s+/g, "").toLowerCase();

/** name@bank, the shape every UPI app accepts. */
export const validUpi = (id: string) => /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/i.test(cleanUpi(id));

// @ stays readable: some UPI apps fail to decode %40 in the payee address.
const enc = (s: string) => encodeURIComponent(s).replace(/%40/g, "@");

/** upi://pay link that asks for exactly `amount` rupees to `name` at `upiId`. */
export function upiLink(upiId: string, name: string, amount: number, note = "Gully kitty"): string {
  const am = Math.max(0, Math.round(amount));
  return `upi://pay?pa=${enc(cleanUpi(upiId))}&pn=${enc(name.trim())}&am=${am}&cu=INR&tn=${enc(note)}`;
}
