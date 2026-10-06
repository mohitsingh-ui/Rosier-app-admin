/**
 * Indian festival themes. Switched on only from the admin panel → Festival theme
 * (right away, or on dates set in advance). They recolour the whole app on top of
 * the customer's light / dark mode, add a festive bunting over the bottom bar, a
 * greeting on Home, and can start the matching falling effect (diyas, colours…).
 */
import { useMemo } from 'react';
import { isLive, useContent } from '../config/remote';
import { isColor } from '../lib/color';

type Pal = Partial<Record<'bg' | 'bgAlt' | 'header' | 'card' | 'imageBg' | 'cardStrong' | 'border' | 'heading' | 'primary' | 'accent' | 'price' | 'gold' | 'goldSoft' | 'tabBar' | 'deepAlt', string>>;

export type FestivalPreset = { id: string; name: string; emoji: string; greeting: string; effect: string; bunting: string[]; light: Pal; dark: Pal };

export const FESTIVALS: FestivalPreset[] = [
  {
    id: 'diwali',
    name: 'Diwali',
    emoji: '🪔',
    greeting: 'Happy Diwali! May your home glow with light & sweetness 🪔',
    effect: 'diyas',
    bunting: ['#B8321A', '#E3A82B', '#E86A2B', '#F8D77A'],
    light: { bg: '#FFF8EC', bgAlt: '#FCE9C8', header: '#FBE0B0', card: '#FCEFD9', imageBg: '#FCEFD9', border: '#F0D49A', heading: '#8A1C1C', primary: '#B8321A', accent: '#E08A1E', price: '#8A1C1C', gold: '#E3A82B', goldSoft: '#F8D77A', tabBar: '#F6D79A' },
    dark: { bg: '#1A0F0A', header: '#2A140C', tabBar: '#2E170D', card: '#2B1810', imageBg: '#2B1810', cardStrong: '#331D13', border: '#4A2A18', heading: '#F2B63C', primary: '#F2B63C', accent: '#E86A2B' },
  },
  {
    id: 'holi',
    name: 'Holi',
    emoji: '🎨',
    greeting: 'Happy Holi! Bura na mano, Holi hai 🎨',
    effect: 'holi',
    bunting: ['#FF006E', '#FFBE0B', '#3A86FF', '#8338EC', '#06D6A0'],
    light: { bg: '#FFF9FB', bgAlt: '#FFEAF4', header: '#FFE3F1', card: '#FFF0F7', imageBg: '#FFF0F7', border: '#F7C6DE', heading: '#C2185B', primary: '#D81B60', accent: '#7C4DFF', price: '#C2185B', gold: '#FFB300', goldSoft: '#FFE082', tabBar: '#FFD6EC' },
    dark: { header: '#2A1424', tabBar: '#2E1528', border: '#4A2440', heading: '#FF6FB5', primary: '#FF6FB5', accent: '#B39DFF' },
  },
  {
    id: 'navratri',
    name: 'Navratri',
    emoji: '💃',
    greeting: 'Happy Navratri! Nine nights of garba, faith & joy 💃',
    effect: 'sparkles',
    bunting: ['#D84315', '#FBC02D', '#6A1B9A', '#2E7D32', '#E91E63', '#1565C0'],
    light: { bg: '#FFFBF0', bgAlt: '#FFF1D6', header: '#FFE7C2', card: '#FFF1DA', imageBg: '#FFF1DA', border: '#F7D49A', heading: '#B71C1C', primary: '#D84315', accent: '#6A1B9A', price: '#B71C1C', tabBar: '#FFD9A0' },
    dark: { header: '#2B170C', tabBar: '#2F1A0D', heading: '#FFB74D', primary: '#FF8A50', accent: '#CE93D8' },
  },
  {
    id: 'durga_puja',
    name: 'Durga Puja',
    emoji: '🌺',
    greeting: 'Shubho Pujo! Joy, dhak & bhog all around 🌺',
    effect: 'petals',
    bunting: ['#C1121F', '#FFFFFF', '#E09F3E'],
    light: { bg: '#FFFDFB', bgAlt: '#FDEDEA', header: '#FDE3DD', card: '#FFF1EE', imageBg: '#FFF1EE', border: '#F2C2B8', heading: '#A4161A', primary: '#C1121F', accent: '#E09F3E', price: '#A4161A', tabBar: '#F9CFC6' },
    dark: { header: '#2A1012', tabBar: '#2E1114', border: '#4A1E22', heading: '#FF7B7B', primary: '#FF6B6B', accent: '#F2C46D' },
  },
  {
    id: 'dussehra',
    name: 'Dussehra',
    emoji: '🏹',
    greeting: 'Happy Dussehra! May good always win 🏹',
    effect: 'sparkles',
    bunting: ['#E65100', '#FFC107', '#B71C1C'],
    light: { bg: '#FFFAF2', header: '#FFE6C7', card: '#FFF0DC', imageBg: '#FFF0DC', border: '#F5CF9C', heading: '#BF360C', primary: '#E65100', accent: '#B71C1C', tabBar: '#FFD8A8' },
    dark: { header: '#2B160A', tabBar: '#2F180B', heading: '#FFB74D', primary: '#FF9800', accent: '#FF7043' },
  },
  {
    id: 'ganesh',
    name: 'Ganesh Chaturthi',
    emoji: '🙏',
    greeting: 'Ganpati Bappa Morya! 🙏 Wishing you a sweet Ganesh Chaturthi',
    effect: 'petals',
    bunting: ['#EA580C', '#FACC15', '#DC2626', '#16A34A'],
    light: { bg: '#FFFAF3', header: '#FFE5CC', card: '#FFF0E0', imageBg: '#FFF0E0', border: '#F6CFA4', heading: '#C2410C', primary: '#EA580C', accent: '#DC2626', tabBar: '#FFD3A8' },
    dark: { header: '#2B160B', tabBar: '#2F170C', heading: '#FDBA74', primary: '#FB923C', accent: '#F87171' },
  },
  {
    id: 'rakhi',
    name: 'Raksha Bandhan',
    emoji: '🎀',
    greeting: 'Happy Raksha Bandhan! Celebrate the bond 🎀',
    effect: 'sparkles',
    bunting: ['#C2185B', '#F9A825', '#FF80AB'],
    light: { bg: '#FFF9FB', header: '#FCE4EC', card: '#FFF0F5', imageBg: '#FFF0F5', border: '#F5C2D5', heading: '#AD1457', primary: '#C2185B', accent: '#F9A825', tabBar: '#F8BBD0' },
    dark: { header: '#2A121D', tabBar: '#2E1320', heading: '#F48FB1', primary: '#F06292', accent: '#FFD54F' },
  },
  {
    id: 'independence',
    name: 'Independence / Republic Day',
    emoji: '🇮🇳',
    greeting: 'Jai Hind! Proud to be made in Bharat 🇮🇳',
    effect: 'confetti',
    bunting: ['#FF9933', '#FFFFFF', '#138808'],
    light: { bg: '#FFFFFF', bgAlt: '#FFF4EA', header: '#FFE8D1', card: '#F7F8F2', imageBg: '#F7F8F2', border: '#E6E6DD', heading: '#0B3D91', primary: '#FF7722', accent: '#138808', price: '#0B3D91', tabBar: '#DFF3E0' },
    dark: { header: '#1E1A14', tabBar: '#16231A', heading: '#FF9933', primary: '#FF9933', accent: '#4CAF50' },
  },
  {
    id: 'janmashtami',
    name: 'Janmashtami',
    emoji: '🦚',
    greeting: 'Happy Janmashtami! Makhan, mishri & Krishna’s blessings 🦚',
    effect: 'sparkles',
    bunting: ['#1565C0', '#00897B', '#F9A825'],
    light: { bg: '#F8FBFF', header: '#E3F2FD', card: '#EEF6FF', imageBg: '#EEF6FF', border: '#C7DDF5', heading: '#0D47A1', primary: '#1565C0', accent: '#F9A825', tabBar: '#BBDEFB' },
    dark: { header: '#101C2A', tabBar: '#11202F', border: '#22364B', heading: '#90CAF9', primary: '#64B5F6', accent: '#FFD54F' },
  },
  {
    id: 'sankranti',
    name: 'Makar Sankranti / Pongal / Lohri',
    emoji: '🪁',
    greeting: 'Happy Sankranti! Til-gud ghya, god god bola 🪁',
    effect: 'kites',
    bunting: ['#E65100', '#0288D1', '#FDD835', '#43A047'],
    light: { bg: '#FBFEFF', header: '#E1F5FE', card: '#F1F9FF', imageBg: '#F1F9FF', border: '#CDE8F7', heading: '#BF360C', primary: '#E65100', accent: '#0288D1', tabBar: '#FFE0B2' },
    dark: { header: '#12202A', tabBar: '#2A190D', heading: '#FFB74D', primary: '#FF9800', accent: '#4FC3F7' },
  },
  {
    id: 'onam',
    name: 'Onam',
    emoji: '🌼',
    greeting: 'Happy Onam! A sadya full of happiness 🌼',
    effect: 'petals',
    bunting: ['#F9A825', '#FFFFFF', '#2E7D32'],
    light: { bg: '#FFFEF5', header: '#FFF6D6', card: '#FDF8E4', imageBg: '#FDF8E4', border: '#EEE3B5', heading: '#2E7D32', primary: '#33691E', accent: '#F9A825', tabBar: '#E8F5C8' },
    dark: { header: '#1B2214', tabBar: '#1D2615', heading: '#AED581', primary: '#9CCC65', accent: '#FFD54F' },
  },
  {
    id: 'eid',
    name: 'Eid',
    emoji: '🌙',
    greeting: 'Eid Mubarak! Wishing you peace & sweet sevaiyan 🌙',
    effect: 'sparkles',
    bunting: ['#00695C', '#C9A227', '#FFFFFF'],
    light: { bg: '#F8FFFD', header: '#E0F2F1', card: '#EEF8F6', imageBg: '#EEF8F6', border: '#C3E3DE', heading: '#004D40', primary: '#00695C', accent: '#C9A227', tabBar: '#B2DFDB' },
    dark: { header: '#0F2220', tabBar: '#102523', heading: '#80CBC4', primary: '#4DB6AC', accent: '#E6C35C' },
  },
  {
    id: 'baisakhi',
    name: 'Baisakhi',
    emoji: '🌾',
    greeting: 'Happy Baisakhi! A golden harvest to all 🌾',
    effect: 'leaves',
    bunting: ['#F57F17', '#2E7D32', '#FDD835'],
    light: { bg: '#FFFDF4', header: '#FFF8E1', card: '#FFF6DC', imageBg: '#FFF6DC', border: '#F2E2A8', heading: '#E65100', primary: '#F57F17', accent: '#2E7D32', tabBar: '#FFECB3' },
    dark: { header: '#2A2210', tabBar: '#2C2411', heading: '#FFD54F', primary: '#FFB300', accent: '#81C784' },
  },
  {
    id: 'christmas',
    name: 'Christmas & New Year',
    emoji: '🎄',
    greeting: 'Merry Christmas & a happy New Year! 🎄',
    effect: 'snow',
    bunting: ['#C62828', '#2E7D32', '#F9A825'],
    light: { bg: '#FFFDFB', header: '#FDE7E4', card: '#FFF2EF', imageBg: '#FFF2EF', border: '#F1CFC9', heading: '#B71C1C', primary: '#C62828', accent: '#2E7D32', tabBar: '#DCEFD9' },
    dark: { header: '#2A1313', tabBar: '#132516', heading: '#EF9A9A', primary: '#EF5350', accent: '#81C784' },
  },
];

export type ActiveFestival = FestivalPreset & { greetingText: string; showGreeting: boolean; showBunting: boolean; effectType: string };

/** The festival theme that's on right now (admin panel → Festival theme), or null. */
export function useFestival(): ActiveFestival | null {
  const f = (useContent('festival' as any) ?? {}) as any;
  return useMemo(() => {
    if (!f || f.mode === 'off' || !f.mode) return null;
    let pick: any = null;
    if (f.mode === 'now') pick = { preset: f.preset, greeting: f.greeting };
    else if (f.mode === 'schedule') pick = (f.schedule ?? []).find((s: any) => s && s.enabled !== false && s.preset && (s.startAt || s.endAt) && isLive(s));
    if (!pick) return null;
    const p = FESTIVALS.find((x) => x.id === pick.preset);
    if (!p) return null;
    const own = (k: string) => (isColor(f[k]) ? String(f[k]).trim() : undefined);
    const light = { ...p.light, ...(own('primaryColor') && { primary: own('primaryColor') }), ...(own('accentColor') && { accent: own('accentColor') }), ...(own('headerColor') && { header: own('headerColor') }), ...(own('tabBarColor') && { tabBar: own('tabBarColor') }), ...(own('bgColor') && { bg: own('bgColor') }) };
    return {
      ...p,
      light,
      greetingText: String(pick.greeting || f.greeting || p.greeting),
      showGreeting: f.showGreeting !== false,
      showBunting: f.showBunting !== false,
      effectType: f.effect === 'none' ? '' : f.effect && f.effect !== 'auto' ? String(f.effect) : p.effect,
    };
  }, [f]);
}
