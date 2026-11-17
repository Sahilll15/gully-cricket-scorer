import type { Match } from "./engine/types";
import type { SavedTeam, Tournament } from "./engine/tournament";
import type { Series } from "./engine/series";
import type { PlayerInfo } from "./playerInfo";
import { emptyKitty, type Kitty, type KittyBackup } from "./kitty";
import { mergePlayers, undoMerge, type MergeUndo } from "./merge";
import type { NextGame } from "./nextGame";

interface Slice {
  matches: Match[]; teams: SavedTeam[]; cups: Tournament[]; series: Series[]; infos: Record<string, PlayerInfo>; kitty: Kitty;
  player: string | null; nextGame: NextGame | null; lastMerge: MergeUndo | null;
}

export interface ExtraActions {
  setNextGame: (g: NextGame | null) => void;
  mergePlayers: (from: string, into: string) => void;
  undoMerge: () => void;
  restoreBackup: (b: KittyBackup) => void;
  snapshot: () => KittyBackup;
}

/** Next game, player merge and file restore; both stores spread this in so the web and the app behave the same. */
export function extraActions(get: () => Slice, set: (p: Partial<Slice>) => void): ExtraActions {
  const low = (n: string | null) => n?.trim().toLowerCase();
  return {
    setNextGame: (g) => set({ nextGame: g }),
    mergePlayers: (from, into) => {
      const s = get(), { roster, undo } = mergePlayers(s, from, into);
      set({ ...roster, lastMerge: undo, player: low(s.player) === low(from) ? into.trim() : s.player });
    },
    undoMerge: () => {
      const s = get(), u = s.lastMerge;
      if (!u) return;
      set({ ...undoMerge(s, u), lastMerge: null });
    },
    restoreBackup: (b) => set({ matches: b.matches, teams: b.teams, cups: b.cups, series: b.series ?? [], infos: b.infos ?? {}, kitty: b.kitty ?? emptyKitty() }),
    snapshot: () => { const s = get(); return { v: 1, matches: s.matches, teams: s.teams, cups: s.cups, series: s.series, infos: s.infos, kitty: s.kitty }; },
  };
}
