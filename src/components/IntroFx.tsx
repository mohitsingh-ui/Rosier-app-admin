/**
 * Colourful layers for the intro slides:
 *  - Aurora: the background colour flows between each slide's colours as you swipe,
 *    with big soft glowing blobs drifting around.
 *  - Sparkles: twinkling stars.
 *  - WordReveal: the title pops in word by word.
 *  - GlowRing: a pulsing ring behind the next button.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  interpolate,
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
  return [c[0] || d[0], c[1] || d[1], c[2] || d[2], c[3] || d[3]];
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
