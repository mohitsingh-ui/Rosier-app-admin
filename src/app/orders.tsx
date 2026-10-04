import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { toast } from '../components/Toast';
import { Button, EmptyState, Img, PressableScale, ScreenHeader } from '../components/ui';
import { coinsForAmount } from '../config/coins';
import { useContent } from '../config/remote';
import { findProduct, findVariant, useProducts } from '../data/catalog';
import { openStorePage } from '../lib/cart';
import { rupee, shortTitle } from '../lib/format';
import { success } from '../lib/haptics';
import { creditNewOrders, loadCustomer, ShopOrder, useAuth, useLoggedIn, useShopifyFlags } from '../store/auth';
import { useCart, useOrders } from '../store/shop';
import { fonts, useTheme } from '../theme';

const nice = (s?: string | null) => (s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '');

function statusOf(o: ShopOrder) {
  if (o.cancelled) return { label: 'Cancelled', tone: 'danger' as const };
  if (o.fulfillmentStatus === 'FULFILLED') return { label: 'Delivered / shipped', tone: 'green' as const };
  if (o.fulfillmentStatus === 'PARTIALLY_FULFILLED' || o.fulfillmentStatus === 'IN_PROGRESS') return { label: 'On the way', tone: 'gold' as const };
  if (o.financialStatus === 'PENDING') return { label: 'Payment pending', tone: 'gold' as const };
  return { label: nice(o.fulfillmentStatus) === 'Unfulfilled' ? 'Being packed' : nice(o.fulfillmentStatus) || 'Placed', tone: 'gold' as const };
}

export default function Orders() {
  const t = useTheme();
  const loggedIn = useLoggedIn();
  const flags = useShopifyFlags();
  const acc = useContent('account');
  const customer = useAuth((s) => s.customer);
  const credited = useAuth((s) => s.credited);
  const earnedAtLogin = useAuth((s) => s.loggedInAt);
  const loading = useAuth((s) => s.loading);
  const local = useOrders((s) => s.orders);
  const products = useProducts();
  const add = useCart((s) => s.add);

  const refresh = async () => {
    await loadCustomer();
    creditNewOrders();
  };
  useEffect(() => {
    if (loggedIn) refresh();
  }, [loggedIn]);

  const reorderShop = (o: ShopOrder) => {
    let n = 0;
    for (const it of o.items) {
      const hit = it.variantId ? findVariant(products, Number(it.variantId)) : undefined;
      if (hit && hit.variant.available) {
        add(hit.product.handle, hit.variant.id, it.qty);
        n++;
      }
    }
    success();
    toast(n ? `${n} item${n > 1 ? 's' : ''} added to cart` : 'These items are sold out right now', n ? 'ok' : 'info');
    if (n) router.navigate('/cart');
  };

  const reorderLocal = (o: (typeof local)[number]) => {
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

  const card = { backgroundColor: t.cardStrong, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: t.border };
  const pill = (label: string, tone: 'green' | 'gold' | 'danger') => (
    <View style={{ backgroundColor: tone === 'green' ? t.greenSoft : tone === 'danger' ? '#FBE3DA' : t.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: tone === 'green' ? t.green : tone === 'danger' ? '#B3261E' : t.primary }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="My Orders" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={loggedIn ? <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.primary} /> : undefined}
      >
        {/* Log in to see real orders */}
        {flags.loginEnabled && !loggedIn && (
          <Animated.View entering={FadeInDown.springify()}>
            <PressableScale scaleTo={0.98} onPress={() => router.push('/login')} style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card }}>
              <MaterialCommunityIcons name="account-arrow-right-outline" size={28} color={t.primary} />
              <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: t.text }}>{acc.ordersLoginPrompt}</Text>
              <MaterialCommunityIcons name="chevron-right" size={22} color={t.textMute} />
            </PressableScale>
          </Animated.View>
        )}

        {loggedIn && customer && (
          <>
            {!customer.orders.length && !loading && <EmptyState icon="cube-outline" title="No orders yet" body="Your first order is one tap away. And yes, it earns coins." cta="Shop now" onCta={() => router.navigate('/shop')} />}
            {customer.orders.map((o, i) => {
              const st = statusOf(o);
              return (
                <Animated.View key={o.id} entering={FadeInDown.delay(i * 50).springify()} style={card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>Order {o.name}</Text>
                      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute }}>{new Date(o.processedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    </View>
                    {pill(st.label, st.tone)}
                  </View>
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {o.items.map((it, k) => (
                      <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Img source={it.image} size={44} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: t.card }} />
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: t.text }}>
                          {shortTitle(it.title)}
                          {it.variant ? ` · ${it.variant}` : ''} × {it.qty}
                        </Text>
                        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.text }}>{rupee(it.total || it.price * it.qty)}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ height: 1, backgroundColor: t.border, marginVertical: 12 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>Total {rupee(o.total)}</Text>
                    {!o.cancelled && credited.includes(o.id) && Date.parse(o.processedAt) >= earnedAtLogin - 60_000 && (
                      <>
                        <MaterialCommunityIcons name="database" size={14} color={t.gold} />
                        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: t.gold, marginLeft: 4 }}>+{coinsForAmount(o.subtotal || o.total)} coins</Text>
                      </>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <Button small label="Reorder" icon="repeat" onPress={() => reorderShop(o)} style={{ flex: 1 }} />
                    <Button
                      small
                      kind="ghost"
                      label="Track"
                      icon="navigate-outline"
                      onPress={() => WebBrowser.openBrowserAsync(o.statusPageUrl, { toolbarColor: '#3E2415', controlsColor: '#F3D48B' })}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Animated.View>
              );
            })}
          </>
        )}

        {/* Orders placed before logging in (kept on this phone) */}
        {!loggedIn && (
          <>
            {!local.length && <EmptyState icon="cube-outline" title="No orders yet" body="Your first order is one tap away. And yes, it earns coins." cta="Shop now" onCta={() => router.navigate('/shop')} />}
            {local.map((o, i) => (
              <Animated.View key={o.id} entering={FadeInDown.delay(i * 60).springify()} style={card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>Order #{o.id}</Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute }}>{new Date(o.time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </View>
                  {pill(o.status, 'green')}
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
                  <Button small label="Reorder" icon="repeat" onPress={() => reorderLocal(o)} style={{ flex: 1 }} />
                  <Button small kind="ghost" label="Track" icon="navigate-outline" onPress={() => openStorePage('/account')} style={{ flex: 1 }} />
                </View>
              </Animated.View>
            ))}
            {local.length > 0 && <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute, textAlign: 'center' }}>Live tracking and invoices are in your rosierfoods.com account.</Text>}
          </>
        )}
      </ScrollView>
    </View>
  );
}
