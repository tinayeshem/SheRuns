import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Color } from "../routing/types";

export type RunRecord = {
  id: string;
  startedAt: number;
  durationSec: number;
  distanceKm: number; // measured by GPS
  plannedKm: number;
  score: number; // safety score of the planned route
  color: Color;
  weakest: string | null;
};

type HistoryState = {
  runs: RunRecord[]; // newest first
  addRun: (r: Omit<RunRecord, "id">) => void;
  removeRun: (id: string) => void;
  clear: () => void;
};

const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      runs: [],
      addRun: (r) =>
        set((s) => ({ runs: [{ ...r, id: newId() }, ...s.runs].slice(0, 200) })),
      removeRun: (id) => set((s) => ({ runs: s.runs.filter((x) => x.id !== id) })),
      clear: () => set({ runs: [] }),
    }),
    { name: "safe-run-history" }
  )
);