import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from './storage';

type ThemePref = 'light' | 'dark' | 'system';

type AppState = {
  hydrated: boolean;
  onboarded: boolean;
  /** Which version of the intro slides this person has seen (admin can raise it to show them again). */
  introVersion?: number;
  name: string;
  phone: string;
  email: string;
  photo: string | null;
  themePref: ThemePref;
  /** The customer turned off seasonal effects (snow, sparkles…) in Profile. */
  effectsOff: boolean;
  menuOpen: boolean;
  notifications: { id: string; title: string; body: string; time: number; read: boolean; link?: string }[];
  setOnboarded: (v: boolean) => void;
  setIntroVersion: (v: number) => void;
  setProfile: (p: Partial<Pick<AppState, 'name' | 'phone' | 'email'>>) => void;
  setThemePref: (t: ThemePref) => void;
  setEffectsOff: (v: boolean) => void;
  setPhoto: (uri: string | null) => void;
  setMenuOpen: (v: boolean) => void;
  pushNotification: (title: string, body: string, opts?: { id?: string; link?: string }) => void;
  markAllRead: () => void;
  logout: () => void;
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboarded: false,
      name: '',
      phone: '',
      email: '',
      photo: null,
      themePref: 'light',
      effectsOff: false,
      menuOpen: false,
      // The welcome message (editable in the admin panel) is added on first launch — see _layout.tsx.
      notifications: [],
      setOnboarded: (v) => set({ onboarded: v }),
      setIntroVersion: (v) => set({ introVersion: v }),
      setProfile: (p) => set(p),
      setThemePref: (t) => set({ themePref: t }),
      setEffectsOff: (v) => set({ effectsOff: v }),
      setPhoto: (uri) => set({ photo: uri }),
      setMenuOpen: (v) => set({ menuOpen: v }),
      pushNotification: (title, body, opts) =>
        set((s) => ({
          notifications: [
            { id: opts?.id ?? String(Date.now()), title, body, time: Date.now(), read: false, link: opts?.link },
            ...s.notifications,
          ].slice(0, 30),
        })),
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      logout: () => set({ onboarded: false, menuOpen: false }),
    }),
    {
      name: 'rosier-app',
      storage,
      partialize: ({ hydrated, menuOpen, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        useApp.setState({ hydrated: true });
      },
    },
  ),
);
