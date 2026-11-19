import { emptyKitty, type Kitty } from "./kitty";

export const STORE_VERSION = 6;

/** v1 had no saved teams or tournaments, v2 no remembered setup, v3 no series or player details, v4 no kitty, v5 no player groups. */
export const migrate = (old: unknown) => {
  const s = (old ?? {}) as { kitty?: Partial<Kitty> };
  return { teams: [], cups: [], cupId: null, player: null, lastSetup: null, series: [], infos: {}, groups: [], ...(old as object), kitty: { ...emptyKitty(), ...s.kitty } };
};
