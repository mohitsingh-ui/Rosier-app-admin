import { Ionicons } from '@expo/vector-icons';
import { Image, ImageProps } from 'expo-image';
import { router } from 'expo-router';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveImage } from '../data/catalog';
import { tap } from '../lib/haptics';
import { fonts, radius, useTheme } from '../theme';

/* ───────── Text ───────── */

type Variant = 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'small' | 'tiny' | 'label';
const variantStyle: Record<Variant, TextStyle> = {
  h1: { fontFamily: fonts.serifBold, fontSize: 30, lineHeight: 36 },
  h2: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 },
  h3: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 25 },
  title: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  small: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17 },
  tiny: { fontFamily: fonts.sansMedium, fontSize: 10, lineHeight: 14 },
  label: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
};

export function Txt({
  v = 'body',
  color,
  style,
  ...rest
}: TextProps & { v?: Variant; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const base = v.startsWith('h') ? t.heading : t.text;
  return <Text {...rest} style={[variantStyle[v], { color: color ?? base }, style]} />;
}

/* ───────── Pressable with spring scale ───────── */

const OUTER_KEYS = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth', 'position', 'top', 'left', 'right', 'bottom', 'zIndex']);

export function PressableScale({
  children,
  style,
  scaleTo = 0.95,
  haptic = true,
  onPress,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean; children?: ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  // Layout props belong on the outer Pressable so flex/alignSelf/absolute positioning behave.
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = {};
  for (const k of Object.keys(flat)) {
    if (OUTER_KEYS.has(k) || k.startsWith('margin')) outer[k] = flat[k];
    else inner[k] = flat[k];
  }
  return (
    <Pressable
      {...rest}
      style={outer}
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, { damping: 15, stiffness: 400 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 10, stiffness: 300 });
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) tap();
        onPress?.(e);
      }}
    >
      <Animated.View style={[inner, a]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ───────── Button ───────── */

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  style,
  disabled,
  small,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'dark' | 'ghost' | 'gold' | 'light';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  small?: boolean;
}) {
  const t = useTheme();
  const bg = { primary: t.accent, dark: t.deepAlt, ghost: 'transparent', gold: t.gold, light: t.cardStrong }[kind];
  const fg = { primary: '#fff', dark: '#FBE6CF', ghost: t.primary, gold: '#3E2415', light: t.text }[kind];
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      style={[
        {
          backgroundColor: bg,
          height: small ? 40 : 54,
          borderRadius: small ? 12 : 18,
          paddingHorizontal: small ? 14 : 22,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.45 : 1,
          borderWidth: kind === 'ghost' ? 1.5 : 0,
          borderColor: t.primary,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={small ? 16 : 20} color={fg} />}
      <Text style={{ color: fg, fontFamily: fonts.sansSemi, fontSize: small ? 13 : 16 }}>{label}</Text>
    </PressableScale>
  );
}

/* ───────── Product image with fade-in ───────── */

export function Img({ source, size, ...rest }: { source?: string; size?: number } & Omit<ImageProps, 'source'>) {
  let uri: string | undefined = resolveImage(source);
  if (uri && size && uri.includes('cdn.shopify.com')) {
    uri = `${uri}${uri.includes('?') ? '&' : '?'}width=${Math.round(size * 2)}`;
  } else if (uri && size && /\/img\/[\w-]+$/.test(uri)) {
    // Images uploaded in the admin panel can be resized by the backend too.
    uri = `${uri}?w=${Math.min(2000, Math.round(size * 3))}`;
  }
  const props = { transition: 250, contentFit: 'contain', cachePolicy: 'memory-disk', ...rest } as ImageProps;
  return <Image {...props} source={uri ? { uri } : undefined} />;
}

/* ───────── Screen header with back ───────── */

export function ScreenHeader({ title, right, transparent }: { title?: string; right?: ReactNode; transparent?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 16,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: transparent ? 'transparent' : t.bg,
      }}
    >
      <PressableScale
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card }}
      >
        <Ionicons name="chevron-back" size={22} color={t.text} />
      </PressableScale>
      <Txt v="h3" color={t.text} style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
        {title}
      </Txt>
      <View style={{ minWidth: 42, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/* ───────── Section header ───────── */

export function SectionHeader({ title, action, onAction, style, titleStyle }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>; titleStyle?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 }, style]}>
      <Txt v="h2" style={titleStyle}>{title}</Txt>
      {action && (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={{ fontFamily: fonts.serifRegular, color: t.heading, fontSize: 15 }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ───────── Chip ───────── */

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        height: 38,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: active ? t.deepAlt : t.card,
        borderWidth: 1,
        borderColor: active ? t.deepAlt : t.border,
      }}
    >
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: active ? '#FBE6CF' : t.text }}>{label}</Text>
    </PressableScale>
  );
}

/* ───────── Qty stepper ───────── */

export function QtyStepper({ qty, onChange, compact }: { qty: number; onChange: (n: number) => void; compact?: boolean }) {
  const t = useTheme();
  const size = compact ? 26 : 32;
  const btn = (icon: 'remove' | 'add', delta: number) => (
    <PressableScale
      onPress={() => onChange(qty + delta)}
      style={{ width: size, height: size, borderRadius: 8, borderWidth: 1.2, borderColor: t.accent, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={compact ? 14 : 16} color={t.accent} />
    </PressableScale>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {btn('remove', -1)}
      <AnimatedCount value={qty} style={{ fontFamily: fonts.sansSemi, fontSize: 16, color: t.text, minWidth: 18, textAlign: 'center' }} />
      {btn('add', 1)}
    </View>
  );
}

/** Number that pops when it changes. */
export function AnimatedCount({ value, style }: { value: number; style?: StyleProp<TextStyle> }) {
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    s.value = 1.35;
    s.value = withSpring(1, { damping: 8, stiffness: 250 });
  }, [value]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.Text style={[style, a]}>{value}</Animated.Text>;
}

/** Counts up from 0 (or the last value) to `value`. */
export function CountUp({ value, style, duration = 900, format = (n: number) => n.toLocaleString('en-IN') }: { value: number; style?: StyleProp<TextStyle>; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <Text style={style}>{format(shown)}</Text>;
}

/* ───────── Skeleton shimmer ───────── */

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0.45, 1]) }));
  return <Animated.View style={[{ backgroundColor: t.card, borderRadius: 12 }, style, a]} />;
}

/* ───────── Empty state ───────── */

export function EmptyState({ icon, title, body, cta, onCta }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; cta?: string; onCta?: () => void }) {
  const t = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(-8, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 10 }}>
      <Animated.View style={[{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, a]}>
        <Ionicons name={icon} size={42} color={t.primary} />
      </Animated.View>
      <Txt v="h3" style={{ textAlign: 'center' }}>{title}</Txt>
      <Txt v="body" color={t.textSoft} style={{ textAlign: 'center', maxWidth: 280 }}>{body}</Txt>
      {cta && <Button label={cta} onPress={onCta} style={{ marginTop: 12, alignSelf: 'stretch' }} />}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  shadow: {
    shadowColor: '#5A3520',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
