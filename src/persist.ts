import { emptyKitty, type Kitty } from "./kitty";

export const STORE_VERSION = 5;

/** v1 had no saved teams or tournaments, v2 no remembered setup, v3 no series or player details, v4 no kitty. */
export const migrate = (old: unknown) => {
  const s = (old ?? {}) as { kitty?: Partial<Kitty> };
  return { teams: [], cups: [], cupId: null, player: null, lastSetup: null, series: [], infos: {}, ...(old as object), kitty: { ...emptyKitty(), ...s.kitty } };
};
