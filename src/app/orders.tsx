import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { toast } from '../components/Toast';
import { Button, EmptyState, Img, ScreenHeader } from '../components/ui';
import { openStorePage } from '../lib/cart';
import { rupee, shortTitle } from '../lib/format';
import { success } from '../lib/haptics';
import { useCart, useOrders } from '../store/shop';
import { fonts, useTheme } from '../theme';
import { findProduct, useProducts } from '../data/catalog';

export default function Orders() {
  const t = useTheme();
  const orders = useOrders((s) => s.orders);
  const products = useProducts();
  const add = useCart((s) => s.add);

  const reorder = (o: (typeof orders)[number]) => {
    let n = 0;
    for (const it of o.items) {
      const p = findProduct(products, it.handle);
      const v = p?.variants.find((x) => x.title === it.variant && x.available);
      if (p && v) {
        add(p.handle, v.id, it.qty);
        n++;
      }
    }
    success();
    toast(n ? `${n} item${n > 1 ? 's' : ''} added to cart` : 'These items are sold out right now', n ? 'ok' : 'info');
    if (n) router.navigate('/cart');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="My Orders" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {!orders.length && <EmptyState icon="cube-outline" title="No orders yet" body="Your first order is one tap away. And yes, it earns coins." cta="Shop now" onCta={() => router.navigate('/shop')} />}
        {orders.map((o, i) => (
          <Animated.View key={o.id} entering={FadeInDown.delay(i * 60).springify()} style={{ backgroundColor: t.cardStrong, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: t.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>Order #{o.id}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute }}>{new Date(o.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <View style={{ backgroundColor: t.greenSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: t.green }}>{o.status}</Text>
              </View>
            </View>
            <View style={{ marginTop: 12, gap: 8 }}>
              {o.items.map((it) => (
                <View key={it.handle + it.variant} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Img source={it.image} size={44} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: t.card }} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: t.text }}>
                    {shortTitle(it.title)} · {it.variant} × {it.qty}
                  </Text>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.text }}>{rupee(it.price * it.qty)}</Text>
                </View>
              ))}
            </View>
            <View style={{ height: 1, backgroundColor: t.border, marginVertical: 12 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>Total {rupee(o.total)}</Text>
              <MaterialCommunityIcons name="database" size={14} color={t.gold} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: t.gold, marginLeft: 4 }}>+{o.coins} coins</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button small label="Reorder" icon="repeat" onPress={() => reorder(o)} style={{ flex: 1 }} />
              <Button small kind="ghost" label="Track" icon="navigate-outline" onPress={() => openStorePage('/account')} style={{ flex: 1 }} />
            </View>
          </Animated.View>
        ))}
        {orders.length > 0 && (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute, textAlign: 'center' }}>
            Live tracking and invoices are in your rosierfoods.com account.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
