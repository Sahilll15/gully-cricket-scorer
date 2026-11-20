/** The next batter in order is almost always who comes in, so the wicket sheet starts with them picked. */
export const nextBatterId = (fresh: { id: string }[], needNew: boolean): string | null => (needNew ? fresh[0]?.id ?? null : null);

export const confirmWicketLabel = (needNew: boolean, newName: string | null): string =>
  needNew && newName ? `Confirm, ${newName} comes in` : "Confirm wicket";
