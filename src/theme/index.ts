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

export function useTheme(): Theme {
  const pref = useApp((s) => s.themePref);
  const system = useColorScheme();
  const mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return mode === 'dark' ? dark : light;
}

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const space = (n: number) => n * 4;
