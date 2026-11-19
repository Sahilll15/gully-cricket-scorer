import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as E from "@shared/engine/engine";
import type { BallInput, Ev, Match, Player, Rules } from "@shared/engine/types";
import type { SavedTeam, Tournament } from "@shared/engine/tournament";
import type { Series } from "@shared/engine/series";
import type { Fmt } from "@shared/stats";
import type { PlayerInfo } from "@shared/playerInfo";
import { migrate, STORE_VERSION } from "@shared/persist";
import { emptyKitty, type Kitty } from "@shared/kitty";
import { kittyActions, type KittyActions } from "@shared/kittyView";
import { extraActions, type ExtraActions } from "@shared/storeExtras";
import type { NextGame } from "@shared/nextGame";
import type { PlayerGroup } from "@shared/groups";
import type { MergeUndo } from "@shared/merge";
import { track } from "./track";
import { EV } from "@shared/events";
import { matchEvents } from "@shared/matchEvents";
import { navigate } from "./nav";

/** What the last match was set up with, so the next one starts filled in. */
export interface LastSetup { a: string; b: string; na: string[]; nb: string[]; size: number; sa?: number; sb?: number; rules: Rules; common: string }

export type Screen = "home" | "setup" | "live" | "scorecard" | "result" | "stats" | "history" | "cups" | "newcup" | "cup" | "teams" | "player" | "watch" | "join" | "series" | "newseries" | "book" | "kitty";

/** Never goes backwards, so a phone with a slow clock still wins once it adopts the newer copy. */
export const stamp = (m: Match, prev?: Match): Match => ({ ...m, editedAt: Math.max(Date.now(), (prev?.editedAt ?? 0) + 1) });

interface Store extends KittyActions, ExtraActions {
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
  adopt: (m: Match) => void;
  joinCode: string | null;
  joinKey: JsonWebKey | null;
  joinToken: string | null;
  joinScoring: (code: string, key: JsonWebKey, token: string | null) => void;
  lastSetup: LastSetup | null;
  series: Series[];
  seriesId: string | null;      // series being shown
  seriesPlay: string | null;    // series whose next match is being set up
  putSeries: (s: Series) => void;
  removeSeries: (id: string) => void;
  playSeries: (id: string) => void;
  infos: Record<string, PlayerInfo>;
  setInfo: (name: string, info: PlayerInfo) => void;
  fmt: Fmt;                     // stats format shown on the leaderboard and player pages
  cupsTab: "cups" | "series";
  kitty: Kitty;
  groups: PlayerGroup[];
  nextGame: NextGame | null;
  lastMerge: MergeUndo | null;   // kept so the last player merge can be undone
}

/** screen mirrors the top route; nav.ts moves the real stack. */
export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const put = (m: Match) => set({ matches: get().matches.map((x) => (x.id === m.id ? stamp(m, x) : x)) });
      const find = (id: string) => get().matches.find((m) => m.id === id)!;
      // Local changes only: adopt (remote copies) and undo/redo skip this, so nothing is counted twice.
      const putTracked = (m: Match) => {
        const prev = get().matches.find((x) => x.id === m.id);
        put(m);
        if (prev) for (const [name, params] of matchEvents(prev, m)) track(name, params);
      };
      return {
        matches: [],
        screen: "home",
        viewId: null,
        redo: [],
        go: (screen, viewId) => {
          set({ viewId: viewId === undefined ? get().viewId : viewId });
          navigate(screen);
        },
        add: (m) => {
          set({ matches: [m, ...get().matches], viewId: m.id, redo: [], fixture: null, seriesPlay: null });
          if (m.cup) {
            const c = get().cups.find((x) => x.id === m.cup!.id);
            if (c) get().putCup({ ...c, fixtures: c.fixtures.map((f) => (f.id === m.cup!.fixtureId ? { ...f, matchId: m.id } : f)) });
          }
        },
        put: putTracked,
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
        openPlayer: (name) => { set({ player: name }); navigate("player"); },
        watchCode: null,
        watchKey: null,
        lastSetup: null,
        watchMatch: (code, key = null) => { track(EV.watch_live, { via: key ? "link" : "code" }); set({ watchCode: code, watchKey: key }); navigate("watch"); },
        adopt: (m) => set({
          matches: get().matches.some((x) => x.id === m.id) ? get().matches.map((x) => (x.id === m.id ? m : x)) : [m, ...get().matches],
          redo: get().viewId === m.id ? [] : get().redo,
        }),
        joinCode: null,
        joinKey: null,
        joinToken: null,
        joinScoring: (code, key, token) => { set({ joinCode: code, joinKey: key, joinToken: token }); navigate("join"); },
        series: [],
        seriesId: null,
        seriesPlay: null,
        putSeries: (x) => set({ series: get().series.some((y) => y.id === x.id) ? get().series.map((y) => (y.id === x.id ? x : y)) : [x, ...get().series] }),
        removeSeries: (id) => set({ series: get().series.filter((x) => x.id !== id) }),
        playSeries: (id) => { set({ seriesPlay: id, fixture: null }); navigate("setup"); },
        infos: {},
        setInfo: (name, info) => set({ infos: { ...get().infos, [name.trim().toLowerCase()]: info } }),
        fmt: "limited",
        cupsTab: "cups",
        kitty: emptyKitty(),
        ...kittyActions(get, (p) => set(p)),
        groups: [],
        nextGame: null,
        lastMerge: null,
        ...extraActions(get, (p) => set(p)),
        playFixture: (cupId, fixtureId) => { set({ fixture: { cupId, fixtureId }, seriesPlay: null }); navigate("setup"); },
        ball: (id, input) => { putTracked(E.addBall(find(id), input)); set({ redo: [] }); },
        undo: (id) => {
          track(EV.undo);
          const { match, popped } = E.undo(find(id));
          put(match);
          if (popped) set({ redo: [...get().redo, popped] });
        },
        redoBall: (id) => {
          const stack = [...get().redo], ev = stack.pop();
          if (!ev) return;
          track(EV.redo);
          put(E.redo(find(id), ev));
          set({ redo: stack });
        },
      };
    },
    {
      name: "gully-scorer", version: STORE_VERSION, storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ matches: s.matches, screen: s.screen === "watch" || s.screen === "join" ? "home" : s.screen, viewId: s.viewId, teams: s.teams, cups: s.cups, cupId: s.cupId, player: s.player, lastSetup: s.lastSetup,
        series: s.series, seriesId: s.seriesId, seriesPlay: s.seriesPlay, infos: s.infos, fmt: s.fmt, cupsTab: s.cupsTab, groups: s.groups, me: s.me, kitty: s.kitty, nextGame: s.nextGame, lastMerge: s.lastMerge }),
      migrate: (old) => migrate(old) as never,
    },
  ),
);

export const useMatch = () => {
  const { matches, viewId } = useStore();
  return matches.find((m) => m.id === viewId) ?? null;
};
