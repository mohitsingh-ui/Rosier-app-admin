/** Coupon box in the cart + coupon cards (also used on the Coupons screen). */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useContent } from '../config/remote';
import { success, tap } from '../lib/haptics';
import { Coupon, CouponCheck, couponBlocker, liveCoupons, useCoupon } from '../store/coupon';
import { fonts, useTheme } from '../theme';
import { Editable } from './Editable';
import { toast } from './Toast';

export function couponHeadline(c: Coupon) {
  if (c.title) return c.title;
  if (c.kind === 'percent') return `${c.value}% off`;
  if (c.kind === 'flat') return `₹${c.value} off`;
  if (c.kind === 'freeship') return 'Free shipping';
  return c.code;
}

export function CouponCard({ c, subtotal, applied, onApply, wide }: { c: Coupon; subtotal?: number; applied?: boolean; onApply: () => void; wide?: boolean }) {
  const t = useTheme();
  const blocked = subtotal != null ? couponBlocker(c, subtotal) : null;
  const min = Number(c.minOrder) || 0;
  return (
    <View style={{ width: wide ? undefined : 232, flexDirection: 'row', backgroundColor: t.cardStrong, borderRadius: 16, borderWidth: 1, borderColor: applied ? t.green : t.border, overflow: 'hidden' }}>
      <View style={{ width: 36, backgroundColor: applied ? t.green : t.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ position: 'absolute', color: '#fff', fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.2, transform: [{ rotate: '-90deg' }], width: 120, textAlign: 'center' }} numberOfLines={1}>
          {c.kind === 'percent' ? `${c.value}% OFF` : c.kind === 'flat' ? `₹${c.value} OFF` : c.kind === 'freeship' ? 'FREE SHIP' : 'OFFER'}
        </Text>
      </View>
      <View style={{ flex: 1, padding: 12, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ borderWidth: 1.2, borderStyle: 'dashed', borderColor: t.primary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 12.5, color: t.primary, letterSpacing: 0.8 }}>{c.code.toUpperCase()}</Text>
          </View>
          <Pressable
            hitSlop={8}
            disabled={applied || !!blocked}
            onPress={() => {
              tap();
              onApply();
            }}
          >
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: applied ? t.green : blocked ? t.textMute : t.primary }}>{applied ? 'APPLIED' : 'APPLY'}</Text>
          </Pressable>
        </View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: t.text }} numberOfLines={2}>
          {couponHeadline(c)}
        </Text>
        {!!c.description && (
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: t.textSoft }} numberOfLines={wide ? 4 : 2}>
            {c.description}
          </Text>
        )}
        {blocked ? (
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: t.danger }}>{blocked} to unlock</Text>
        ) : min > 0 ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute }}>On orders above ₹{min}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function CouponBox({ check, subtotal }: { check: CouponCheck | null; subtotal: number }) {
  const t = useTheme();
  const cfg = useContent('coupons');
  const code = useCoupon((s) => s.code);
  const apply = useCoupon((s) => s.apply);
  const clear = useCoupon((s) => s.clear);
  const [text, setText] = useState('');
  if (!cfg.enabled) return null;
  const list = cfg.showList ? liveCoupons() : [];

  const doApply = (c: string) => {
    const v = c.trim();
    if (!v) return toast('Enter a coupon code', 'info');
    apply(v);
    setText('');
    success();
  };

  return (
    <Editable id="coupons" label="Coupons">
      <Animated.View entering={FadeInDown.delay(60)} layout={LinearTransition} style={{ marginTop: 16, backgroundColor: t.cardStrong, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: t.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={20} color={t.primary} />
          <Text style={{ flex: 1, fontFamily: fonts.serif, fontSize: 18, color: t.heading }}>{cfg.boxTitle}</Text>
          {cfg.showList && list.length > 0 && (
            <Pressable hitSlop={8} onPress={() => router.push('/coupons')}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: t.primary }}>View all</Text>
            </Pressable>
          )}
        </View>

        {code ? (
          <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: check?.state === 'invalid' ? 'rgba(227,130,63,0.12)' : t.greenSoft, borderRadius: 14, padding: 12 }}>
            {check?.state === 'checking' ? (
              <ActivityIndicator size="small" color={t.green} />
            ) : (
              <MaterialCommunityIcons name={check?.state === 'invalid' ? 'alert-circle-outline' : 'check-decagram'} size={22} color={check?.state === 'invalid' ? t.danger : t.green} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: check?.state === 'invalid' ? t.danger : t.green, letterSpacing: 0.5 }}>
                {code} {check?.state === 'invalid' ? '' : 'applied'}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft }}>{check?.message ?? 'Checking with the store…'}</Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => {
                tap();
                clear();
              }}
            >
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: t.textSoft }}>Remove</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.toUpperCase())}
              placeholder={cfg.placeholder}
              placeholderTextColor={t.textMute}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => doApply(text)}
              style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 14, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.bg, paddingHorizontal: 14, fontFamily: fonts.sansMedium, fontSize: 14, color: t.text, letterSpacing: 0.6 }}
            />
            <Pressable
              onPress={() => doApply(text)}
              style={({ pressed }) => ({ height: 46, paddingHorizontal: 18, borderRadius: 14, backgroundColor: text.trim() ? t.deepAlt : t.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
            >
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: text.trim() ? '#FBE6CF' : t.textMute }}>Apply</Text>
            </Pressable>
          </View>
        )}

        {list.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
            {list.map((c) => (
              <CouponCard key={c.id || c.code} c={c} subtotal={subtotal} applied={!!code && code.toLowerCase() === c.code.toLowerCase()} onApply={() => doApply(c.code)} />
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </Editable>
  );
}
