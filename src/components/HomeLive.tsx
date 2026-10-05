/** Home screen extras: the live "Your order" card and the ask-for-notifications card. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { IN_EDITOR, useContent } from '../config/remote';
import { pushStatus, registerPush } from '../lib/push';
import { useApp } from '../store/app';
import { useAuth, useLoggedIn } from '../store/auth';
import { fonts, useTheme } from '../theme';
import { trackState, trackSummary } from './Tracking';
import { toast } from './Toast';
import { LinearGradient } from 'expo-linear-gradient';
import { Editable } from './Editable';
import { Img, PressableScale } from './ui';

const STEPS = ['Placed', 'Packed', 'Shipped', 'Out', 'Delivered'];

function Pulse({ color }: { color: string }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(0, { duration: 1400 }), -1, false);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scale: 2.4 - s.value * 1.4 }] }));
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: color }, a]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

/** The customer's current order, live (refreshes when an order notification arrives). */
export function LiveOrderCard() {
  const t = useTheme();
  const cfg = useContent('push');
  const loggedIn = useLoggedIn();
  const customer = useAuth((s) => s.customer);
  if (!cfg.liveCard || !loggedIn || !customer) return null;
  const order = customer.orders.find((o) => {
    if (o.cancelled) return false;
    if (Date.now() - Date.parse(o.processedAt) > 20 * 86400000) return false;
    return trackState(o).level < 4;
  });
  if (!order) return null;
  const st = trackState(order);
  const sum = trackSummary(order);
  return (
    <Animated.View entering={FadeInDown.springify()} style={{ marginHorizontal: 20, marginTop: 14 }}>
      <Pressable
        onPress={() => router.push({ pathname: '/track', params: { order: order.name } })}
        style={({ pressed }) => ({ backgroundColor: t.deep, borderRadius: 20, padding: 14, opacity: pressed ? 0.9 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(243,212,139,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={st.level >= 2 ? 'truck-fast-outline' : 'package-variant-closed'} size={22} color="#F3D48B" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pulse color={sum.tone === 'danger' ? '#F3A57B' : '#9BD49B'} />
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: '#FBE6CF' }}>{sum.label}</Text>
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#C9B8A8' }} numberOfLines={1}>
              Order {order.name}
              {st.eta ? ` · arriving by ${new Date(st.eta).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: '#F3D48B' }}>Track ›</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= st.level ? '#F3D48B' : 'rgba(255,255,255,0.14)' }} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 9.5, color: i <= st.level ? '#FBE6CF' : '#8F7D6E' }}>{s}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Our own "turn on notifications" card, shown once, before the phone's permission pop-up. */
export function PushAsk() {
  const t = useTheme();
  const cfg = useContent('push');
  const asked = useApp((s) => s.pushAsked);
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    if (!asked && Platform.OS !== 'web') pushStatus().then(setState);
  }, [asked]);
  if (IN_EDITOR || asked || !cfg.enabled || state !== 'undetermined') return null;
  const done = () => useApp.setState({ pushAsked: true });
  return (
    <Animated.View entering={FadeInDown.delay(160).springify()} exiting={FadeOut} style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: t.cardStrong, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: t.border, flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="bell-ring-outline" size={24} color={t.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: t.text }}>{cfg.askTitle}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: t.textSoft, marginTop: 2 }}>{cfg.askBody}</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, alignItems: 'center' }}>
          <Pressable
            onPress={async () => {
              done();
              const ok = await registerPush(true);
              toast(ok ? 'Notifications are on 🔔' : 'You can turn notifications on any time in your phone settings', ok ? 'ok' : 'info');
            }}
            style={{ backgroundColor: t.deepAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: '#FBE6CF' }}>{cfg.askButton}</Text>
          </Pressable>
          <Pressable onPress={done} hitSlop={8}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.textMute }}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

/* ───────── Website pages promoted on Home (admin → Website pages in the app → "Show a card on Home") ───────── */

export function HomePageCards() {
  const t = useTheme();
  const pages = (((useContent('webPages' as any) as any)?.items ?? []) as any[]).filter((p) => p && p.enabled !== false && p.handle && p.showOnHome);
  if (!pages.length) return null;
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 12, gap: 10 }}>
      {pages.map((p, i) => (
        <Animated.View key={p.handle + i} entering={FadeInDown.delay(60 * i).springify()}>
          <Editable id="webPages" label="Website page card">
            <PressableScale onPress={() => router.push({ pathname: '/page/[handle]', params: { handle: p.id || p.handle } })} style={{ borderRadius: 20, overflow: 'hidden' }}>
              {p.homeImage ? (
                <Img source={p.homeImage} size={600} style={{ width: '100%', aspectRatio: Number(p.homeImageRatio) > 0 ? Number(p.homeImageRatio) : 2.4 }} contentFit="cover" />
              ) : (
                <LinearGradient colors={['#5A2E14', '#A56312']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                  <Text style={{ fontSize: 34 }}>{p.homeEmoji || '🎁'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.serif, fontSize: 19, color: '#FFF5E8' }}>{p.homeTitle || p.title}</Text>
                    {!!(p.homeSub ?? 'Tap to explore') && <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: '#F3D9BC', marginTop: 2 }}>{p.homeSub ?? 'Tap to explore'}</Text>}
                  </View>
                  <View style={{ backgroundColor: '#F3D48B', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: '#3E2415' }}>{p.homeButton || 'View'}</Text>
                  </View>
                </LinearGradient>
              )}
            </PressableScale>
          </Editable>
        </Animated.View>
      ))}
    </View>
  );
}
