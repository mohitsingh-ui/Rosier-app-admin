import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { ReactNode, useEffect } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInLeft, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store/app';
import { fonts, useTheme } from '../theme';
import { Avatar } from './Avatar';
import { RosierLogo, Tagline } from './Logo';
import { PressableScale } from './ui';

const ITEMS: { label: string; icon: ReactNode; go: () => void }[] = [
  { label: 'Category', icon: <MaterialCommunityIcons name="shape-outline" size={30} />, go: () => router.navigate('/shop') },
  { label: 'Gift cards', icon: <MaterialCommunityIcons name="gift-outline" size={30} />, go: () => router.push('/gifting') },
  { label: 'Cart', icon: <Ionicons name="cart-outline" size={30} />, go: () => router.navigate('/cart') },
  { label: 'Benefit Club', icon: <MaterialCommunityIcons name="crown-outline" size={30} />, go: () => router.push('/benefits-club') },
  { label: 'Account', icon: <MaterialCommunityIcons name="account-edit-outline" size={30} />, go: () => router.push('/account') },
  { label: 'Orders', icon: <MaterialCommunityIcons name="package-variant-closed" size={30} />, go: () => router.push('/orders') },
  { label: 'Help & Support', icon: <Ionicons name="heart-outline" size={30} />, go: () => router.push('/help') },
  { label: 'Blog & Articles', icon: <MaterialCommunityIcons name="newspaper-variant-outline" size={30} />, go: () => router.push('/blog') },
  { label: 'Our Story', icon: <MaterialCommunityIcons name="sprout-outline" size={30} />, go: () => router.push('/about') },
];

/**
 * Wraps the tab navigator. When the menu opens, the whole app card
 * shrinks and slides right (like the Figma), revealing the menu beneath.
 */
export function MenuShell({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const open = useApp((s) => s.menuOpen);
  const setOpen = useApp((s) => s.setMenuOpen);
  const name = useApp((s) => s.name);
  const logout = useApp((s) => s.logout);
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withSpring(open ? 1 : 0, { damping: 18, stiffness: 160, mass: 0.9 });
  }, [open]);

  const card = useAnimatedStyle(() => ({
    borderRadius: interpolate(p.value, [0, 1], [0, 32]),
    transform: [
      { translateX: interpolate(p.value, [0, 1], [0, width * 0.62]) },
      { scale: interpolate(p.value, [0, 1], [1, 0.72]) },
      { perspective: 900 },
      { rotateY: `${interpolate(p.value, [0, 1], [0, -8])}deg` },
    ],
  }));
  const ghost = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0, 0.5]),
    transform: [{ translateX: interpolate(p.value, [0, 1], [0, width * 0.54]) }, { scale: interpolate(p.value, [0, 1], [1, 0.62]) }],
  }));

  const go = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 180);
  };

  const bg = t.mode === 'dark' ? '#241E1A' : '#E9D4BA';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Menu */}
      <View style={{ position: 'absolute', top: insets.top + 24, left: 26, right: 0, bottom: 0 }} pointerEvents={open ? 'auto' : 'none'}>
        {open && (
          <>
            <Animated.View entering={FadeInLeft.springify().damping(15)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              <Avatar size={64} />
              <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: t.text }}>Hi {name || 'there'}!</Text>
            </Animated.View>
            {ITEMS.map((it, i) => (
              <Animated.View key={it.label} entering={FadeInLeft.delay(40 + i * 45).springify().damping(15)}>
                <Pressable onPress={() => go(it.go)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10 }}>
                  <View style={{ width: 34, alignItems: 'center' }}>{React.cloneElement(it.icon as any, { color: t.text })}</View>
                  <Text style={{ fontFamily: fonts.serif, fontSize: 21, color: t.text }}>{it.label}</Text>
                </Pressable>
              </Animated.View>
            ))}
            <Animated.View entering={FadeInLeft.delay(480).springify()}>
              <Pressable
                onPress={() =>
                  go(() => {
                    logout();
                    router.replace('/onboarding');
                  })
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10, marginTop: 20 }}
              >
                <View style={{ width: 34, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="logout-variant" size={30} color={t.text} />
                </View>
                <Text style={{ fontFamily: fonts.serif, fontSize: 21, color: t.text }}>Logout</Text>
              </Pressable>
            </Animated.View>
            <Animated.View entering={FadeInLeft.delay(560).springify()} style={{ marginTop: 26 }}>
              <RosierLogo width={96} color={t.text} />
              <Tagline style={{ fontFamily: fonts.serif, fontSize: 13, color: t.textSoft, marginTop: 2 }} />
            </Animated.View>
          </>
        )}
      </View>

      {/* Ghost card behind for depth */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bg, borderRadius: 32 }, ghost]} />

      {/* App card */}
      <Animated.View style={[{ flex: 1, overflow: 'hidden', backgroundColor: t.bg }, card]}>
        {children}
        {open && <Pressable onPress={() => setOpen(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
      </Animated.View>

      {open && (
        <Animated.View entering={FadeInLeft.delay(150)} style={{ position: 'absolute', top: insets.top + 24, right: 22 }}>
          <PressableScale
            onPress={() => setOpen(false)}
            style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: t.mode === 'dark' ? '#3E2415' : '#C9A58C', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 24, color: t.text }}>X</Text>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

