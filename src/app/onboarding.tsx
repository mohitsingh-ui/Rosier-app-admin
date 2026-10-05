import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { Coin } from '../components/Coin';
import { Editable } from '../components/Editable';
import { RosierLogo } from '../components/Logo';
import { Img } from '../components/ui';
import { fill, useContent } from '../config/remote';
import { success, tap } from '../lib/haptics';
import { useApp } from '../store/app';
import { fonts } from '../theme';
import { Aurora, GlowRing, LoopMotion, paletteFor, Sparkles, TextReveal } from '../components/IntroFx';
import { safeColor } from '../lib/color';
import { markStable, useBoot } from '../lib/bootGuard';
import { Layer as Burst } from '../components/SeasonalEffects';

const ORANGE = '#B8662F';

/** Where the 7 collage photos sit (x as a share of screen width). */
const COLLAGE = [
  { x: 0.06, y: 40, size: 100, rot: -10, depth: 0.25 },
  { x: 0.4, y: 0, size: 88, rot: 6, depth: 0.4 },
  { x: 0.3, y: 110, size: 150, rot: -3, depth: 0.15 },
  { x: 0.7, y: 60, size: 92, rot: 10, depth: 0.35 },
  { x: 0.02, y: 180, size: 110, rot: 8, depth: 0.3 },
  { x: 0.68, y: 190, size: 104, rot: -8, depth: 0.45 },
  { x: 0.42, y: 290, size: 78, rot: 12, depth: 0.5 },
];

type Slide = {
  id?: string;
  enabled?: boolean;
  art: string;
  showLogo?: boolean;
  title: string;
  sub: string;
  image: string;
  images: string[];
  chips: { icon: string; label: string }[];
  showNameInput?: boolean;
  video?: string;
  poster?: string;
  videoSound?: boolean;
};

/* A looping video that plays only while its slide is on screen. */
function SlideVideo({ uri, poster, active, sound, w, h, radius = 0, muteTop = 0, fit = 'cover' }: { uri: string; poster?: string; active: boolean; sound?: boolean; w: number; h: number; radius?: number; muteTop?: number; fit?: 'cover' | 'contain' }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = !sound;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [muted, setMuted] = useState(!sound);
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', borderRadius: radius, backgroundColor: '#2B1A10' }}>
      <VideoView player={player} style={{ width: w, height: h }} contentFit={fit} nativeControls={false} />
      {!!poster && status !== 'readyToPlay' && <Img source={poster} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }} contentFit={fit} />}
      <Pressable
        onPress={() => setMuted((m) => !m)}
        hitSlop={10}
        style={{ position: 'absolute', right: 12, ...(muteTop ? { top: muteTop } : { bottom: 12 }), width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}
      >
        <MaterialCommunityIcons name={muted ? 'volume-off' : 'volume-high'} size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

/* Decorative wheat sprig that sways in the corner */
function Sprig() {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(r.value, [0, 1], [-6, 6])}deg` }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top: -10, right: -20, width: 150, height: 220 }, a]}>
      <Svg width={150} height={220} viewBox="0 0 150 220">
        <Path d="M120 0 C 110 60, 95 120, 70 220" stroke="#C98B55" strokeWidth={3} fill="none" />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const y = 20 + i * 30;
          const x = 118 - i * 7;
          return (
            <React.Fragment key={i}>
              <Path d={`M${x} ${y} q -26 -4 -34 -26 q 24 2 34 26z`} fill="#D9A06A" opacity={0.85} />
              <Path d={`M${x} ${y} q 24 -8 28 -32 q -22 6 -28 32z`} fill="#C98B55" opacity={0.85} />
            </React.Fragment>
          );
        })}
      </Svg>
    </Animated.View>
  );
}

/* A floating product "polaroid" */
function Floater({ uri, x, y, size, rot, delay, scroll, width, depth }: { uri: string; x: number; y: number; size: number; rot: number; delay: number; scroll: SharedValue<number>; width: number; depth: number }) {
  const f = useSharedValue(0);
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 90 }));
    f.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2000 + delay, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []);
  const a = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateX: -scroll.value * depth },
      { translateY: interpolate(f.value, [0, 1], [0, -10]) + (1 - enter.value) * 60 },
      { rotate: `${rot + interpolate(f.value, [0, 1], [-2, 2])}deg` },
      { scale: 0.6 + enter.value * 0.4 },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x * width,
          top: y,
          width: size,
          height: size,
          backgroundColor: '#fff',
          borderRadius: 18,
          padding: 6,
          shadowColor: '#5A3520',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        a,
      ]}
    >
      <Img source={uri} size={size} style={{ flex: 1, borderRadius: 12 }} contentFit="cover" />
    </Animated.View>
  );
}

/* Slide 2: rotating churn rings around the ghee jar */
function Churn({ uri, size }: { uri: string; size: number }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, []);
  const ring1 = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 360}deg` }] }));
  const ring2 = useAnimatedStyle(() => ({ transform: [{ rotate: `${-r.value * 360}deg` }] }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute' }, ring1]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 4} stroke="#C98B55" strokeWidth={2} strokeDasharray="10 14" fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute' }, ring2]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 26} stroke="#B8662F" strokeWidth={1.5} strokeDasharray="4 10" fill="none" />
        </Svg>
      </Animated.View>
      <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, backgroundColor: '#fff', padding: 10, overflow: 'hidden' }}>
        <Img source={uri} size={size} style={{ flex: 1 }} contentFit="contain" />
      </View>
    </View>
  );
}

function Steps({ chips, accent }: { chips: Slide['chips']; accent: string }) {
  const steps = chips.map((c) => [c.icon, c.label] as const);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 18 }}>
      {steps.map(([icon, label], i) => (
        <Animated.View key={`${label}-${i}`} entering={FadeInDown.delay(120 + Math.min(i, 6) * 35).springify()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
          {!!icon && <MaterialCommunityIcons name={icon as any} size={13} color={accent} />}
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: '#5A3A1E' }}>{label}</Text>
          {i < steps.length - 1 && <Ionicons name="chevron-forward" size={11} color="#C98B55" />}
        </Animated.View>
      ))}
    </View>
  );
}

/* A single big image that gently floats */
function BigImage({ uri, size }: { uri: string; size: number }) {
  const f = useSharedValue(0);
  useEffect(() => {
    f.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(f.value, [0, 1], [6, -8]) }, { rotate: `${interpolate(f.value, [0, 1], [-2, 2])}deg` }] }));
  return (
    <Animated.View entering={FadeIn.duration(500)} style={[{ width: size, height: size }, a]}>
      <Img source={uri} size={size} style={{ flex: 1, borderRadius: 24 }} contentFit="contain" />
    </Animated.View>
  );
}

function CoinRain({ width }: { width: number }) {
  return (
    <View style={{ width, height: 300, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <FallingCoin key={i} i={i} width={width} />
      ))}
      <Coin size={150} spin shine />
    </View>
  );
}

function FallingCoin({ i, width }: { i: number; width: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(i * 380, withRepeat(withSequence(withTiming(1, { duration: 2400, easing: Easing.in(Easing.quad) }), withTiming(0, { duration: 0 })), -1));
  }, []);
  const x = ((i * 37) % 100) / 100;
  const a = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(y.value, [0, 1], [-40, 320]) }, { rotate: `${y.value * 540}deg` }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 20 + x * (width - 80) }, a]}>
      <Coin size={22 + (i % 3) * 8} />
    </Animated.View>
  );
}

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  // On Android the window can be shorter than the screen (status / nav bar) — full-screen videos use the taller one.
  const screenH = Platform.OS === 'android' ? Dimensions.get('screen').height : height;
  const insets = useSafeAreaInsets();
  const ob = useContent('onboarding');
  const welcomeBonus = useContent('coins').welcomeBonus;
  const BG = safeColor(ob.background, '#F1DCC3');
  const accent = safeColor(ob.accent, ORANGE);
  const safeMode = useBoot((s) => s.safe);
  const SLIDES = ((ob.slides as Slide[]) ?? []).filter((x) => x.enabled !== false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [name, setName] = useState(useApp.getState().name);
  const setOnboarded = useApp((s) => s.setOnboarded);
  const setProfile = useApp((s) => s.setProfile);
  const input = useRef<TextInput>(null);

  const setIntroVersion = useApp((s) => s.setIntroVersion);
  // Safe mode (the app crashed last time): plain intro without the heavy effects.
  const vibrant = ob.vibrant !== false && !safeMode;
  const swipe = String((ob as any).swipeStyle || (vibrant ? '3d' : 'flat'));
  const palettes = SLIDES.map((s, i) => paletteFor((s as any).colors, i));
  const [celebrate, setCelebrate] = useState(false);

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  // Nothing to show (all slides switched off) — go straight in.
  useEffect(() => {
    if (!SLIDES.length) finish();
  }, []);

  const finish = () => {
    if (vibrant && !celebrate && SLIDES.length) {
      // A quick confetti burst, then into the app.
      setCelebrate(true);
      success();
      setTimeout(done, 850);
      return;
    }
    done();
  };

  const done = () => {
    markStable();
    success();
    if (name.trim()) setProfile({ name: name.trim() });
    setIntroVersion(Number(ob.reshowVersion) || 1);
    setOnboarded(true);
    router.replace('/home');
  };

  const next = () => {
    tap();
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
      setPage(page + 1);
    } else finish();
  };

  // Sizes per slide (admin panel → Intro slides).
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const sizesOf = (s: any) => {
    const artH = (height * num(s.artHeight, 52, 20, 90)) / 100;
    const scale = num(s.artScale, 1, 0.3, 2);
    const ratio = num(s.videoRatio, 1.78, 0.3, 2.5);
    let vw = (width * num(s.videoWidth, 62, 20, 100)) / 100;
    if (vw * ratio > artH - 10) vw = (artH - 10) / ratio; // keep the video inside its area
    return { artH, scale, vw, vh: vw * ratio, radius: num(s.videoRadius, 28, 0, 200) || 0, fit: s.videoFit === 'contain' ? 'contain' : 'cover' } as const;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: BG }}>
      {vibrant && <Aurora x={x} width={width} height={height} palettes={palettes} />}
      {vibrant && <Sparkles width={width} height={height} />}
      <Sprig />
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        keyboardShouldPersistTaps="handled"
      >
        {SLIDES.map((s, i) => {
          const z = sizesOf(s);
          const artH = z.artH;
          const idx = (ob.slides as Slide[]).indexOf(s);
          return (
          <View key={s.id ?? i} style={{ width, paddingTop: insets.top + 50 }}>
            {/* Falling / floating effect behind this slide (admin panel → slide → Background effect). */}
            {!safeMode && page === i && !!(s as any).bgFx && (s as any).bgFx !== 'none' && (
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height, zIndex: 2 }}>
                <Burst
                  key={`${i}:${(s as any).bgFx}`}
                  effect={{ id: `slide-${i}`, enabled: true, name: 'slide', type: (s as any).bgFx, amount: Number((s as any).bgFxAmount) || 30, speed: 1, size: 1, opacity: 0.9, colors: palettes[i].slice(1), emoji: String((s as any).bgFxEmoji || '✨'), image: '', screens: 'all', stopAfter: 0, startAt: '', endAt: '' } as any}
                />
              </View>
            )}
            {/* Full-screen video: edge to edge, from the very top of the screen (behind the status bar) to the bottom. */}
            {s.art === 'video_full' && !!s.video && !safeMode && Math.abs(page - i) <= 1 && (
              <View style={{ position: 'absolute', top: 0, left: 0, width, height: Math.max(height, screenH), overflow: 'hidden' }}>
                <SlideVideo uri={s.video} poster={s.poster} sound={s.videoSound} active={page === i} w={width} h={Math.max(height, screenH)} muteTop={insets.top + 12} fit={z.fit} />
                <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(20,10,4,0.8)']} locations={[0, 0.18, 0.45, 1]} style={StyleSheet.absoluteFill} />
              </View>
            )}
            <Editable id={`onboarding.slides.${(ob.slides as Slide[]).indexOf(s)}`} label={`Intro slide · ${s.title}`} style={{ flex: 1 }}>
            <Editable id={`onboarding.slides.${idx}.art`} label={s.art === 'video_full' ? 'Space above the title' : 'Picture / video area'} target={`onboarding.slides.${idx}.artHeight`} base={num((s as any).artHeight, 52, 20, 90)}>
            <ArtParallax index={i} x={x} width={width} mode={swipe} style={{ height: artH, alignItems: 'center', justifyContent: 'center', transform: [{ scale: s.art === 'video' ? 1 : z.scale }] }}>
              <LoopMotion kind={(s as any).artMotion}>
              {s.art === 'collage' && (
                <View style={{ width, height: artH }}>
                  {(s.images ?? []).slice(0, COLLAGE.length).map((uri, k) => (
                    <Floater key={k} uri={uri} {...COLLAGE[k]} delay={120 * k} scroll={x} width={width} />
                  ))}
                </View>
              )}
              {s.art === 'churn' && !!s.image && <Churn uri={s.image} size={Math.min(width * 0.82, artH) * z.scale} />}
              {s.art === 'coins' && <CoinRain width={width} />}
              {s.art === 'image' && !!s.image && <BigImage uri={s.image} size={Math.min(width * 0.86, artH) * z.scale} />}
              {s.art === 'video' && !!s.video && !safeMode && Math.abs(page - i) <= 1 && (
                <Animated.View entering={FadeIn.duration(500)}>
                  <Editable id={`onboarding.slides.${idx}.video`} label="Video size" target={`onboarding.slides.${idx}.videoWidth`} base={num((s as any).videoWidth, 62, 20, 100)}>
                    <SlideVideo uri={s.video} poster={s.poster} sound={s.videoSound} active={page === i} radius={z.radius} w={z.vw} h={z.vh} fit={z.fit} />
                  </Editable>
                </Animated.View>
              )}
              </LoopMotion>
            </ArtParallax>
            </Editable>
            <SlideText index={i} x={x} width={width} title={s.title} sub={s.sub} logo={!!s.showLogo} accent={safeColor((s as any).titleColor, accent)} subColor={safeColor((s as any).subColor, '') || undefined} textFx={(s as any).textFx} titleSize={num((s as any).titleSize, 34, 16, 64)} subSize={num((s as any).subSize, 15, 10, 28)} light={s.art === 'video_full' && !!s.video && !safeMode} active={!safeMode && page === i} />
            {!!s.chips?.length && page === i && <Steps chips={s.chips} accent={accent} />}
            {!!s.showNameInput && (
              <Animated.View entering={FadeIn.delay(100)} style={{ paddingHorizontal: 28, marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar size={56} editable />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, paddingHorizontal: 14, height: 50, gap: 8 }}>
                  <Ionicons name="person-outline" size={18} color={accent} />
                  <TextInput
                    ref={input}
                    value={name}
                    onChangeText={setName}
                    placeholder={ob.namePlaceholder}
                    placeholderTextColor="#A8927F"
                    returnKeyType="done"
                    onSubmitEditing={finish}
                    style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: '#3E2415' }}
                  />
                </View>
                </View>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#7A6453', marginTop: 8 }}>
                  {fill(ob.welcomeNote, { welcomeBonus })}
                </Text>
              </Animated.View>
            )}
            </Editable>
          </View>
          );
        })}
      </Animated.ScrollView>

      {/* Footer: dots, skip, next */}
      <View style={{ position: 'absolute', left: 28, right: 28, bottom: insets.bottom + 24, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
          {SLIDES.map((_, i) => (
            <PageDot key={i} i={i} x={x} width={width} />
          ))}
        </View>
        {page < SLIDES.length - 1 && (
          <Pressable onPress={finish} hitSlop={12} style={{ marginRight: 18 }}>
            <Text style={{ fontFamily: fonts.sansMedium, color: SLIDES[page]?.art === 'video_full' ? '#FFFFFF' : '#8B7B6E', fontSize: 15 }}>{ob.skipLabel}</Text>
          </Pressable>
        )}
        <View>
          {vibrant && <GlowRing color={palettes[page]?.[1] ?? accent} size={page >= SLIDES.length - 1 ? 150 : 56} last={page >= SLIDES.length - 1} />}
          <NextButton last={page >= SLIDES.length - 1} label={ob.buttonLabel} onPress={next} />
        </View>
      </View>
      {celebrate && (
        <Burst effect={{ id: 'intro', enabled: true, name: 'intro', type: 'confetti', amount: 70, speed: 1.7, size: 1.15, opacity: 1, colors: palettes.flatMap((p) => p.slice(1)), emoji: '', image: '', screens: 'all', stopAfter: 2, startAt: '', endAt: '' }} />
      )}
    </KeyboardAvoidingView>
  );
}

/** The slide's picture area: drifts, tilts and shrinks as you swipe (3D-ish parallax). */
/**
 * How the picture moves while swiping between slides (admin panel → Intro slides → Swipe animation).
 *  3d · cube · zoom · stack · fade · flip · rise · flat
 */
function ArtParallax({ index, x, width, mode, style, children }: { index: number; x: SharedValue<number>; width: number; mode: string; style: any; children: React.ReactNode }) {
  const a = useAnimatedStyle(() => {
    const p = (x.value - index * width) / width;
    const ap = Math.min(1, Math.abs(p));
    switch (mode) {
      case 'flat':
        return {};
      case 'cube':
        return {
          opacity: interpolate(ap, [0, 1], [1, 0.4]),
          transform: [{ perspective: 700 }, { translateX: interpolate(p, [-1, 0, 1], [width * 0.5, 0, -width * 0.5]) }, { rotateY: `${interpolate(p, [-1, 0, 1], [-70, 0, 70], Extrapolation.CLAMP)}deg` }, { translateX: interpolate(p, [-1, 0, 1], [-width * 0.5, 0, width * 0.5]) }],
        };
      case 'zoom':
        return { opacity: interpolate(ap, [0, 0.8], [1, 0], Extrapolation.CLAMP), transform: [{ scale: interpolate(p, [-1, 0, 1], [1.6, 1, 0.4], Extrapolation.CLAMP) }] };
      case 'stack':
        // The picture stays in place and shrinks away like a deck of cards.
        return { opacity: interpolate(ap, [0, 1], [1, 0.2]), transform: [{ translateX: p > 0 ? p * width * 0.85 : 0 }, { scale: interpolate(ap, [0, 1], [1, 0.75], Extrapolation.CLAMP) }] };
      case 'fade':
        return { opacity: interpolate(ap, [0, 0.7], [1, 0], Extrapolation.CLAMP), transform: [{ translateX: p * width }] };
      case 'flip':
        return { opacity: interpolate(ap, [0, 0.5, 1], [1, 0.6, 0]), transform: [{ perspective: 900 }, { rotateX: `${interpolate(p, [-1, 0, 1], [80, 0, -80], Extrapolation.CLAMP)}deg` }] };
      case 'rise':
        return { opacity: interpolate(ap, [0, 0.8], [1, 0], Extrapolation.CLAMP), transform: [{ translateY: interpolate(ap, [0, 1], [0, 160]) }, { rotate: `${interpolate(p, [-1, 0, 1], [-12, 0, 12])}deg` }] };
      default:
        return {
          opacity: interpolate(ap, [0, 0.9], [1, 0.2], Extrapolation.CLAMP),
          transform: [
            { perspective: 900 },
            { translateX: interpolate(p, [-1, 0, 1], [width * 0.25, 0, -width * 0.25]) },
            { rotateY: `${interpolate(p, [-1, 0, 1], [-25, 0, 25])}deg` },
            { scale: interpolate(ap, [0, 1], [1, 0.82], Extrapolation.CLAMP) },
          ],
        };
    }
  });
  return (
    <Animated.View pointerEvents="box-none" style={[style, a]}>
      {children}
    </Animated.View>
  );
}

function SlideText({ index, x, width, title, sub, logo, accent, light, active, titleSize = 34, subSize = 15, subColor, textFx }: { index: number; x: SharedValue<number>; width: number; title: string; sub: string; logo: boolean; accent: string; light?: boolean; active?: boolean; titleSize?: number; subSize?: number; subColor?: string; textFx?: string }) {
  const a = useAnimatedStyle(() => {
    const p = (x.value - index * width) / width;
    return {
      opacity: interpolate(Math.abs(p), [0, 0.6], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(p, [-1, 0, 1], [width * 0.4, 0, -width * 0.4]) }],
    };
  });
  return (
    <Animated.View style={[{ paddingHorizontal: 28, marginTop: 10 }, a]}>
      {logo && (
        <View style={{ marginBottom: 6, marginLeft: -6 }}>
          <RosierLogo width={110} color={light ? '#FFFFFF' : '#5A3520'} />
        </View>
      )}
      <TextReveal key={active ? 'on' : 'off'} fx={textFx || 'words'} text={title} active={!!active} style={{ fontFamily: fonts.sansSemi, fontSize: titleSize, lineHeight: titleSize * 1.18, color: light ? '#FFFFFF' : accent, letterSpacing: 0.5 }} />
      <Animated.Text key={active ? 's-on' : 's-off'} entering={active && textFx !== 'none' ? FadeIn.delay(350).duration(600) : undefined} style={{ fontFamily: fonts.sans, fontSize: subSize, color: subColor || (light ? 'rgba(255,255,255,0.9)' : '#7A6453'), marginTop: 4, lineHeight: subSize * 1.47 }}>{sub}</Animated.Text>
    </Animated.View>
  );
}

function PageDot({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const a = useAnimatedStyle(() => {
    const d = Math.abs(x.value / width - i);
    return { width: interpolate(d, [0, 1], [26, 8], Extrapolation.CLAMP), opacity: interpolate(d, [0, 1], [1, 0.4], Extrapolation.CLAMP) };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }, a]} />;
}

function NextButton({ last, label, onPress }: { last: boolean; label: string; onPress: () => void }) {
  const w = useSharedValue(56);
  useEffect(() => {
    w.value = withSpring(last ? 150 : 56, { damping: 14 });
  }, [last]);
  const a = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[{ height: 56, borderRadius: 28, backgroundColor: '#3E2415', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, overflow: 'hidden' }, a]}>
        {last && (
          <Animated.Text entering={FadeIn.delay(75)} style={{ color: '#FBE6CF', fontFamily: fonts.sansSemi, fontSize: 15 }} numberOfLines={1}>
            {label}
          </Animated.Text>
        )}
        <Ionicons name="arrow-forward" size={22} color="#FBE6CF" />
      </Animated.View>
    </Pressable>
  );
}
