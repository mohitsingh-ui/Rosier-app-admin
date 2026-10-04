/**
 * Remote content — everything the admin panel controls.
 *
 * The app ships with `defaults.json` (exactly what the app looked like before the
 * backend existed), downloads the published content from the backend on launch and
 * whenever it comes back to the foreground, and caches it for offline use.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../store/storage';
import defaults from './defaults.json';
import { applyCoins } from './coins';

export type Content = typeof defaults;
export type SectionKey = keyof Content;

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
/**
 * The backend. The web copy of the app (the admin panel's phone preview) is served by
 * the backend itself, so on web it talks to whatever site it was opened from.
 */
const webOrigin = Platform.OS === 'web' && typeof window !== 'undefined' && /^https?:/.test(window.location?.origin ?? '') ? window.location.origin : '';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || webOrigin || extra.apiUrl || '').replace(/\/$/, '');

/** True when the app runs inside the admin panel's live preview. */
export const IN_EDITOR = Platform.OS === 'web' && typeof window !== 'undefined' && window.parent !== window && /[?&]editor=1/.test(window.location.search + (window.sessionStorage?.getItem('rosier-editor') ?? ''));

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Remote values win; anything missing falls back to the built-in default. */
function merge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined || over === null ? base : over) as T;
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = k in (base as any) ? merge((base as any)[k], v) : v;
  return out as T;
}

export const build = (remote?: Partial<Content>) => {
  const out = {} as Content;
  for (const k of Object.keys(defaults) as SectionKey[]) (out as any)[k] = merge(defaults[k], remote?.[k]);
  return out;
};

export type ShopifyFlags = { loginEnabled: boolean; cartCheckout: boolean; requireLogin: boolean };
const NO_SHOPIFY: ShopifyFlags = { loginEnabled: false, cartCheckout: false, requireLogin: false };

type RemoteState = {
  content: Content;
  /** Which Shopify features are switched on in the admin panel. */
  shopify: ShopifyFlags;
  version: number;
  fetchedAt: number;
  /** Set when an admin opened a "Preview on phone" link — shows unpublished drafts. */
  preview: { token: string; api: string } | null;
  /** Launch-popup bookkeeping: popup id → last time shown. */
  popupSeen: Record<string, number>;
  /** Notification ids already delivered to the inbox. */
  announced: string[];
  loading: boolean;
  refresh: () => Promise<boolean>;
  startPreview: (token: string, api: string) => Promise<boolean>;
  endPreview: () => Promise<void>;
  markPopup: (id: string) => void;
};

export const useRemote = create<RemoteState>()(
  persist(
    (set, get) => ({
      content: build(),
      shopify: NO_SHOPIFY,
      version: 0,
      fetchedAt: 0,
      preview: null,
      popupSeen: {},
      announced: [],
      loading: false,
      refresh: async () => {
        const { preview } = get();
        const api = preview?.api || API_URL;
        // In the admin panel's preview, the editor sends the draft content directly.
        if (!api || get().loading || IN_EDITOR) return false;
        set({ loading: true });
        try {
          const url = `${api}/api/app/config${preview ? `?preview=${encodeURIComponent(preview.token)}` : ''}`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (res.status === 401 && preview) {
            // Preview link expired — fall back to the live app.
            set({ preview: null });
            set({ loading: false });
            return get().refresh();
          }
          if (!res.ok) throw new Error(String(res.status));
          const json = await res.json();
          const content = build(json.content);
          applyCoins(content.coins);
          set({ content, shopify: { ...NO_SHOPIFY, ...(json.shopify ?? {}) }, version: json.version ?? 0, fetchedAt: Date.now() });
          return true;
        } catch {
          return false; // Offline — keep the cached content.
        } finally {
          set({ loading: false });
        }
      },
      startPreview: async (token, api) => {
        set({ preview: { token, api: (api || API_URL).replace(/\/$/, '') } });
        return get().refresh();
      },
      endPreview: async () => {
        set({ preview: null });
        await get().refresh();
      },
      markPopup: (id) => set((s) => ({ popupSeen: { ...s.popupSeen, [id]: Date.now() } })),
    }),
    {
      name: 'rosier-remote',
      storage,
      partialize: ({ content, shopify, version, fetchedAt, preview, popupSeen, announced }) => ({ content, shopify, version, fetchedAt, preview, popupSeen, announced }),
      // Re-merge cached content with defaults in case this app version added new fields.
      merge: (persisted: any, current) => {
        const next = { ...current, ...(persisted ?? {}) } as RemoteState;
        next.content = build(persisted?.content);
        next.shopify = { ...NO_SHOPIFY, ...(persisted?.shopify ?? {}) };
        applyCoins(next.content.coins);
        return next;
      },
    },
  ),
);

export function useContent<K extends SectionKey>(key: K): Content[K] {
  return useRemote((s) => s.content[key]);
}

export const getContent = <K extends SectionKey>(key: K): Content[K] => useRemote.getState().content[key];

/** Is a scheduled item live right now? Empty dates mean "no limit". */
export function isLive(item: { enabled?: boolean; startAt?: string; endAt?: string }) {
  if (item.enabled === false) return false;
  const now = Date.now();
  if (item.startAt && Date.parse(item.startAt) > now) return false;
  if (item.endAt && Date.parse(item.endAt) < now) return false;
  return true;
}

/** Fill {per100}, {pendingDays}, {welcomeBonus}… placeholders in admin text. */
export function fill(text: string, vars?: Record<string, string | number>) {
  const c = getContent('coins');
  const all: Record<string, string | number> = {
    per100: Math.round(c.earnPerRupee * 100),
    pendingDays: c.pendingDays,
    welcomeBonus: c.welcomeBonus,
    reviewBonus: c.reviewBonus,
    referralBonus: c.referralBonus,
    minCart: c.minCartForVoucher,
    ...vars,
  };
  return String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k]) : m));
}

/** Compare dotted versions: -1 if a < b. */
export function compareVersions(a: string, b: string) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
