/**
 * Opening animation, played once each time the app starts, then it fades away into
 * the app. Everything is set in the admin panel → Opening animation:
 *  - on / off, how often (every open, once a day, only the first time)
 *  - the built-in Rosier logo animation (3 styles), or your own GIF / image / video
 *  - background colour, logo colour, how long it shows, "tap to skip"
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { create } from 'zustand';
import { IN_EDITOR, useContent } from '../config/remote';
import { safeColor } from '../lib/color';
import { useFestival } from '../theme/festivals';
import { fonts } from '../theme';
import { RosierLogo, useTagline } from './Logo';

const SEEN = 'rosier-splash-seen';
let playedThisLaunch = false;

/** Admin panel "Play in live preview". */
export const useTrySplash = create<{ n: number }>(() => ({ n: 0 }));

type Cfg = { enabled?: boolean; frequency?: string; kind?: string; logoStyle?: string; media?: string; video?: string; fit?: string; seconds?: number; bg?: string; logoColor?: string; showTagline?: boolean; tapToSkip?: boolean; videoSound?: boolean };

function Rings({ color, size }: { color: string; size: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Ring key={i} delay={i * 420} color={color} size={size} />
      ))}
    </>
  );
}
function Ring({ delay, color, size }: { delay: number; color: string; size: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false));
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - v.value), transform: [{ scale: 0.6 + v.value * 1.1 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }, a]} />;
}

/** The built-in Rosier logo animation. */
function LogoAnim({ style, color, tagline, bg }: { style: string; color: string; tagline: boolean; bg: string }) {
  const { width } = useWindowDimensions();
  const s = useSharedValue(style === 'rise' ? 1 : 0.55);
  const o = useSharedValue(0);
  const r = useSharedValue(style === 'flip' ? 90 : 0);
  const y = useSharedValue(style === 'rise' ? 40 : 0);
  const shine = useSharedValue(-1);
  const tagO = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(1, { duration: 420 });
    if (style === 'flip') r.value = withSequence(withTiming(-20, { duration: 520, easing: Easing.out(Easing.cubic) }), withSpring(0, { damping: 8 }));
    else if (style === 'rise') y.value = withSpring(0, { damping: 11, stiffness: 120 });
    else s.value = withSequence(withSpring(1.08, { damping: 9, stiffness: 140 }), withSpring(1, { damping: 12 }));
    shine.value = withDelay(500, withTiming(1.4, { duration: 900, easing: Easing.inOut(Easing.quad) }));
    tagO.value = withDelay(650, withTiming(1, { duration: 500 }));
  }, []);
  const logo = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ perspective: 800 }, { translateY: y.value }, { scale: s.value }, { rotateY: `${r.value}deg` }] }));
  const shineA = useAnimatedStyle(() => ({ transform: [{ translateX: shine.value * width * 0.45 }, { rotate: '20deg' }] }));
  const tagA = useAnimatedStyle(() => ({ opacity: tagO.value, transform: [{ translateY: (1 - tagO.value) * 10 }] }));
  const w = Math.min(width * 0.52, 230);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {style !== 'rise' && <Rings color={color} size={w * 1.15} />}
      <Animated.View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 8 }, logo]}>
        <RosierLogo width={w} color={color} />
        {/* A soft golden shine sweeping across the logo. */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -40, bottom: -40, width: 46, backgroundColor: 'rgba(255,240,200,0.35)' }, shineA]} />
      </Animated.View>
      {tagline && (
        <Animated.View style={tagA}>
          <TaglineText color={color} bg={bg} />
        </Animated.View>
      )}
    </View>
  );
}
function TaglineText({ color }: { color: string; bg: string }) {
  const t = useTagline();
  return <Text style={{ marginTop: 14, fontFamily: fonts.sansMedium, fontSize: 14, letterSpacing: 1.2, color, opacity: 0.85, textAlign: 'center' }}>{t}</Text>;
}

function SplashVideo({ uri, sound, fit, onEnd }: { uri: string; sound: boolean; fit: 'cover' | 'contain'; onEnd: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = !sound;
    p.play();
  });
  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={fit} nativeControls={false} />;
}

export function OpeningSplash() {
  const c = (useContent('splash' as any) ?? {}) as Cfg;
  const fest = useFestival();
  const tryN = useTrySplash((s) => s.n);
  const [show, setShow] = useState<boolean>(() => !IN_EDITOR && !playedThisLaunch && c.enabled !== false);
  const [ready, setReady] = useState(c.frequency !== 'daily' && c.frequency !== 'first');
  const fade = useSharedValue(1);
  const closing = useRef(false);

  // "Once a day" / "only the first time": check when it was last shown.
  useEffect(() => {
    if (!show || ready) return;
    AsyncStorage.getItem(SEEN)
      .then((v) => {
        const last = Number(v || 0);
        const skip = c.frequency === 'first' ? last > 0 : Date.now() - last < 20 * 3600 * 1000;
        if (skip) setShow(false);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  // Admin preview: play it again on request.
  useEffect(() => {
    if (!tryN) return;
    closing.current = false;
    fade.value = 1;
    setReady(true);
    setShow(true);
  }, [tryN]);

  const seconds = Math.min(10, Math.max(0.8, Number(c.seconds) || 2.4));
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    playedThisLaunch = true;
    AsyncStorage.setItem(SEEN, String(Date.now())).catch(() => {});
    fade.value = withTiming(0, { duration: 450, easing: Easing.out(Easing.quad) });
    setTimeout(() => setShow(false), 470);
  };

  useEffect(() => {
    if (!show || !ready) return;
    const isVideo = c.kind === 'video' && !!c.video;
    // Videos close when they end (with a safety limit); everything else after the set time.
    const t = setTimeout(close, (isVideo ? Math.max(seconds, 12) : seconds) * 1000);
    return () => clearTimeout(t);
  }, [show, ready, tryN]);

  const a = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: 1 + (1 - fade.value) * 0.06 }] }));
  if (!show) return null;

  const bg = safeColor(c.bg, fest ? (fest.light.header ?? '#FBEBD8') : '#FBEBD8');
  const logoColor = safeColor(c.logoColor, fest ? (fest.light.primary ?? '#3E2415') : '#3E2415');
  const fit = c.fit === 'contain' ? 'contain' : 'cover';
  let body: React.ReactNode;
  if (!ready) body = null;
  else if (c.kind === 'video' && c.video) body = <SplashVideo uri={c.video} sound={!!c.videoSound} fit={fit} onEnd={close} />;
  else if (c.kind === 'image' && c.media)
    // Works for GIFs (animated), PNG, JPG and WebP.
    body = <Image source={{ uri: c.media }} style={fit === 'cover' ? StyleSheet.absoluteFill : { width: '80%', height: '60%' }} contentFit={fit} cachePolicy="disk" autoplay transition={150} />;
  else body = <LogoAnim style={c.logoStyle || 'glow'} color={logoColor} tagline={c.showTagline !== false} bg={bg} />;

  return (
    <Animated.View entering={FadeIn.duration(120)} style={[StyleSheet.absoluteFill, { zIndex: 2000, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, a]}>
      <Pressable disabled={c.tapToSkip === false} onPress={close} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        {body}
      </Pressable>
    </Animated.View>
  );
}

/** Downloads the custom splash picture in the background so it's ready (offline too) next time. */
export function prefetchSplash(c: Cfg | undefined) {
  if (c?.enabled !== false && c?.kind === 'image' && c.media) Image.prefetch(c.media, 'disk').catch(() => {});
}
