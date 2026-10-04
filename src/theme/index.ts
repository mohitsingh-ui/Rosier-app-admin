import { useMemo } from 'react';
import defaults from '../config/defaults.json';
import { useContent } from '../config/remote';
import { useApp } from '../store/app';
import { useColorScheme } from 'react-native';

export const fonts = {
  serif: 'Brygada1918_600SemiBold',
  serifBold: 'Brygada1918_700Bold',
  serifRegular: 'Brygada1918_400Regular',
  sans: 'Poppins_400Regular',
  sansMedium: 'Poppins_500Medium',
  sansSemi: 'Poppins_600SemiBold',
  sansBold: 'Poppins_700Bold',
  sansLight: 'Poppins_300Light',
};

const light = {
  mode: 'light' as 'light' | 'dark',
  bg: '#FFFBF5',
  bgAlt: '#FBEBD8',
  header: '#FBE6CF',
  card: '#F7EEE4',
  cardStrong: '#FFFFFF',
  border: '#EFDCC6',
  text: '#2B1A10',
  textSoft: '#7A6453',
  textMute: '#A8927F',
  heading: '#9A5B22',
  primary: '#A56312',
  accent: '#C47A48',
  deep: '#3E2415',
  deepAlt: '#5A3520',
  gold: '#D9A441',
  goldSoft: '#F3D48B',
  price: '#9B2C1F',
  green: '#2F8A3E',
  greenSoft: '#E4F2E1',
  mint: '#D9F2D5',
  tabBar: '#E9D4BA',
  danger: '#E3823F',
  overlay: 'rgba(30,18,10,0.55)',
  shadow: '#5A3520',
};

const dark: typeof light = {
  mode: 'dark',
  bg: '#1B1714',
  bgAlt: '#241E1A',
  header: '#241E1A',
  card: '#2C2521',
  cardStrong: '#332A25',
  border: '#3D322B',
  text: '#F6EDE3',
  textSoft: '#C9B8A8',
  textMute: '#8F7D6E',
  heading: '#D8A15A',
  primary: '#D8A15A',
  accent: '#C47A48',
  deep: '#0F0C0A',
  deepAlt: '#3E2415',
  gold: '#E2B254',
  goldSoft: '#6B5320',
  price: '#F08A6F',
  green: '#4CAF50',
  greenSoft: '#233524',
  mint: '#233524',
  tabBar: '#2A221D',
  danger: '#E3823F',
  overlay: 'rgba(0,0,0,0.65)',
  shadow: '#000000',
};

export type Theme = typeof light;
export const themes = { light, dark };

const isColor = (v: unknown): v is string => typeof v === 'string' && (/^#[0-9a-f]{3,8}$/i.test(v.trim()) || /^rgba?\(/i.test(v.trim()));

/** Colours: the built-in palette, with anything set in the admin panel (Theme) on top. */
export function useTheme(): Theme {
  const pref = useApp((s) => s.themePref);
  const system = useColorScheme();
  const mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const over = useContent('theme')[mode === 'dark' ? 'dark' : 'light'] as Record<string, unknown> | undefined;
  return useMemo(() => {
    const base = mode === 'dark' ? dark : light;
    if (!over) return base;
    const out: Theme = { ...base };
    for (const [k, v] of Object.entries(over)) if (k in base && k !== 'mode' && isColor(v)) (out as any)[k] = v.trim();
    return out;
  }, [mode, over]);
}

export type Layout = (typeof defaults)['theme']['layout'];
const LIMITS: Record<keyof Layout, [number, number]> = {
  heroCardHeight: [120, 420],
  heroImageRatio: [0, 4],
  heroRadius: [0, 40],
  carouselSeconds: [0, 30],
  tileRatio: [0.2, 2],
  tileRadius: [0, 40],
  categoryTile: [48, 120],
  categoryIcon: [24, 100],
  dealCardWidth: [110, 260],
  productImageRatio: [0.5, 1.6],
  cardRadius: [0, 40],
  imageBannerRadius: [0, 40],
  sectionSpacing: [0, 3],
};

/** Sizes set in the admin panel (Theme → Sizes), kept within sensible limits. */
export function useLayout(): Layout {
  const raw = useContent('theme').layout as Partial<Layout> | undefined;
  return useMemo(() => {
    const out = { ...defaults.theme.layout };
    for (const k of Object.keys(LIMITS) as (keyof Layout)[]) {
      const n = Number(raw?.[k]);
      if (Number.isFinite(n)) out[k] = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], n));
    }
    return out;
  }, [raw]);
}

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const space = (n: number) => n * 4;
