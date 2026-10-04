/**
 * Cart rewards like the website: "Add ₹X more to get a FREE gift". Gifts are added to
 * the order automatically once the cart reaches the amount (admin → Cart rewards).
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Content, isLive, useContent } from '../config/remote';
import { success } from '../lib/haptics';
import { rupee } from '../lib/format';
import { fonts, useTheme } from '../theme';
import { Editable } from './Editable';
import { toast } from './Toast';
import { Img } from './ui';

type Reward = Content['rewards']['items'][number];
export type GiftLine = { variantId: number; qty: number; title: string; image: string; reward: string };

const fillText = (s: string, r: Reward, left: number) =>
  String(s || '')
    .replaceAll('{left}', rupee(Math.max(0, Math.ceil(left))).replace('₹', ''))
    .replaceAll('{gift}', r.giftTitle || r.title)
    .replaceAll('{amount}', String(r.minAmount));

export function useRewards(amount: number) {
  const cfg = useContent('rewards');
  return useMemo(() => {
    const tiers = cfg.enabled ? (cfg.items ?? []).filter((r) => r && isLive(r) && Number(r.minAmount) > 0).sort((a, b) => a.minAmount - b.minAmount) : [];
    const unlocked = tiers.filter((r) => amount >= r.minAmount);
    const next = tiers.find((r) => amount < r.minAmount) ?? null;
    const gifts: GiftLine[] = unlocked
      .filter((r) => r.kind === 'gift' && r.autoAdd !== false && /^\d+$/.test(String(r.variantId).trim()))
      .map((r) => ({ variantId: Number(String(r.variantId).trim()), qty: Math.max(1, Number(r.qty) || 1), title: r.giftTitle || r.title, image: r.giftImage, reward: r.id }));
    return { cfg, tiers, unlocked, next, gifts };
  }, [cfg, amount]);
}

export function RewardsBar({ amount }: { amount: number }) {
  const t = useTheme();
  const { cfg, tiers, unlocked, next } = useRewards(amount);
  const max = tiers.length ? tiers[tiers.length - 1].minAmount : 1;
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.min(1, amount / max), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [amount, max]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  // Celebrate when a new reward unlocks.
  const prev = useRef(unlocked.length);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (unlocked.length > prev.current) {
      const r = unlocked[unlocked.length - 1];
      success();
      toast(fillText(r.unlockedText, r, 0), 'ok');
      pop.value = withSequence(withSpring(1.08), withSpring(1));
    }
    prev.current = unlocked.length;
  }, [unlocked.length]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  if (!cfg.showBar || !tiers.length) return null;
  const last = unlocked[unlocked.length - 1];
  const msg = next ? fillText(next.lockedText, next, next.minAmount - amount) : last ? fillText(last.unlockedText, last, 0) : '';
  return (
    <Editable id="rewards" label="Cart rewards">
      <Animated.View entering={FadeInDown} style={[{ backgroundColor: t.cardStrong, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: t.border, marginBottom: 14 }, popStyle]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialCommunityIcons name={next ? 'gift-outline' : 'gift-open'} size={20} color={next ? t.primary : t.green} />
          <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 13.5, color: next ? t.text : t.green }}>{msg}</Text>
        </View>
        <View style={{ height: 22, marginTop: 10, justifyContent: 'center' }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.card, overflow: 'hidden' }}>
            <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: next ? t.primary : t.green }, bar]} />
          </View>
          {tiers.map((r) => {
            const done = amount >= r.minAmount;
            return (
              <View key={r.id} style={{ position: 'absolute', left: `${(r.minAmount / max) * 100}%`, marginLeft: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: done ? t.green : t.cardStrong, borderWidth: 2, borderColor: done ? t.green : t.border, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={r.kind === 'gift' ? 'gift' : r.kind === 'shipping' ? 'truck-fast' : 'percent'} size={11} color={done ? '#fff' : t.textMute} />
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, color: t.textMute }}>{rupee(Math.round(amount))}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, color: t.textMute }}>{tiers.map((r) => rupee(r.minAmount)).join(' · ')}</Text>
        </View>
      </Animated.View>
    </Editable>
  );
}

/** The free gifts that will go into the order (shown like cart lines). */
export function GiftLines({ gifts }: { gifts: GiftLine[] }) {
  const t = useTheme();
  if (!gifts.length) return null;
  return (
    <View style={{ gap: 10, marginTop: 14 }}>
      {gifts.map((g) => (
        <Animated.View key={g.reward} entering={ZoomIn.springify().damping(14)} style={{ backgroundColor: t.greenSoft, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: t.green, borderStyle: 'dashed' }}>
          <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: t.cardStrong, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {g.image ? <Img source={g.image} size={64} style={{ width: 64, height: 64 }} /> : <MaterialCommunityIcons name="gift" size={30} color={t.green} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: t.text }}>{g.title}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft }}>Free gift · added automatically</Text>
          </View>
          <Animated.View entering={FadeIn.delay(150)} style={{ backgroundColor: t.green, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 12, color: '#fff' }}>FREE</Text>
          </Animated.View>
        </Animated.View>
      ))}
    </View>
  );
}
