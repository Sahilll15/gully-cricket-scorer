import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as E from "./engine/engine";
import type { BallInput, Ev, Match, Player } from "./engine/types";
import type { SavedTeam, Tournament } from "./engine/tournament";
import { track } from "./track";

export type Screen = "home" | "setup" | "live" | "scorecard" | "result" | "stats" | "history" | "cups" | "newcup" | "cup" | "teams" | "player" | "watch";

interface Store {
  matches: Match[];
  screen: Screen;
  viewId: string | null;     // match being shown
  redo: Ev[];
  go: (screen: Screen, viewId?: string | null) => void;
  add: (m: Match) => void;
  put: (m: Match) => void;
  remove: (id: string) => void;
  ball: (id: string, input: BallInput) => void;
  undo: (id: string) => void;
  redoBall: (id: string) => void;
  teams: SavedTeam[];
  cups: Tournament[];
  cupId: string | null;
  player: string | null;
  fixture: { cupId: string; fixtureId: string } | null;
  saveTeam: (name: string, players: Player[]) => SavedTeam;
  putTeam: (t: SavedTeam) => void;
  removeTeam: (id: string) => void;
  putCup: (t: Tournament) => void;
  removeCup: (id: string) => void;
  openPlayer: (name: string) => void;
  playFixture: (cupId: string, fixtureId: string) => void;
  watchCode: string | null;
  watchKey: string | null;
  watchMatch: (code: string, key?: string | null) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const put = (m: Match) => set({ matches: get().matches.map((x) => (x.id === m.id ? m : x)) });
      const find = (id: string) => get().matches.find((m) => m.id === id)!;
      return {
        matches: [],
        screen: "home",
        viewId: null,
        redo: [],
        go: (screen, viewId) => {
          set({ screen, viewId: viewId === undefined ? get().viewId : viewId });
          window.scrollTo(0, 0);
        },
        add: (m) => {
          set({ matches: [m, ...get().matches], viewId: m.id, redo: [], fixture: null });
          if (m.cup) {
            const c = get().cups.find((x) => x.id === m.cup!.id);
            if (c) get().putCup({ ...c, fixtures: c.fixtures.map((f) => (f.id === m.cup!.fixtureId ? { ...f, matchId: m.id } : f)) });
          }
        },
        put,
        remove: (id) => set({
          matches: get().matches.filter((m) => m.id !== id),
          cups: get().cups.map((c) => ({ ...c, fixtures: c.fixtures.map((f) => (f.matchId === id ? { ...f, matchId: null } : f)) })),
        }),
        teams: [],
        cups: [],
        cupId: null,
        player: null,
        fixture: null,
        saveTeam: (name, players) => {
          const key = name.trim().toLowerCase(), have = get().teams.find((t) => t.name.toLowerCase() === key);
          const named = players.filter((p) => !/^player \d+$/i.test(p.name));
          if (have) {
            const merged = [...have.players, ...named.filter((p) => !have.players.some((q) => q.name.toLowerCase() === p.name.toLowerCase()))];
            const t = { ...have, players: merged };
            get().putTeam(t);
            return t;
          }
          const t: SavedTeam = { id: E.uid(), name: name.trim(), players: named };
          set({ teams: [...get().teams, t] });
          return t;
        },
        putTeam: (t) => set({ teams: get().teams.some((x) => x.id === t.id) ? get().teams.map((x) => (x.id === t.id ? t : x)) : [...get().teams, t] }),
        removeTeam: (id) => set({ teams: get().teams.filter((t) => t.id !== id) }),
        putCup: (t) => set({ cups: get().cups.some((x) => x.id === t.id) ? get().cups.map((x) => (x.id === t.id ? t : x)) : [t, ...get().cups] }),
        removeCup: (id) => set({ cups: get().cups.filter((c) => c.id !== id) }),
        openPlayer: (name) => { set({ player: name, screen: "player" }); window.scrollTo(0, 0); },
        watchCode: null,
        watchKey: null,
        watchMatch: (code, key = null) => { track("watch_live", { via: key ? "link" : "code" }); set({ watchCode: code, watchKey: key, screen: "watch" }); window.scrollTo(0, 0); },
        playFixture: (cupId, fixtureId) => { set({ fixture: { cupId, fixtureId }, screen: "setup" }); window.scrollTo(0, 0); },
        ball: (id, input) => { put(E.addBall(find(id), input)); set({ redo: [] }); },
        undo: (id) => {
          const { match, popped } = E.undo(find(id));
          put(match);
          if (popped) set({ redo: [...get().redo, popped] });
        },
        redoBall: (id) => {
          const stack = [...get().redo], ev = stack.pop();
          if (!ev) return;
          put(E.redo(find(id), ev));
          set({ redo: stack });
        },
      };
    },
    {
      name: "gully-scorer", version: 2,
      partialize: (s) => ({ matches: s.matches, screen: s.screen === "watch" ? "home" : s.screen, viewId: s.viewId, teams: s.teams, cups: s.cups, cupId: s.cupId, player: s.player }),
      // v1 had no saved teams or tournaments.
      migrate: (old) => ({ teams: [], cups: [], cupId: null, player: null, ...(old as object) }) as never,
    },
  ),
);

export const useMatch = () => {
  const { matches, viewId } = useStore();
  return matches.find((m) => m.id === viewId) ?? null;
};
