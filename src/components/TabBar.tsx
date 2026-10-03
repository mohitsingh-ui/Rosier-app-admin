import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tap } from '../lib/haptics';
import { useCartCount } from '../store/shop';
import { fonts, useTheme } from '../theme';
import { useFly } from './FlyToCart';
import { RosierLogo } from './Logo';

type Tab = { name: string; label: string; icon: (c: string, s: number) => React.ReactNode };

export const TABS: Tab[] = [
  { name: 'profile', label: 'Profile', icon: (c, s) => <Ionicons name="person-circle-outline" size={s} color={c} /> },
  { name: 'coins', label: 'Coins', icon: (c, s) => <MaterialCommunityIcons name="database-outline" size={s} color={c} /> },
  { name: 'home', label: 'Home', icon: (c, s) => <Ionicons name="add" size={s + 2} color={c} /> },
  { name: 'shop', label: 'Product', icon: (c, s) => <MaterialCommunityIcons name="shape-outline" size={s} color={c} /> },
  { name: 'cart', label: 'Cart', icon: (c, s) => <Ionicons name="cart-outline" size={s} color={c} /> },
];

const BUBBLE = 66;

function RosierMark() {
  return <RosierLogo width={50} color="#FBE6CF" />;
}

export function TabBar({ state, navigation }: any) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const cartCount = useCartCount();
  const bump = useFly((s) => s.bump);
  const badge = useSharedValue(1);

  const routes: { key: string; name: string }[] = state.routes;
  const activeName = routes[state.index]?.name;
  const activeIdx = Math.max(0, TABS.findIndex((tb) => tb.name === activeName));
  const slot = w / TABS.length;

  useEffect(() => {
    if (!w) return;
    x.value = withSpring(activeIdx * slot + slot / 2 - BUBBLE / 2, { damping: 16, stiffness: 180, mass: 0.8 });
  }, [activeIdx, w]);

  useEffect(() => {
    if (bump) badge.value = withSequence(withTiming(1.6, { duration: 120 }), withSpring(1, { damping: 6 }));
  }, [bump]);

  const bubble = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.value }] }));

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={{
        backgroundColor: t.tabBar,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 12,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -4 },
        elevation: 16,
      }}
    >
      {w > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -26,
              left: 0,
              width: BUBBLE,
              height: BUBBLE,
              borderRadius: BUBBLE / 2,
              backgroundColor: t.mode === 'dark' ? '#5A3520' : '#3E2415',
              borderWidth: 5,
              borderColor: t.mode === 'dark' ? '#2A221D' : '#FFFBF5',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#3E2415',
              shadowOpacity: 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 18,
              zIndex: 5,
            },
            bubble,
          ]}
        >
          <Animated.View key={activeName} entering={ZoomIn.springify().damping(12)}>
            {activeName === 'home' ? <RosierMark /> : TABS[activeIdx].icon('#FBE6CF', 26)}
          </Animated.View>
        </Animated.View>
      )}
      {TABS.map((tab) => {
        const route = routes.find((r) => r.name === tab.name);
        const focused = activeName === tab.name;
        return (
          <Pressable
            key={tab.name}
            onPress={() => {
              tap();
              if (!route) return;
              const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !ev.defaultPrevented) navigation.navigate(tab.name);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 52 }}
          >
            <View style={{ opacity: focused ? 0 : 1, height: 30, justifyContent: 'center' }}>
              {tab.icon(t.text, 26)}
              {tab.name === 'cart' && cartCount > 0 && (
                <Animated.View
                  style={[
                    { position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#C0392B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
                    badgeStyle,
                  ]}
                >
                  <Text style={{ color: '#fff', fontFamily: fonts.sansSemi, fontSize: 10 }}>{cartCount}</Text>
                </Animated.View>
              )}
            </View>
            <Text style={{ fontFamily: focused ? fonts.sansSemi : fonts.sans, fontSize: 12, color: t.text, marginTop: 2 }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
