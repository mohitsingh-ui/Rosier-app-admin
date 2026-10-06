/**
 * Seasonal effects (snow, Diwali sparkles, Holi colours, rain, confetti…) drawn over
 * the app. Controlled from the admin panel → Seasonal effects.
 *
 * Never blocks taps (pointerEvents none). All movement runs on the UI thread from one
 * shared clock, so even 80 flakes cost very little. Respects the phone's
 * "reduce motion" setting and the customer's own on/off switch in Profile.
 */
import { usePathname } from 'expo-router';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useFrameCallback, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Content, IN_EDITOR, isLive, useContent } from '../config/remote';
import { useApp } from '../store/app';
import { create } from 'zustand';
import { Img } from './ui';
import { useFestival } from '../theme/festivals';

export type Effect = Content['effects']['items'][number];
type Kind = 'dot' | 'glyph' | 'rect' | 'line' | 'petal' | 'image';
type P = {
  kind: Kind;
  x0: number;
  phase: number;
  dur: number;
  size: number;
  color: string;
  glyph?: string;
  amp: number;
  freq: number;
  spin: number;
  flip: boolean;
  twinkle: boolean;
  alpha: number;
  up: boolean;
  slant: number;
};

const TAB_ROUTES = ['/home', '/shop', '/coins', '/cart', '/profile'];

const PALETTES: Record<string, string[]> = {
  snow: ['#FFFFFF', '#D7ECFB', '#B9DCF5'],
  sparkles: ['#F3D48B', '#FFB703', '#FB8500', '#FFE8A3'],
  holi: ['#FF006E', '#FFBE0B', '#3A86FF', '#8338EC', '#06D6A0', '#FB5607'],
  rain: ['#7FA7C9'],
  confetti: ['#A56312', '#F3D48B', '#E76F51', '#2A9D8F', '#E9C46A', '#8ECAE6'],
  petals: ['#F7B6C2', '#F48FB1', '#FAD1DA', '#EC8FA6'],
  hearts: ['#E63946', '#FF6B8B', '#F3B33D', '#FF8FAB'],
};

/** Small seeded random so the same settings always draw the same pattern. */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const hash = (str: string) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;

function makeParticles(e: Effect, w: number, h: number): P[] {
  const r = rng(hash(JSON.stringify(e)) + w + h);
  const n = Math.round(Math.min(100, Math.max(4, Number(e.amount) || 40)));
  const speed = Math.min(4, Math.max(0.2, Number(e.speed) || 1));
  const scale = Math.min(4, Math.max(0.3, Number(e.size) || 1));
  const alpha = Math.min(1, Math.max(0.1, Number(e.opacity) || 1));
  const colors = (e.colors ?? []).filter(Boolean).length ? (e.colors as string[]).filter(Boolean) : PALETTES[e.type] ?? ['#FFFFFF'];
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  const between = (a: number, b: number) => a + r() * (b - a);
  const emojis = String(e.emoji || '').split(/\s+/).filter(Boolean);
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const base: P = {
      kind: 'dot',
      x0: r(),
      phase: r(),
      dur: 10000,
      size: 6,
      color: pick(colors),
      amp: between(8, 28),
      freq: between(0.6, 1.6),
      spin: 0,
      flip: false,
      twinkle: false,
      alpha,
      up: false,
      slant: 0,
    };
    let p: P = base;
    switch (e.type) {
      case 'snow': {
        const flake = r() < 0.3;
        p = { ...base, kind: flake ? 'glyph' : 'dot', glyph: '❄', size: flake ? between(12, 20) : between(4, 10), dur: between(9000, 15000), spin: flake ? between(-0.6, 0.6) : 0, color: flake ? pick(colors.length > 1 ? colors.slice(1) : colors) : pick(colors) };
        break;
      }
      case 'sparkles':
        p = { ...base, kind: 'glyph', glyph: r() < 0.6 ? '✦' : '✧', size: between(8, 17), dur: between(8000, 13000), twinkle: true, amp: between(4, 14) };
        break;
      case 'diyas':
        p = { ...base, kind: 'glyph', glyph: '🪔', size: between(18, 30), dur: between(11000, 17000), up: true, amp: between(6, 18), twinkle: true };
        break;
      case 'holi': {
        const puff = r() < 0.25;
        p = { ...base, kind: 'dot', size: puff ? between(18, 34) : between(5, 12), dur: between(6000, 10000), alpha: alpha * (puff ? 0.3 : 0.85), amp: between(10, 40) };
        break;
      }
      case 'rain':
        p = { ...base, kind: 'line', size: between(14, 26), dur: between(800, 1300), amp: 0, slant: 0.18 };
        break;
      case 'confetti':
        p = { ...base, kind: 'rect', size: between(7, 11), dur: between(3500, 6000), spin: between(-2.5, 2.5), flip: true, amp: between(10, 30) };
        break;
      case 'petals':
        p = { ...base, kind: 'petal', size: between(9, 16), dur: between(8000, 13000), spin: between(-1.2, 1.2), flip: true, amp: between(16, 40) };
        break;
      case 'hearts':
        p = { ...base, kind: 'glyph', glyph: '♥', size: between(12, 22), dur: between(8000, 13000), amp: between(8, 22) };
        break;
      case 'leaves':
        p = { ...base, kind: 'glyph', glyph: pick(['🍂', '🍁', '🍂']), size: between(16, 26), dur: between(7000, 11000), spin: between(-1.4, 1.4), amp: between(20, 46) };
        break;
      case 'kites':
        p = { ...base, kind: 'glyph', glyph: '🪁', size: between(20, 32), dur: between(13000, 19000), up: true, amp: between(20, 50), spin: between(-0.15, 0.15) };
        break;
      case 'emoji':
        p = { ...base, kind: 'glyph', glyph: emojis.length ? pick(emojis) : '✨', size: between(16, 28), dur: between(8000, 12000), spin: between(-0.5, 0.5), amp: between(10, 30) };
        break;
      case 'image':
        p = { ...base, kind: 'image', size: between(20, 34), dur: between(8000, 12000), spin: between(-0.6, 0.6), amp: between(10, 30) };
        break;
    }
    p.size *= scale;
    p.dur /= speed;
    out.push(p);
  }
  return out;
}

const Particle = memo(function Particle({ p, clock, fade, w, h, image }: { p: P; clock: SharedValue<number>; fade: SharedValue<number>; w: number; h: number; image?: string }) {
  const style = useAnimatedStyle(() => {
    const t = (clock.value / p.dur + p.phase) % 1;
    const travel = h + p.size * 3;
    const y = p.up ? h + p.size - t * travel : -p.size * 2 + t * travel;
    const sway = Math.sin((t * p.freq + p.phase) * Math.PI * 2) * p.amp;
    const x = p.x0 * (w + p.slant * h) - p.slant * h * t + sway - p.size / 2;
    const tw = p.twinkle ? 0.45 + 0.55 * Math.abs(Math.sin((t * 6 + p.phase) * Math.PI)) : 1;
    // Fade in/out at the edges of the screen for things that rise.
    const edge = p.up ? Math.min(1, (1 - t) * 6, t * 8) : 1;
    const tr: any[] = [{ translateX: x }, { translateY: y }];
    if (p.kind === 'line') tr.push({ rotate: `${Math.atan(p.slant)}rad` });
    if (p.spin) tr.push({ rotate: `${t * p.spin * 720}deg` });
    if (p.flip) tr.push({ scaleX: Math.cos((t * 5 + p.phase) * Math.PI * 2) });
    return { opacity: p.alpha * tw * edge * fade.value, transform: tr };
  });
  const s = p.size;
  let body: React.ReactNode;
  if (p.kind === 'glyph') body = <Text style={{ fontSize: s, lineHeight: s * 1.15, color: p.color, textShadowColor: 'rgba(80,110,140,0.25)', textShadowRadius: 2 }}>{p.glyph}</Text>;
  else if (p.kind === 'image') body = <Img source={image} size={s} style={{ width: s, height: s }} transition={0} />;
  else if (p.kind === 'line') body = <View style={{ width: 1.6, height: s, borderRadius: 1, backgroundColor: p.color }} />;
  else if (p.kind === 'rect') body = <View style={{ width: s * 0.7, height: s * 1.2, borderRadius: 2, backgroundColor: p.color }} />;
  else if (p.kind === 'petal') body = <View style={{ width: s, height: s * 0.7, borderTopLeftRadius: s, borderBottomRightRadius: s, backgroundColor: p.color }} />;
  else
    body = (
      <View
        style={{
          width: s,
          height: s,
          borderRadius: s / 2,
          backgroundColor: p.color,
          // A faint edge keeps white snow visible on the cream background.
          borderWidth: p.color.toUpperCase() === '#FFFFFF' ? 0.6 : 0,
          borderColor: 'rgba(120,150,180,0.45)',
        }}
      />
    );
  return <Animated.View style={[styles.p, style]}>{body}</Animated.View>;
});

export function Layer({ effect }: { effect: Effect }) {
  const { width: w, height: h } = useWindowDimensions();
  const particles = useMemo(() => makeParticles(effect, w, h), [effect, w, h]);
  const clock = useSharedValue(0);
  const fade = useSharedValue(0);
  const [over, setOver] = useState(false);
  useFrameCallback((f) => {
    clock.value = f.timeSinceFirstFrame;
  });
  useEffect(() => {
    setOver(false);
    fade.value = 0;
    fade.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
    const stop = Number(effect.stopAfter) || 0;
    if (stop <= 0) return;
    const t1 = setTimeout(() => (fade.value = withTiming(0, { duration: 1500 })), stop * 1000);
    const t2 = setTimeout(() => setOver(true), stop * 1000 + 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [effect]);
  if (over) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Particle key={i} p={p} clock={clock} fade={fade} w={w} h={h} image={effect.image} />
      ))}
    </View>
  );
}

/** Admin panel "Preview in phone" — shows an effect for a few seconds even if it's switched off. */
export const useTryEffect = create<{ effect: Effect | null; n: number }>(() => ({ effect: null, n: 0 }));

/** The effect that should be running right now (or null). */
export function useActiveEffect(): Effect | null {
  const cfg = useContent('effects');
  const off = useApp((s) => s.effectsOff);
  const fest = useFestival();
  if (cfg?.userToggle && off) return null;
  const own = cfg?.enabled ? (cfg.items ?? []).find((e) => e && isLive(e)) ?? null : null;
  if (own) return own;
  // A festival theme brings its own effect (diyas for Diwali, colours for Holi…) for a few seconds on Home.
  if (fest?.effectType) return { id: `fest-${fest.id}`, enabled: true, name: fest.name, type: fest.effectType, amount: 26, speed: 1, size: 1, opacity: 0.9, colors: fest.effectType === 'confetti' ? fest.bunting : [], emoji: '', image: '', screens: 'home', stopAfter: 10, startAt: '', endAt: '' } as any;
  return null;
}

export function SeasonalEffects() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const active = useActiveEffect();
  const tried = useTryEffect();
  useEffect(() => {
    if (!tried.effect) return;
    const t = setTimeout(() => useTryEffect.setState({ effect: null }), 12000);
    return () => clearTimeout(t);
  }, [tried.n]);

  const effect = IN_EDITOR && tried.effect ? tried.effect : active;
  if (!effect || (reduce && !IN_EDITOR)) return null;
  const where = effect.screens || 'home';
  const show = where === 'all' || (where === 'tabs' ? TAB_ROUTES.includes(pathname) : pathname === '/home');
  if (!show && !(IN_EDITOR && tried.effect)) return null;
  // A fresh key restarts it when the settings change in the admin preview.
  return <Layer key={`${JSON.stringify(effect)}:${tried.n}`} effect={effect} />;
}

const styles = StyleSheet.create({
  p: { position: 'absolute', left: 0, top: 0 },
});
