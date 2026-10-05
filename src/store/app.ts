import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getContent } from '../config/remote';
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
  /** Random id for this install (links app orders and pushes to this phone). */
  deviceId: string;
  /** We asked for notification permission (in-app card) — don't nag again. */
  pushAsked: boolean;
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

/** Whether logging out takes people back to the intro slides. */
export const introAfterLogout = () => {
  try {
    return (getContent('onboarding') as any)?.showAfterLogout !== false;
  } catch {
    return true;
  }
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
      deviceId: '',
      pushAsked: false,
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
      // Logging out shows the intro again (admin panel → Intro slides → "Show the intro again after logout").
      logout: () => set({ menuOpen: false, onboarded: !introAfterLogout() }),
    }),
    {
      name: 'rosier-app',
      storage,
      partialize: ({ hydrated, menuOpen, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        if (!useApp.getState().deviceId) useApp.setState({ deviceId: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}` });
        useApp.setState({ hydrated: true });
      },
    },
  ),
);
