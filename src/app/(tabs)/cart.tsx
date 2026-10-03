import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coin } from '../../components/Coin';
import { SwipeRow } from '../../components/SwipeRow';
import { toast } from '../../components/Toast';
import { Button, CountUp, EmptyState, Img, PressableScale, QtyStepper, Txt } from '../../components/ui';
import { COINS } from '../../config/coins';
import { CartLine, openCheckout, useCartSummary } from '../../lib/cart';
import { rupee, shortTitle } from '../../lib/format';
import { success, tap, warn } from '../../lib/haptics';
import { useApp } from '../../store/app';
import { useCart, useCoins, useOrders } from '../../store/shop';
import { fonts, useTheme } from '../../theme';

function Line({ line }: { line: CartLine }) {
  const t = useTheme();
  const setQty = useCart((s) => s.setQty);
  const toggle = useCart((s) => s.toggle);
  const remove = useCart((s) => s.remove);
  const { product, variant } = line;
  return (
    <SwipeRow
      onDelete={() => {
        remove(variant.id);
        warn();
      }}
    >
      <Pressable onPress={() => router.push({ pathname: '/product/[handle]', params: { handle: product.handle } })}>
        <View style={{ backgroundColor: t.cardStrong, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: t.border, shadowColor: '#5A3520', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
          <Pressable
            hitSlop={10}
            onPress={() => {
              tap();
              toggle(variant.id);
            }}
            style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: line.selected ? '#8B6A55' : 'transparent', borderWidth: 2, borderColor: '#8B6A55', alignItems: 'center', justifyContent: 'center' }}
          >
            {line.selected && (
              <Animated.View entering={ZoomIn.springify()}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </Animated.View>
            )}
          </Pressable>
          <Img source={product.images[0]} size={90} style={{ width: 84, height: 96 }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: t.text, lineHeight: 21, paddingRight: 56 }}>
              {shortTitle(product.title)}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft }}>{variant.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 17, color: t.text }}>{rupee(variant.price * line.qty, true)}</Text>
              {variant.mrp > variant.price && <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute, textDecorationLine: 'line-through' }}>{rupee(variant.mrp * line.qty, true)}</Text>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              {variant.available ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.danger }}>Earn {Math.floor(variant.price * line.qty * COINS.earnPerRupee)} coins</Text>
              ) : (
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: '#C0392B' }}>Out of stock</Text>
              )}
              <QtyStepper compact qty={line.qty} onChange={(n) => setQty(variant.id, n)} />
            </View>
          </View>
          {variant.discount > 0 && (
            <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: t.green, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: '#fff', fontFamily: fonts.sansMedium, fontSize: 12 }}>{variant.discount}% off</Text>
            </View>
          )}
        </View>
      </Pressable>
    </SwipeRow>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <Text style={{ fontFamily: bold ? fonts.sansSemi : fonts.sans, fontSize: bold ? 16 : 14, color: t.textSoft }}>{label}</Text>
      <Text style={{ fontFamily: bold ? fonts.sansBold : fonts.sansMedium, fontSize: bold ? 17 : 14, color: color ?? t.text }}>{value}</Text>
    </View>
  );
}

export default function Cart() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sum = useCartSummary();
  const balance = useCoins((s) => s.balance);
  const unlock = useCoins((s) => s.unlockVoucher);
  const releaseVoucher = useCoins((s) => s.releaseVoucher);
  const [confirm, setConfirm] = useState(false);

  const count = sum.lines.reduce((n, l) => n + l.qty, 0);

  const checkout = async () => {
    if (!sum.selected.length) return toast('Select at least one item', 'info');
    success();
    await openCheckout(
      sum.selected.map((l) => ({ variantId: l.variantId, qty: l.qty })),
      sum.voucherOk ? sum.voucher!.code : undefined,
    );
    setConfirm(true);
  };

  const placeOrder = () => {
    const id = String(Math.floor(10000 + Math.random() * 89999));
    useOrders.getState().addOrder({
      id,
      time: Date.now(),
      items: sum.selected.map((l) => ({ handle: l.product.handle, title: l.product.title, variant: l.variant.title, qty: l.qty, price: l.variant.price, image: l.product.images[0] })),
      subtotal: sum.subtotal,
      voucher: sum.voucherValue,
      total: sum.total,
      coins: sum.coins,
      status: 'Placed',
    });
    useCoins.getState().addPending(sum.coins, id);
    if (sum.voucherOk) useCoins.getState().consumeVoucher();
    useCart.getState().removeSelected();
    useApp.getState().pushNotification('Order placed 🎉', `${sum.coins} Rosier Coins are on their way for order #${id}.`);
    setConfirm(false);
    router.push({ pathname: '/order-success', params: { id } });
  };

  if (!sum.lines.length) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 40 }}>
        <Txt v="h1" style={{ textAlign: 'center', color: t.text, fontSize: 40, lineHeight: 48 }}>
          Cart
        </Txt>
        <EmptyState icon="cart-outline" title="Your cart is feeling light" body="Fill it with ghee, atta and everything good. Every rupee earns you Rosier Coins." cta="Start shopping" onCta={() => router.navigate('/shop')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 240 }} showsVerticalScrollIndicator={false}>
        <Txt v="h1" style={{ textAlign: 'center', color: t.text, fontSize: 40, lineHeight: 48 }}>
          Cart
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 14, paddingHorizontal: 6 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 22, color: t.text }}>Items({count})</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute }}>← swipe to remove</Text>
        </View>

        <View style={{ gap: 14 }}>
          {sum.lines.map((l, i) => (
            <Animated.View key={l.variantId} entering={FadeInDown.delay(i * 60).springify()} exiting={FadeOut} layout={LinearTransition.springify().damping(16)}>
              <Line line={l} />
            </Animated.View>
          ))}
        </View>

        {/* Coins */}
        <Animated.View entering={FadeInDown.delay(150)} layout={LinearTransition} style={{ marginTop: 22, backgroundColor: t.deep, borderRadius: 22, padding: 16, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Coin size={36} spin />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: '#FBE6CF' }}>Use your Rosier Coins</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#C9B8A8' }}>
                Balance: <CountUp value={balance} style={{ fontFamily: fonts.sansSemi, color: '#F3D48B', fontSize: 12 }} /> coins
              </Text>
            </View>
            <Pressable onPress={() => router.navigate('/coins')} hitSlop={8}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: '#F3D48B' }}>How it works</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginTop: 14 }}>
            {COINS.vouchers.map((v) => {
              const active = sum.voucher?.id === v.id;
              const can = balance >= v.cost || active;
              return (
                <PressableScale
                  key={v.id}
                  onPress={() => {
                    if (active) {
                      releaseVoucher();
                      toast('Voucher removed. Coins returned to your wallet', 'coin');
                      return;
                    }
                    if (!can) return toast(`You need ${v.cost - balance} more coins`, 'info');
                    if (unlock(v)) {
                      success();
                      toast(`₹${v.value} OFF applied! ${v.cost} coins used`, 'coin');
                    }
                  }}
                  style={{ width: 104, borderRadius: 14, paddingVertical: 10, alignItems: 'center', backgroundColor: active ? '#F3D48B' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: active ? '#F3D48B' : 'rgba(243,212,139,0.35)', opacity: can ? 1 : 0.45 }}
                >
                  <Text style={{ fontFamily: fonts.serifBold, fontSize: 20, color: active ? '#3E2415' : '#FBE6CF' }}>₹{v.value}</Text>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 10, color: active ? '#3E2415' : '#C9B8A8' }}>{active ? 'APPLIED ✓' : `${v.cost} coins`}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>
          {sum.voucher && !sum.voucherOk && (
            <Animated.Text entering={FadeIn} style={{ fontFamily: fonts.sans, fontSize: 12, color: '#F3A57B', marginTop: 10 }}>
              Add items worth {rupee(COINS.minCartForVoucher - sum.subtotal)} more to use this voucher.
            </Animated.Text>
          )}
        </Animated.View>

        {/* Bill */}
        <Animated.View layout={LinearTransition} style={{ marginTop: 16, backgroundColor: t.cardStrong, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: t.border }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: t.heading, marginBottom: 6 }}>Bill details</Text>
          <Row label="Item total (MRP)" value={rupee(sum.mrp, true)} />
          {sum.savings > 0 && <Row label="Rosier offer" value={`− ${rupee(sum.savings, true)}`} color={t.green} />}
          {sum.voucherValue > 0 && <Row label="Coins voucher" value={`− ${rupee(sum.voucherValue, true)}`} color={t.green} />}
          <Row label="Shipping" value="At checkout" />
          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 8 }} />
          <Row label="To pay" value={rupee(sum.total, true)} bold />
          {sum.savings + sum.voucherValue > 0 && (
            <View style={{ marginTop: 10, backgroundColor: t.greenSoft, borderRadius: 12, padding: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <MaterialCommunityIcons name="party-popper" size={18} color={t.green} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: t.green, flex: 1 }}>You're saving {rupee(sum.savings + sum.voucherValue)} on this order</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Checkout bar */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 104 + Math.max(insets.bottom - 10, 0), backgroundColor: t.deepAlt, borderRadius: 22, padding: 12, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
        <View style={{ flex: 1 }}>
          <CountUp value={sum.total} duration={500} format={(n) => rupee(n)} style={{ fontFamily: fonts.serifBold, fontSize: 22, color: '#FBE6CF' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Coin size={14} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#F3D48B' }}>+{sum.coins} coins on this order</Text>
          </View>
        </View>
        <Button label="Checkout" icon="lock-closed" kind="gold" onPress={checkout} style={{ height: 50, paddingHorizontal: 20 }} disabled={!sum.selected.length} />
      </View>

      {/* After returning from Shopify checkout */}
      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: 24 }}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={{ backgroundColor: t.cardStrong, borderRadius: 26, padding: 22, alignItems: 'center' }}>
            <Coin size={70} spin shine />
            <Txt v="h3" style={{ marginTop: 12, textAlign: 'center' }}>Did your order go through?</Txt>
            <Txt v="body" color={t.textSoft} style={{ textAlign: 'center', marginTop: 6 }}>
              Confirm and we'll add {sum.coins} Rosier Coins to your wallet. They unlock {COINS.pendingDays} days after your order.
            </Txt>
            <Button label="Yes, I placed my order" onPress={placeOrder} style={{ alignSelf: 'stretch', marginTop: 18 }} />
            <Button label="Not yet" kind="ghost" onPress={() => setConfirm(false)} style={{ alignSelf: 'stretch', marginTop: 10 }} />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
