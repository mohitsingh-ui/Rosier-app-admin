import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Coin } from '../../components/Coin';
import { CountUp, PressableScale, Txt } from '../../components/ui';
import { openStorePage } from '../../lib/cart';
import { tap } from '../../lib/haptics';
import { useApp } from '../../store/app';
import { useCoins, useOrders, useWishlist } from '../../store/shop';
import { fonts, useTheme } from '../../theme';

function ThemeSwitch() {
  const t = useTheme();
  const pref = useApp((s) => s.themePref);
  const set = useApp((s) => s.setThemePref);
  const opts = ['light', 'dark', 'system'] as const;
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const idx = opts.indexOf(pref);
  useEffect(() => {
    x.value = withSpring((idx * w) / 3, { damping: 16 });
  }, [idx, w]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 8)} style={{ flexDirection: 'row', backgroundColor: t.card, borderRadius: 14, padding: 4 }}>
      {w > 0 && <Animated.View style={[{ position: 'absolute', top: 4, left: 4, bottom: 4, width: w / 3, borderRadius: 10, backgroundColor: t.deepAlt }, a]} />}
      {opts.map((o) => (
        <Pressable
          key={o}
          onPress={() => {
            tap();
            set(o);
          }}
          style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
        >
          <Ionicons name={o === 'light' ? 'sunny-outline' : o === 'dark' ? 'moon-outline' : 'phone-portrait-outline'} size={15} color={pref === o ? '#FBE6CF' : t.textSoft} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: pref === o ? '#FBE6CF' : t.textSoft, textTransform: 'capitalize' }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Profile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { name, phone, email } = useApp();
  const logout = useApp((s) => s.logout);
  const balance = useCoins((s) => s.balance);
  const orders = useOrders((s) => s.orders.length);
  const wish = useWishlist((s) => s.handles.length);

  const rows: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub?: string; go: () => void }[] = [
    { icon: 'package-variant-closed', label: 'My Orders', sub: 'Track, reorder, review', go: () => router.push('/orders') },
    { icon: 'heart-outline', label: 'Wishlist', sub: `${wish} saved`, go: () => router.push('/wishlist') },
    { icon: 'history', label: 'Coin History', sub: 'Every coin, in and out', go: () => router.push('/coin-history') },
    { icon: 'crown-outline', label: 'Benefits Club', sub: 'Member perks & free shipping', go: () => router.push('/benefits-club') },
    { icon: 'gift-outline', label: 'Gifting', sub: 'Hampers & combos', go: () => router.push('/gifting') },
    { icon: 'bell-outline', label: 'Notifications', go: () => router.push('/notifications') },
    { icon: 'sprout-outline', label: 'Our Story', go: () => router.push('/about') },
    { icon: 'flask-outline', label: 'Lab Reports', go: () => openStorePage('/pages/lab-test-reports') },
    { icon: 'newspaper-variant-outline', label: 'Blog & Articles', go: () => router.push('/blog') },
    { icon: 'lifebuoy', label: 'Help & Support', go: () => router.push('/help') },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
      <Txt v="h1">Profile</Txt>

      <Animated.View entering={FadeInDown.springify()} style={{ marginTop: 14 }}>
        <LinearGradient colors={['#4A2C17', '#7A4B25']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar size={64} editable />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: '#FFF5E8' }}>{name || 'Your name'}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#E9D6C0' }}>{phone || email || 'Add your phone & email'}</Text>
            </View>
            <PressableScale onPress={() => router.push('/account')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color="#FFF5E8" />
            </PressableScale>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, paddingVertical: 12 }}>
            <Pressable onPress={() => router.navigate('/coins')} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Coin size={20} />
                <CountUp value={balance} style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: '#fff' }} />
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#E9D6C0' }}>Coins</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <Pressable onPress={() => router.push('/orders')} style={{ flex: 1, alignItems: 'center' }}>
              <CountUp value={orders} style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: '#fff' }} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#E9D6C0' }}>Orders</Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <Pressable onPress={() => router.push('/wishlist')} style={{ flex: 1, alignItems: 'center' }}>
              <CountUp value={wish} style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: '#fff' }} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#E9D6C0' }}>Wishlist</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>

      <Txt v="label" color={t.textMute} style={{ marginTop: 24, marginBottom: 10 }}>
        Appearance
      </Txt>
      <ThemeSwitch />

      <Txt v="label" color={t.textMute} style={{ marginTop: 24, marginBottom: 6 }}>
        Your account
      </Txt>
      <View style={{ backgroundColor: t.cardStrong, borderRadius: 20, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <Animated.View key={r.label} entering={FadeInDown.delay(i * 40)}>
            <Pressable
              onPress={() => {
                tap();
                r.go();
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: pressed ? t.card : 'transparent', borderTopWidth: i ? 1 : 0, borderColor: t.border })}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={r.icon} size={20} color={t.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: t.text }}>{r.label}</Text>
                {r.sub && <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute }}>{r.sub}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textMute} />
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <PressableScale
        onPress={() => {
          logout();
          router.replace('/onboarding');
        }}
        style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: t.border }}
      >
        <MaterialCommunityIcons name="logout-variant" size={20} color={t.textSoft} />
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: t.textSoft }}>Logout</Text>
      </PressableScale>
      <Text style={{ textAlign: 'center', fontFamily: fonts.sans, fontSize: 11, color: t.textMute, marginTop: 16 }}>Rosier Foods Pvt. Ltd. · App v1.0.0</Text>
    </ScrollView>
  );
}
