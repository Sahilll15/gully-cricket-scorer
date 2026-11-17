import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Per-match choices for this phone only: they never go into the match or out to viewers. */
export interface LivePrefs { wagon?: boolean; speak?: boolean; turfEnd?: number | null }

interface PrefsStore { prefs: Record<string, LivePrefs>; setPrefs: (id: string, p: Partial<LivePrefs>) => void }

export const useLivePrefs = create<PrefsStore>()(persist((set, get) => ({
  prefs: {},
  setPrefs: (id, p) => set({ prefs: { ...get().prefs, [id]: { ...get().prefs[id], ...p } } }),
}), { name: "gully-live-prefs", storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ prefs: s.prefs }) }));
