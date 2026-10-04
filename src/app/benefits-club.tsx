import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '../components/Toast';
import { Button, PressableScale } from '../components/ui';
import { findProduct, useProducts } from '../data/catalog';
import { rupee } from '../lib/format';
import { success } from '../lib/haptics';
import { useCart } from '../store/shop';
import { useContent } from '../config/remote';
import { fonts } from '../theme';
import { MemberView } from '../components/MemberView';
import { useMembership } from '../lib/membership';
import { login, useLoggedIn, useShopifyFlags } from '../store/auth';

const GOLD = '#E8C27A';

function Card({ title, sub, footer }: { title: string; sub: string; footer: string }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${interpolate(r.value, [0, 1], [-10, 10])}deg` }, { rotateX: `${interpolate(r.value, [0, 1], [6, -6])}deg` }],
  }));
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(r.value, [0, 1], [-200, 260]) }, { rotate: '20deg' }] }));
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} style={[{ alignSelf: 'center' }, a]}>
      <LinearGradient colors={['#1C120B', '#4A2C17', '#1C120B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 300, height: 180, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#8B6230', overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', top: -60, width: 60, height: 320, backgroundColor: 'rgba(255,220,150,0.12)' }, shine]} />
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, color: GOLD, letterSpacing: 3 }}>{title}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: GOLD, letterSpacing: 3 }}>{sub}</Text>
        <MaterialCommunityIcons name="crown" size={34} color={GOLD} style={{ position: 'absolute', right: 20, top: 20 }} />
        <Text style={{ position: 'absolute', left: 20, bottom: 20, fontFamily: fonts.sansMedium, fontSize: 12, color: '#C9A06A', letterSpacing: 2 }}>{footer}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

export default function BenefitsClub() {
  const insets = useSafeAreaInsets();
  const products = useProducts();
  const b = useContent('benefits');
  const PERKS = b.perks.map((p) => [p.icon, p.title, p.body] as [any, string, string]);
  const membership = findProduct(products, b.membershipHandle || 'membership');
  const [vid, setVid] = useState(membership?.variants[1]?.id ?? membership?.variants[0]?.id);
  const add = useCart((s) => s.add);
  const v = membership?.variants.find((x) => x.id === vid);
  const m = useMembership();
  const loggedIn = useLoggedIn();
  const flags = useShopifyFlags();
  const [plans, setPlans] = useState(false);
  const showMember = m.active && !plans;
  const doLogin = async () => {
    try {
      if (await login()) toast('You’re logged in', 'ok');
    } catch (e: any) {
      toast(e?.message || 'Login didn’t work. Please try again.', 'info');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#140D08' }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 20, paddingBottom: 140 }}>
        {showMember ? (
          <MemberView m={m} onRenew={() => setPlans(true)} />
        ) : (
          <>
        {m.expired && (
          <View style={{ backgroundColor: 'rgba(243,165,123,0.12)', borderRadius: 14, padding: 12, marginBottom: 18, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <MaterialCommunityIcons name="calendar-alert" size={22} color="#F3A57B" />
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: '#F3D2BE' }}>
              Your membership ended{m.until ? ` on ${new Date(m.until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}. Renew to get your benefits back.
            </Text>
          </View>
        )}
        <Card title={b.bannerTitle} sub={b.bannerSubtitle} footer={b.cardFooter} />
        <Animated.Text entering={FadeInDown.delay(200)} style={{ fontFamily: fonts.serif, fontSize: 30, color: '#FBE6CF', textAlign: 'center', marginTop: 28 }}>
          {b.pageTitle}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(300)} style={{ fontFamily: fonts.sans, fontSize: 14, color: '#C9B8A8', textAlign: 'center', marginTop: 6 }}>
          {b.pageSubtitle}
        </Animated.Text>

        <View style={{ marginTop: 24, gap: 10 }}>
          {PERKS.map(([icon, title, body], i) => (
            <Animated.View key={`${title}-${i}`} entering={FadeInDown.delay(350 + i * 80).springify()} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(232,194,122,0.06)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(232,194,122,0.18)' }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: '#8B6230', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={icon} size={24} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: '#FBE6CF' }}>{title}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: '#C9B8A8' }}>{body}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {membership && (
          <>
            <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: GOLD, marginTop: 28, marginBottom: 12 }}>{b.plansTitle}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {membership.variants.map((x) => {
                const active = x.id === vid;
                const months = parseInt(x.title, 10) || 1;
                return (
                  <PressableScale key={x.id} onPress={() => setVid(x.id)} style={{ flex: 1, borderRadius: 18, padding: 14, alignItems: 'center', backgroundColor: active ? GOLD : 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: active ? GOLD : 'rgba(232,194,122,0.3)' }}>
                    {months === Number(b.popularPlanMonths) && (
                      <View style={{ position: 'absolute', top: -10, backgroundColor: '#C47A48', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 9, color: '#fff' }}>POPULAR</Text>
                      </View>
                    )}
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: active ? '#3E2415' : '#C9B8A8' }}>{x.title}</Text>
                    <Text style={{ fontFamily: fonts.serifBold, fontSize: 22, color: active ? '#1C120B' : '#FBE6CF', marginTop: 4 }}>{rupee(x.price)}</Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: active ? '#5A3520' : '#8F7D6E' }}>{rupee(Math.round(x.price / months))}/month</Text>
                  </PressableScale>
                );
              })}
            </View>
          </>
        )}
        {flags.loginEnabled && !loggedIn && (
          <Pressable onPress={doLogin} style={{ marginTop: 22, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(232,194,122,0.35)' }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: GOLD }}>{b.loginPrompt}</Text>
          </Pressable>
        )}
          </>
        )}
      </ScrollView>

      <Pressable onPress={() => router.back()} style={{ position: 'absolute', top: insets.top + 8, left: 16, width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={GOLD} />
      </Pressable>

      {!showMember && membership && v && (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 16 }}>
          <Button
            kind="gold"
            label={`${m.active || m.expired ? 'Renew' : 'Join'} for ${rupee(v.price)}`}
            icon="sparkles"
            onPress={() => {
              add(membership.handle, v.id);
              success();
              toast('Membership added to your cart', 'ok');
              router.navigate('/cart');
            }}
          />
        </View>
      )}
    </View>
  );
}
