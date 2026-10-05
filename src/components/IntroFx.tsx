/**
 * Colourful layers for the intro slides:
 *  - Aurora: the background colour flows between each slide's colours as you swipe,
 *    with big soft glowing blobs drifting around.
 *  - Sparkles: twinkling stars.
 *  - WordReveal: the title pops in word by word.
 *  - GlowRing: a pulsing ring behind the next button.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { safeColor } from '../lib/color';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, {
  Easing,
  BounceIn,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInUp,
  FlipInXUp,
  interpolate,
  LightSpeedInLeft,
  RotateInDownLeft,
  ZoomInRotate,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export type Palette = string[]; // [background, blob 1, blob 2, blob 3]

const DEFAULTS: Palette[] = [
  ['#FBE3C6', '#FF9F43', '#F368E0', '#FECA57'],
  ['#FFF1D6', '#E1A140', '#FF6B6B', '#48DBFB'],
  ['#FFE8CF', '#F9CA24', '#6AB04C', '#E056FD'],
  ['#F6E1FF', '#A29BFE', '#FD79A8', '#00CEC9'],
];

export const paletteFor = (colors: string[] | undefined, i: number): Palette => {
  const d = DEFAULTS[i % DEFAULTS.length];
  const c = (colors ?? []).filter(Boolean);
  // Bad colours (typos) would crash the colour animation on phones — fall back to the defaults.
  return [safeColor(c[0], d[0]), safeColor(c[1], d[1]), safeColor(c[2], d[2]), safeColor(c[3], d[3])];
};

/** A soft glowing blob (radial gradient) that drifts; each slide has its own, faded in as you swipe to it. */
function Blob({ x, width, index, color, size, left, top, speed, id }: { x: SharedValue<number>; width: number; index: number; color: string; size: number; left: number; top: number; speed: number; id: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 6500 / speed, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => {
    const p = Math.abs(x.value / width - index);
    return {
      opacity: interpolate(p, [0, 1], [1, 0], 'clamp'),
      transform: [
        { translateX: interpolate(t.value, [0, 1], [-34, 44]) },
        { translateY: interpolate(t.value, [0, 1], [24, -40]) },
        { scale: interpolate(t.value, [0, 0.5, 1], [0.88, 1.15, 0.95]) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left, top, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.85} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function Aurora({ x, width, height, palettes }: { x: SharedValue<number>; width: number; height: number; palettes: Palette[] }) {
  const inputs = palettes.map((_, i) => i * width);
  const bg = useAnimatedStyle(() => ({
    backgroundColor: palettes.length > 1 ? interpolateColor(x.value, inputs, palettes.map((p) => p[0])) : palettes[0]?.[0] ?? '#F1DCC3',
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, bg]}>
      {palettes.map((p, i) => (
        <React.Fragment key={i}>
          <Blob id={`b${i}a`} x={x} width={width} index={i} color={p[1]} size={width * 1.15} left={-width * 0.45} top={-height * 0.02} speed={1} />
          <Blob id={`b${i}b`} x={x} width={width} index={i} color={p[2]} size={width * 1.0} left={width * 0.35} top={height * 0.2} speed={1.3} />
          <Blob id={`b${i}c`} x={x} width={width} index={i} color={p[3]} size={width * 0.9} left={-width * 0.1} top={height * 0.55} speed={0.8} />
        </React.Fragment>
      ))}
    </Animated.View>
  );
}

function Spark({ left, top, size, delay, color }: { left: number; top: number; size: number; delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 1100 })), -1, false));
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.4 + v.value * 0.8 }, { rotate: `${v.value * 90}deg` }] }));
  return (
    <Animated.Text pointerEvents="none" style={[{ position: 'absolute', left, top, fontSize: size, color }, a]}>
      ✦
    </Animated.Text>
  );
}

export function Sparkles({ width, height, count = 16 }: { width: number; height: number; count?: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: ((i * 73) % 97) / 100 * width,
        top: ((i * 41) % 89) / 100 * height * 0.75 + 30,
        size: 8 + ((i * 7) % 12),
        delay: (i * 380) % 2600,
        color: ['#FFFFFF', '#FFE08A', '#FFC2E2', '#FFFFFF'][i % 4],
      })),
    [width, height, count],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {dots.map((d, i) => (
        <Spark key={i} {...d} />
      ))}
    </View>
  );
}

/** Title that springs in word by word whenever its slide becomes active. */
export function WordReveal({ text, style, active }: { text: string; style: TextStyle; active: boolean }) {
  const words = String(text || '').split(/(\s+)/);
  if (!active) return <Text style={style}>{text}</Text>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <Text key={i} style={style}>
            {' '}
          </Text>
        ) : (
          <Animated.Text key={i} entering={FadeInUp.delay(i * 55).springify().damping(11)} style={style}>
            {w}
          </Animated.Text>
        ),
      )}
    </View>
  );
}

/** Pulsing glow behind the next / get started button. */
export function GlowRing({ color, size, last }: { color: string; size: number; last: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - v.value), transform: [{ scaleX: 1 + v.value * (last ? 0.15 : 0.5) }, { scaleY: 1 + v.value * 0.5 }] }));
  return <Animated.View pointerEvents="none" entering={ZoomIn} style={[{ position: 'absolute', right: 0, width: size, height: 56, borderRadius: 28, backgroundColor: color }, a]} />;
}


/* ───────── Title animations (admin panel → slide → Title animation) ───────── */

export const TEXT_FX = ['words', 'letters', 'typewriter', 'fade', 'slideUp', 'slideLeft', 'zoom', 'bounce', 'flip', 'swing', 'none'] as const;

function enteringFor(fx: string, i: number) {
  switch (fx) {
    case 'letters':
      return FadeInDown.delay(i * 28).springify().damping(12);
    case 'slideLeft':
      return FadeInLeft.delay(i * 70).springify().damping(14);
    case 'zoom':
      return ZoomIn.delay(i * 60).springify().damping(12);
    case 'bounce':
      return BounceIn.delay(i * 80);
    case 'flip':
      return FlipInXUp.delay(i * 80).duration(500);
    case 'swing':
      return RotateInDownLeft.delay(i * 70).duration(520);
    case 'speed':
      return LightSpeedInLeft.delay(i * 60);
    case 'spin':
      return ZoomInRotate.delay(i * 60);
    default:
      return FadeInUp.delay(i * 55).springify().damping(11);
  }
}

function Typewriter({ text, style }: { text: string; style: TextStyle }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 1)), 45);
    return () => clearInterval(id);
  }, [text]);
  return (
    <Text style={style}>
      {text.slice(0, n)}
      <Text style={{ opacity: n < text.length ? 1 : 0 }}>|</Text>
    </Text>
  );
}

/** The slide title, animated the way the admin panel says each time its slide comes into view. */
export function TextReveal({ text, style, active, fx = 'words' }: { text: string; style: TextStyle; active: boolean; fx?: string }) {
  const t = String(text || '');
  if (!active || fx === 'none') return <Text style={style}>{t}</Text>;
  if (fx === 'typewriter') return <Typewriter text={t} style={style} />;
  if (fx === 'fade') return <Animated.Text entering={FadeIn.duration(700)} style={style}>{t}</Animated.Text>;
  if (fx === 'slideUp') return <Animated.Text entering={FadeInUp.springify().damping(13)} style={style}>{t}</Animated.Text>;
  // Per word (or per letter for "letters").
  const parts = fx === 'letters' ? [...t] : t.split(/(\s+)/);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {parts.map((w, i) =>
        /^\s+$/.test(w) ? (
          <Text key={i} style={style}>
            {' '}
          </Text>
        ) : (
          <Animated.Text key={i} entering={enteringFor(fx, i)} style={style}>
            {w}
          </Animated.Text>
        ),
      )}
    </View>
  );
}

/* ───────── Looping motion for the slide picture (admin panel → Picture motion) ───────── */

export const ART_MOTION = ['none', 'float', 'pulse', 'swing', 'spin', 'bounce', 'breathe', 'wobble'] as const;

export function LoopMotion({ kind, children }: { kind?: string; children: React.ReactNode }) {
  const v = useSharedValue(0);
  const k = kind || 'none';
  useEffect(() => {
    if (k === 'none') return;
    const dur = { float: 2600, pulse: 1100, swing: 2200, spin: 14000, bounce: 900, breathe: 3200, wobble: 1600 }[k] ?? 2000;
    v.value = 0;
    v.value = k === 'spin' ? withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false) : withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [k]);
  const a = useAnimatedStyle(() => {
    const p = v.value;
    switch (k) {
      case 'float':
        return { transform: [{ translateY: interpolate(p, [0, 1], [-10, 10]) }] };
      case 'pulse':
        return { transform: [{ scale: interpolate(p, [0, 1], [1, 1.07]) }] };
      case 'swing':
        return { transform: [{ rotate: `${interpolate(p, [0, 1], [-6, 6])}deg` }] };
      case 'spin':
        return { transform: [{ rotate: `${p * 360}deg` }] };
      case 'bounce':
        return { transform: [{ translateY: -Math.abs(Math.sin(p * Math.PI)) * 18 }] };
      case 'breathe':
        return { opacity: interpolate(p, [0, 1], [0.85, 1]), transform: [{ scale: interpolate(p, [0, 1], [0.96, 1.04]) }] };
      case 'wobble':
        return { transform: [{ translateX: interpolate(p, [0, 1], [-8, 8]) }, { rotate: `${interpolate(p, [0, 1], [-3, 3])}deg` }] };
      default:
        return {};
    }
  });
  if (k === 'none') return <>{children}</>;
  return <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, a]}>{children}</Animated.View>;
}
