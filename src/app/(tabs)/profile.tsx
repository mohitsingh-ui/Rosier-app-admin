import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { Coin } from '../../components/Coin';
import { CountUp, PressableScale, Txt } from '../../components/ui';
import { openStorePage } from '../../lib/cart';
import { tap } from '../../lib/haptics';
import { isLive, useContent } from '../../config/remote';
import { useMembership } from '../../lib/membership';
import { registerPush, usePushState } from '../../lib/push';
import { Linking, Platform } from 'react-native';
import { useApp } from '../../store/app';
import { signOut, useAuth, useLoggedIn, useShopifyFlags } from '../../store/auth';
import { useCoins, useOrders, useWishlist } from '../../store/shop';
import { fonts, useTheme } from '../../theme';

/** Lets customers switch off snow / sparkles etc. Only shown while an effect is running. */
function EffectsSwitch() {
  const t = useTheme();
  const cfg = useContent('effects');
  const off = useApp((s) => s.effectsOff);
  const setOff = useApp((s) => s.setEffectsOff);
  const live = cfg?.enabled && cfg.userToggle && (cfg.items ?? []).find((e) => e && isLive(e));
  if (!live) return null;
  return (
    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 }}>
      <MaterialCommunityIcons name="snowflake-variant" size={20} color={t.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: t.text }}>Seasonal effects</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: t.textMute }} numberOfLines={1}>
          {live.name || 'Festive animation'} on the screen
        </Text>
      </View>
      <Switch
        value={!off}
        onValueChange={(v) => {
          tap();
          setOff(!v);
        }}
        trackColor={{ true: t.primary, false: t.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

/** Are phone notifications working here? One tap to fix. */
function NotifyRow() {
  const t = useTheme();
  const st = usePushState();
  if (Platform.OS === 'web') return null;
  const on = st.mode === 'push' || st.mode === 'background';
  const label = st.mode === 'push' ? 'On' : st.mode === 'background' ? 'On (checks every ~15 min)' : st.mode === 'denied' ? 'Blocked in phone settings' : 'Off';
  return (
    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
      <MaterialCommunityIcons name={on ? 'bell-ring-outline' : 'bell-off-outline'} size={20} color={on ? t.green : t.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: t.text }}>Notifications: {label}</Text>
        {!!st.detail && st.mode !== 'push' && (
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute }} numberOfLines={2}>
            {st.detail}
          </Text>
        )}
      </View>
      {!on && (
        <Pressable
          onPress={async () => {
            tap();
            if (st.mode === 'denied') return Linking.openSettings();
            await registerPush(true);
          }}
          style={{ backgroundColor: t.deepAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: '#FBE6CF' }}>{st.mode === 'denied' ? 'Open settings' : 'Turn on'}</Text>
        </Pressable>
      )}
    </View>
  );
}

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
  const flags = useShopifyFlags();
  const loggedIn = useLoggedIn();
  const customer = useAuth((s) => s.customer);
  const acc = useContent('account');
  const track = useContent('tracking');
  const member = useMembership();
  const coupons = useContent('coupons');
  const orderCount = loggedIn && customer ? customer.orders.length : orders;

  const rows: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub?: string; go: () => void }[] = [
    { icon: 'package-variant-closed', label: 'My Orders', sub: 'Track, reorder, review', go: () => router.push('/orders') },
    ...(track.enabled ? [{ icon: 'truck-fast-outline' as const, label: track.title || 'Track order', sub: 'Courier status & tracking number', go: () => router.push('/track') }] : []),
    ...(coupons.enabled && coupons.showList ? [{ icon: 'ticket-percent-outline' as const, label: coupons.listTitle || 'Coupons', sub: 'Offers you can use', go: () => router.push('/coupons') }] : []),
    { icon: 'heart-outline', label: 'Wishlist', sub: `${wish} saved`, go: () => router.push('/wishlist') },
    { icon: 'history', label: 'Coin History', sub: 'Every coin, in and out', go: () => router.push('/coin-history') },
    { icon: 'crown-outline', label: 'Benefits Club', sub: member.active ? `Member${member.daysLeft != null ? ` · ${member.daysLeft} days left` : ''}` : 'Member perks & free shipping', go: () => router.push('/benefits-club') },
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
              <CountUp value={orderCount} style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: '#fff' }} />
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

      {flags.loginEnabled && !loggedIn && (
        <Animated.View entering={FadeInDown.delay(80).springify()} style={{ marginTop: 14 }}>
          <PressableScale scaleTo={0.98} onPress={() => router.push('/login')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.cardStrong, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: t.primary }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="account-key-outline" size={22} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>{acc.profileCardTitle}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft }}>{acc.profileCardBody}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.textMute} />
          </PressableScale>
        </Animated.View>
      )}
      {loggedIn && customer && (
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.greenSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
          <MaterialCommunityIcons name="check-decagram" size={18} color={t.green} />
          <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 12.5, color: t.green }} numberOfLines={1}>
            Logged in as {customer.email || customer.name}
          </Text>
          {member.active && (
            <Pressable onPress={() => router.push('/benefits-club')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3E2415', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
              <MaterialCommunityIcons name="crown" size={12} color="#E8C27A" />
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: '#E8C27A' }}>MEMBER</Text>
            </Pressable>
          )}
        </View>
      )}

      <Txt v="label" color={t.textMute} style={{ marginTop: 24, marginBottom: 10 }}>
        Appearance
      </Txt>
      <ThemeSwitch />
      <EffectsSwitch />
      <NotifyRow />

      <Txt v="label" color={t.textMute} style={{ marginTop: 24, marginBottom: 6 }}>
        Your account
      </Txt>
      <View style={{ backgroundColor: t.cardStrong, borderRadius: 20, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <Animated.View key={r.label} entering={FadeInDown.delay(Math.min(i, 6) * 35)}>
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
          signOut();
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
