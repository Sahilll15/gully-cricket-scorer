export const STORE_VERSION = 4;

/** v1 had no saved teams or tournaments, v2 no remembered setup, v3 no series or player details. */
export const migrate = (old: unknown) =>
  ({ teams: [], cups: [], cupId: null, player: null, lastSetup: null, series: [], infos: {}, ...(old as object) });
