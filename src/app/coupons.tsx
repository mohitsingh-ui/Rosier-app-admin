import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CouponCard } from '../components/CouponBox';
import { Editable } from '../components/Editable';
import { toast } from '../components/Toast';
import { EmptyState, ScreenHeader } from '../components/ui';
import { useContent } from '../config/remote';
import { useCartSummary } from '../lib/cart';
import { success } from '../lib/haptics';
import { liveCoupons, useCoupon } from '../store/coupon';
import { fonts, useTheme } from '../theme';

export default function Coupons() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cfg = useContent('coupons');
  const code = useCoupon((s) => s.code);
  const apply = useCoupon((s) => s.apply);
  const sum = useCartSummary();
  const [text, setText] = useState('');
  const list = liveCoupons();

  const use = (c: string) => {
    if (!c.trim()) return toast('Enter a coupon code', 'info');
    apply(c);
    success();
    toast(`${c.toUpperCase()} added to your cart`, 'ok');
    if (sum.lines.length) router.navigate('/cart');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title={cfg.listTitle || 'Coupons'} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12 }}>
        <Editable id="coupons" label="Coupons">
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.toUpperCase())}
              placeholder={cfg.placeholder}
              placeholderTextColor={t.textMute}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={() => use(text)}
              style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.cardStrong, paddingHorizontal: 14, fontFamily: fonts.sansMedium, fontSize: 14, color: t.text }}
            />
            <Pressable onPress={() => use(text)} style={{ height: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: t.deepAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.sansSemi, color: '#FBE6CF' }}>Apply</Text>
            </Pressable>
          </View>
        </Editable>
        {list.length === 0 ? (
          <EmptyState icon="pricetags-outline" title="No offers right now" body="Have a code? Type it above and we'll apply it at checkout." />
        ) : (
          list.map((c, i) => (
            <Animated.View key={c.id || c.code} entering={FadeInDown.delay(i * 50)}>
              <CouponCard wide c={c} subtotal={sum.lines.length ? sum.subtotal - sum.voucherValue : undefined} applied={!!code && code.toLowerCase() === c.code.toLowerCase()} onApply={() => use(c.code)} />
            </Animated.View>
          ))
        )}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <MaterialCommunityIcons name="information-outline" size={16} color={t.textMute} />
          <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12, color: t.textMute }}>One coupon per order. Your Rosier Coins voucher can be used on top when the offer allows it.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
