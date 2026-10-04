/**
 * Benefits Club page for people who have joined: their member card, what's active,
 * progress to the free ghee, renewal, and member-only updates from the admin panel.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { isLive, useContent } from '../config/remote';
import { openLink } from '../lib/links';
import type { Membership } from '../lib/membership';
import { rupee } from '../lib/format';
import { useAuth } from '../store/auth';
import { useApp } from '../store/app';
import { fonts } from '../theme';
import { Editable } from './Editable';
import { Button, Img } from './ui';

const GOLD = '#E8C27A';
const SOFT = '#C9B8A8';
const fmt = (t: number | null) => (t ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function MemberCard({ name, m, pct }: { name: string; m: Membership; pct: number }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const tilt = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${interpolate(r.value, [0, 1], [-8, 8])}deg` }, { rotateX: `${interpolate(r.value, [0, 1], [5, -5])}deg` }],
  }));
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(r.value, [0, 1], [-220, 300]) }, { rotate: '20deg' }] }));
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} style={[{ alignSelf: 'center' }, tilt]}>
      <LinearGradient colors={['#2A1A0E', '#5A3A1C', '#2A1A0E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 320, height: 196, borderRadius: 22, padding: 20, borderWidth: 1.2, borderColor: '#B08442', overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', top: -60, width: 60, height: 340, backgroundColor: 'rgba(255,220,150,0.14)' }, shine]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 24, color: GOLD, letterSpacing: 3 }}>ROSIER</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 9.5, color: GOLD, letterSpacing: 3 }}>BENEFITS CLUB</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(155,212,155,0.16)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#9BD49B' }} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10, color: '#9BD49B', letterSpacing: 1 }}>ACTIVE</Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 21, color: '#FBE6CF', marginTop: 22 }} numberOfLines={1}>
          {name || 'Rosier Member'}
        </Text>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: '#C9A06A', letterSpacing: 1.5, marginTop: 2 }}>
          {pct > 0 ? `FLAT ${pct}% OFF · ` : ''}
          {m.plan ? m.plan.toUpperCase() : 'MEMBER'}
        </Text>
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 9, color: '#8F7D6E', letterSpacing: 1.5 }}>MEMBER SINCE</Text>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: '#FBE6CF' }}>{fmt(m.since) || '—'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 9, color: '#8F7D6E', letterSpacing: 1.5 }}>VALID TILL</Text>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: '#FBE6CF' }}>{m.until ? fmt(m.until) : 'Active'}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="crown" size={110} color="rgba(232,194,122,0.07)" style={{ position: 'absolute', right: -10, bottom: -18 }} />
      </LinearGradient>
    </Animated.View>
  );
}

function Bar({ value, color = GOLD }: { value: number; color?: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [value]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: color }, a]} />
    </View>
  );
}

const box = { backgroundColor: 'rgba(232,194,122,0.06)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(232,194,122,0.18)' } as const;

export function MemberView({ m, onRenew }: { m: Membership; onRenew: () => void }) {
  const b = useContent('benefits');
  const customer = useAuth((s) => s.customer);
  const appName = useApp((s) => s.name);
  const pct = Number(b.memberDiscountPercent) || 0;
  const saved = Math.round((m.spent * pct) / (100 - pct || 100));
  const target = Number(b.gheeTarget) || 0;
  const renew = m.daysLeft != null && m.daysLeft <= (Number(b.renewDays) || 15);
  const totalDays = m.since && m.until ? Math.max(1, (m.until - m.since) / 86400000) : 0;
  const updates = (b.updates ?? []).filter((u) => u && u.title && isLive(u)).sort((x, y) => Number(!!y.pinned) - Number(!!x.pinned) || Date.parse(y.date || '0') - Date.parse(x.date || '0'));

  return (
    <View style={{ gap: 14 }}>
      <MemberCard name={customer?.name || appName} m={m} pct={pct} />
      <Animated.Text entering={FadeInDown.delay(150)} style={{ fontFamily: fonts.serif, fontSize: 28, color: '#FBE6CF', textAlign: 'center', marginTop: 12 }}>
        {b.memberTitle}
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(220)} style={{ fontFamily: fonts.sans, fontSize: 13.5, color: SOFT, textAlign: 'center', marginTop: -6 }}>
        {b.memberSubtitle}
      </Animated.Text>

      {/* Numbers */}
      <Animated.View entering={FadeInDown.delay(280)} style={{ flexDirection: 'row', gap: 10 }}>
        {[
          ['Orders as member', String(m.orders.length)],
          ['You’ve saved', saved > 0 ? `≈ ${rupee(saved)}` : '—'],
          ['Days left', m.daysLeft != null ? String(m.daysLeft) : '∞'],
        ].map(([k, v]) => (
          <View key={k} style={[box, { flex: 1, padding: 12, alignItems: 'center' }]}>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 20, color: GOLD }}>{v}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, color: SOFT, textAlign: 'center' }}>{k}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Validity */}
      {totalDays > 0 && m.daysLeft != null && (
        <Animated.View entering={FadeInDown.delay(320)} style={box}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: '#FBE6CF' }}>Membership</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: renew ? '#F3A57B' : SOFT }}>
              {m.daysLeft} day{m.daysLeft === 1 ? '' : 's'} left
            </Text>
          </View>
          <Bar value={m.daysLeft / totalDays} color={renew ? '#F3A57B' : GOLD} />
          {renew && <Button kind="gold" small label="Renew membership" icon="refresh" onPress={onRenew} style={{ marginTop: 12 }} />}
        </Animated.View>
      )}

      {/* Free ghee progress */}
      {target > 0 && (
        <Animated.View entering={FadeInDown.delay(360)} style={box}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <MaterialCommunityIcons name="bottle-tonic-outline" size={22} color={GOLD} />
            <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 13.5, color: '#FBE6CF' }}>{b.gheeTitle}</Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: GOLD }}>
              {rupee(Math.min(m.spent, target))} / {rupee(target)}
            </Text>
          </View>
          <Bar value={m.spent / target} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: SOFT, marginTop: 8 }}>
            {m.spent >= target ? 'Unlocked! We’ll add your free ghee to your next order 🎉' : `${rupee(target - m.spent)} more in orders to unlock it.`}
          </Text>
        </Animated.View>
      )}

      {/* Active benefits */}
      <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: GOLD, marginTop: 6 }}>Your benefits</Text>
      {b.perks.map((p, i) => (
        <Animated.View key={`${p.title}-${i}`} entering={FadeInDown.delay(400 + i * 60).springify()} style={[box, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }]}>
          <View style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#8B6230', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={p.icon as any} size={22} color={GOLD} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: '#FBE6CF' }}>{p.title}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: SOFT }}>{p.body}</Text>
          </View>
          <MaterialCommunityIcons name="check-circle" size={20} color="#9BD49B" />
        </Animated.View>
      ))}

      {/* Member-only updates */}
      {updates.length > 0 && (
        <Editable id="benefits" label="Member updates">
          <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: GOLD, marginTop: 10, marginBottom: 10 }}>{b.updatesTitle}</Text>
          <View style={{ gap: 10 }}>
            {updates.map((u, i) => (
              <Animated.View key={u.id || i} entering={FadeInDown.delay(i * 60)} style={[box, { padding: 0, overflow: 'hidden' }]}>
                {!!u.image && <Img source={u.image} size={360} style={{ width: '100%', height: 160 }} contentFit="cover" />}
                <View style={{ padding: 14, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {u.pinned && <MaterialCommunityIcons name="pin" size={14} color={GOLD} />}
                    <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 14.5, color: '#FBE6CF' }}>{u.title}</Text>
                    {!!u.date && <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#8F7D6E' }}>{fmt(Date.parse(u.date))}</Text>}
                  </View>
                  {!!u.body && <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: SOFT, lineHeight: 18 }}>{u.body}</Text>}
                  {!!u.link && (
                    <Pressable onPress={() => openLink(u.link)} hitSlop={6}>
                      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: GOLD, marginTop: 4 }}>Open →</Text>
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            ))}
          </View>
        </Editable>
      )}

      <Button kind="gold" label="Shop with member price" icon="bag-handle-outline" onPress={() => router.navigate('/shop')} style={{ marginTop: 8 }} />
    </View>
  );
}
