import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useContent } from '../config/remote';
import { fonts, useLayout, useTheme } from '../theme';
import { Coin, CoinStack } from './Coin';
import { Img, PressableScale } from './ui';

const cardBase = { height: 212, borderRadius: 22, overflow: 'hidden' as const, padding: 18 };

function Perk({ icon, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  return (
    <View style={{ alignItems: 'center', width: 58 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#B98546', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon} size={13} color="#8A5A22" />
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 8, color: '#5A3A1E', textAlign: 'center', marginTop: 3, lineHeight: 10 }}>{label}</Text>
    </View>
  );
}

export function CoinsBanner({ width, height = 212 }: { width: number; height?: number }) {
  const c = useContent('home').coinsBanner;
  const L = useLayout();
  return (
    <PressableScale scaleTo={0.98} onPress={() => router.navigate('/coins')} style={{ width }}>
      <LinearGradient colors={['#FFF6E6', '#F4DFC0', '#EBCB9B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[cardBase, { height, borderRadius: L.heroRadius, justifyContent: 'center' }]}>
        <View style={{ maxWidth: width - 150 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: '#4A2C17', lineHeight: 26 }}>{c.title}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: '#5A3A1E', marginTop: 6, lineHeight: 14 }}>
            {c.body.split(/(Rosier Coins)/).map((part, i) =>
              part === 'Rosier Coins' ? (
                <Text key={i} style={{ color: '#A56312', fontFamily: fonts.sansSemi }}>
                  {part}
                </Text>
              ) : (
                part
              ),
            )}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 2 }}>
            <Perk icon="gift-outline" label="Exclusive Rewards" />
            <Perk icon="percent-outline" label="Special Discounts" />
            <Perk icon="crown-outline" label="Early Access" />
          </View>
          <View style={{ marginTop: 10, backgroundColor: '#5A3520', alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#FBE6CF', fontFamily: fonts.sansMedium, fontSize: 10 }}>{c.button}</Text>
            <Ionicons name="arrow-forward" size={12} color="#FBE6CF" />
          </View>
        </View>
        <View style={{ position: 'absolute', right: 14, top: height / 2 - 66 }}>
          <Coin size={112} spin shine />
          <LinearGradient colors={['#8B5A2B', '#4A2C17']} style={{ width: 128, height: 20, borderRadius: 64, marginTop: -8, marginLeft: -8, opacity: 0.9 }} />
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

export function ProductBanner({
  width,
  title,
  sub,
  image,
  colors,
  onPress,
  light,
  height = 212,
}: {
  width: number;
  height?: number;
  title: string;
  sub: string;
  image: string;
  colors: [string, string, ...string[]];
  onPress: () => void;
  light?: boolean;
}) {
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [4, -6]) }, { rotate: `${interpolate(float.value, [0, 1], [-3, 3])}deg` }] }));
  const fg = light ? '#FFF5E8' : '#3E2415';
  const L = useLayout();
  return (
    <PressableScale scaleTo={0.98} onPress={onPress} style={{ width }}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[cardBase, { height, borderRadius: L.heroRadius, flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: fg, lineHeight: 28 }}>{title}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: fg, opacity: 0.85, marginTop: 6, lineHeight: 15 }}>{sub}</Text>
          <View style={{ marginTop: 12, backgroundColor: light ? '#FBE6CF' : '#3E2415', alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: light ? '#3E2415' : '#FBE6CF', fontFamily: fonts.sansMedium, fontSize: 10 }}>Shop Now</Text>
            <Ionicons name="arrow-forward" size={12} color={light ? '#3E2415' : '#FBE6CF'} />
          </View>
        </View>
        <Animated.View style={[{ width: width * 0.42, height: Math.min(160, height - 40) }, a]}>
          <Img source={image} size={200} style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      </LinearGradient>
    </PressableScale>
  );
}

/** Auto-advancing carousel with animated pill dots. */
export function Carousel({ width, slides, seconds = 4.2 }: { width: number; slides: React.ReactNode[]; seconds?: number }) {
  const t = useTheme();
  const ref = useRef<ScrollView>(null);
  const [i, setI] = useState(0);
  const touching = useRef(false);
  const gap = 12;
  const item = width - 40;

  useEffect(() => {
    if (!seconds || slides.length < 2) return; // 0 = don't auto-slide
    const id = setInterval(() => {
      if (touching.current) return;
      const next = (i + 1) % slides.length;
      ref.current?.scrollTo({ x: next * (item + gap), animated: true });
      setI(next);
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [i, slides.length, item, seconds]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touching.current = false;
    setI(Math.round(e.nativeEvent.contentOffset.x / (item + gap)));
  };

  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={item + gap}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20, gap }}
        onScrollBeginDrag={() => (touching.current = true)}
        onMomentumScrollEnd={onEnd}
      >
        {slides.map((s, k) => (
          <View key={k} style={{ width: item }}>
            {s}
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {slides.map((_, k) => (
          <Dot key={k} active={k === i} color={t.primary} />
        ))}
      </View>
    </View>
  );
}

export function Dot({ active, color }: { active: boolean; color: string }) {
  const w = useSharedValue(active ? 22 : 7);
  useEffect(() => {
    w.value = withTiming(active ? 22 : 7, { duration: 260 });
  }, [active]);
  const a = useAnimatedStyle(() => ({ width: w.value, opacity: interpolate(w.value, [7, 22], [0.35, 1]) }));
  return <Animated.View style={[{ height: 7, borderRadius: 4, backgroundColor: color }, a]} />;
}

/** Dark gold "Rosier Benefits Club" banner. */
export function BenefitsBanner({ width }: { width: number }) {
  const b = useContent('benefits');
  const perks = b.bannerPerks.map((p) => [p.icon, p.label] as [any, string]);
  const n = Math.max(1, perks.length);
  return (
    <PressableScale scaleTo={0.98} onPress={() => router.push('/benefits-club')} style={{ width }}>
      <LinearGradient colors={['#2B1609', '#5A3113', '#2B1609']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 0, paddingVertical: 20, paddingHorizontal: 18, overflow: 'hidden' }}>
        <Shimmer width={width} />
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 30, color: '#E8C27A', textAlign: 'center', letterSpacing: 2 }}>{b.bannerTitle}</Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: '#E8C27A', textAlign: 'center', letterSpacing: 3, marginTop: -2 }}>{b.bannerSubtitle}</Text>
        <View style={{ alignSelf: 'center', borderWidth: 1, borderColor: '#B98546', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3, marginTop: 6 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 8, color: '#E8C27A', letterSpacing: 1 }}>{b.bannerTagline}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
          {perks.map(([icon, label], i) => (
            <View key={i} style={{ alignItems: 'center', width: (width - 60) / Math.max(5, n) }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#8B6230', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}>
                <MaterialCommunityIcons name={icon} size={22} color="#E8C27A" />
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 8.5, color: '#E8C27A', textAlign: 'center', marginTop: 4, lineHeight: 11 }}>{label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

function Shimmer({ width }: { width: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }), -1);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0, 1], [-120, width + 120]) }, { rotate: '20deg' }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -40, width: 60, height: 320, backgroundColor: 'rgba(255,220,150,0.08)' }, a]} />;
}

export { CoinStack };
