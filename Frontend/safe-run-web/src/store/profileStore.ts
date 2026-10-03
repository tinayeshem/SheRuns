import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RouteMode = "fastest" | "safest" | "scenic";
export type Contact = { name: string; phone: string };

type ProfileState = {
  traits: string[];
  routeMode: RouteMode;
  contacts: Contact[];
  completed: boolean;
  saveProfile: (data: {
    traits: string[];
    routeMode: RouteMode;
    contacts: Contact[];
  }) => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      traits: [],
      routeMode: "safest",
      contacts: [],
      completed: false,
      saveProfile: (data) => set({ ...data, completed: true }),
    }),
    { name: "safe-run-profile" }
  )
);