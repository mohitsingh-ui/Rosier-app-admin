import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coin, CoinStack } from '../../components/Coin';
import { CoinBurst } from '../../components/CoinBurst';
import { toast } from '../../components/Toast';
import { Button, CountUp, PressableScale, Txt } from '../../components/ui';
import { COINS, Voucher } from '../../config/coins';
import { fill, useContent } from '../../config/remote';
import { success } from '../../lib/haptics';
import { useCoins, usePendingCoins } from '../../store/shop';
import { fonts, useTheme } from '../../theme';

const TINTS: Record<string, [string, string]> = {
  copper: ['#C98A52', '#A8683A'],
  brown: ['#8C552E', '#6B3E20'],
  green: ['#6E8B5A', '#526C42'],
  deep: ['#4A2E1A', '#2E1B0E'],
};

function Ticket({ v, onPress, active }: { v: Voucher; onPress: () => void; active: boolean }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const w = (width - 40 - 30) / 4;
  return (
    <PressableScale onPress={onPress} style={{ width: w, backgroundColor: v.tint === 'green' ? t.greenSoft : t.card, borderRadius: 14, padding: 5, alignItems: 'center' }}>
      <LinearGradient colors={TINTS[v.tint] ?? TINTS.brown} style={{ width: '100%', height: w * 0.95, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.serifBold, fontSize: w * 0.3, color: '#fff' }}>₹{v.value}</Text>
        <View style={{ height: 1, width: '70%', backgroundColor: 'rgba(255,255,255,0.35)', marginVertical: 3 }} />
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: '#fff', letterSpacing: 1 }}>{active ? 'APPLIED' : 'OFF'}</Text>
        <View style={{ position: 'absolute', left: -6, top: '50%', width: 12, height: 12, borderRadius: 6, backgroundColor: t.cardStrong }} />
        <View style={{ position: 'absolute', right: -6, top: '50%', width: 12, height: 12, borderRadius: 6, backgroundColor: t.cardStrong }} />
      </LinearGradient>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8 }}>
        <Coin size={18} />
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.text }}>{v.cost.toLocaleString('en-IN')}</Text>
      </View>
    </PressableScale>
  );
}

function Progress({ value }: { value: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(300, withTiming(Math.min(1, value), { duration: 1200 }));
  }, [value]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', flex: 1 }}>
      <Animated.View style={[{ height: '100%', borderRadius: 4, backgroundColor: '#EBCB88' }, a]} />
    </View>
  );
}

export default function Coins() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const balance = useCoins((s) => s.balance);
  const voucherId = useCoins((s) => s.voucherId);
  const unlock = useCoins((s) => s.unlockVoucher);
  const pending = usePendingCoins();
  const cc = useContent('coins');
  const FAQ = cc.faq.map((f) => [f.q, fill(f.a)] as const);
  const [pick, setPick] = useState<Voucher | null>(null);
  const [burst, setBurst] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const scroll = useRef<ScrollView>(null);
  const [redeemY, setRedeemY] = useState(0);
  const [earnY, setEarnY] = useState(0);

  const next = COINS.vouchers.find((v) => v.cost > balance) ?? COINS.vouchers[COINS.vouchers.length - 1] ?? { id: 'none', value: 0, cost: 1, code: '', tint: 'brown' };
  const toGo = Math.max(0, next.cost - balance);
  const affordable = [...COINS.vouchers].reverse().find((v) => v.cost <= balance);
  const headline = affordable ? `₹${affordable.value} OFF is ready to unlock!` : `${toGo.toLocaleString('en-IN')} coins to go!`;
  const subline = affordable && next.id !== affordable.id ? `${toGo.toLocaleString('en-IN')} more for ₹${next.value} OFF` : affordable ? 'Pick it from the vouchers below' : `Get ₹${next.value} OFF on your next order`;

  const confirmUnlock = () => {
    if (!pick) return;
    if (unlock(pick)) {
      success();
      setBurst((b) => b + 1);
      toast(`₹${pick.value} OFF is ready in your cart`, 'coin');
    }
    setPick(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.navigate('/home')} hitSlop={10}>
          <Ionicons name="chevron-back" size={30} color={t.text} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 24, color: t.text }}>Rosier Coins</Text>
        <Pressable onPress={() => router.push('/coin-history')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} hitSlop={8}>
          <MaterialCommunityIcons name="history" size={20} color={t.text} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.text }}>Coin History</Text>
        </Pressable>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Balance */}
        <Animated.View entering={FadeInDown.springify().damping(15)}>
          <LinearGradient colors={['#3B2213', '#5A3520', '#3B2213']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 20, marginTop: 8, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: '#E9D6C0' }}>Your Balance</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <Coin size={50} spin />
                  <CountUp value={balance} duration={1300} style={{ fontFamily: fonts.sansSemi, fontSize: 40, color: '#fff' }} />
                </View>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: '#F4E7D8', marginTop: 4 }}>Rosier Coins</Text>
                {pending > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <MaterialCommunityIcons name="timer-sand" size={13} color="#EBCB88" />
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#EBCB88' }}>{pending} pending</Text>
                  </View>
                )}
              </View>
              <CoinStack size={Math.min(130, width * 0.3)} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#F7EBDD', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="gift-outline" size={24} color="#8B5A2B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: '#fff' }}>{headline}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#E9D6C0' }}>{subline}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <Progress value={balance / next.cost} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#fff' }}>
                {balance.toLocaleString('en-IN')} / {next.cost.toLocaleString('en-IN')}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Earn / Redeem */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          {[
            { title: 'Earn Coins', sub: 'Ways to earn more', icon: 'arrow-up-bold-box-outline', bg: t.card, fg: t.text, y: earnY },
            { title: 'Redeem Coins', sub: 'Swap for vouchers', icon: 'gift-outline', bg: t.greenSoft, fg: t.green, y: redeemY },
          ].map((c, i) => (
            <Animated.View key={c.title} entering={FadeInDown.delay(50 + Math.min(i, 6) * 35).springify()} style={{ flex: 1 }}>
              <PressableScale onPress={() => scroll.current?.scrollTo({ y: c.y - 10, animated: true })} style={{ backgroundColor: c.bg, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.cardStrong, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name={c.icon as any} size={20} color={t.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: c.fg }} numberOfLines={1}>{c.title}</Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, color: t.textSoft, lineHeight: 14 }} numberOfLines={2}>{c.sub}</Text>
                </View>
              </PressableScale>
            </Animated.View>
          ))}
        </View>

        {/* How to earn */}
        <View onLayout={(e) => setEarnY(e.nativeEvent.layout.y)}>
          <Txt v="h3" style={{ marginTop: 24, marginBottom: 12 }}>
            How to Earn Coins
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { icon: 'shopping-outline', title: 'On Every Order', body: `Earn ${Math.round(COINS.earnPerRupee * 100)} coins for every ₹100 spent`, go: () => router.navigate('/shop') },
              { icon: 'star-outline', title: 'Write a Review', body: `Earn ${COINS.reviewBonus} coins for every review`, go: () => router.push('/orders') },
              {
                icon: 'account-multiple-outline',
                title: 'Refer a Friend',
                body: `Earn ${COINS.referralBonus} coins on successful referral`,
                go: () => Share.share({ message: cc.referralMessage }),
              },
            ].map((c, i) => (
              <Animated.View key={c.title} entering={FadeInDown.delay(75 + Math.min(i, 6) * 35).springify()} style={{ flex: 1 }}>
                <PressableScale onPress={c.go} style={{ backgroundColor: t.cardStrong, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: t.border, minHeight: 170 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name={c.icon as any} size={28} color="#B8862E" />
                  </View>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: t.text, marginTop: 10, textAlign: 'center' }}>{c.title}</Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: t.textSoft, marginTop: 4, textAlign: 'center', lineHeight: 16 }}>{c.body}</Text>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Redeem */}
        <View onLayout={(e) => setRedeemY(e.nativeEvent.layout.y)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 }}>
          <Txt v="h3">Redeem & Save More</Txt>
          <Pressable onPress={() => router.navigate('/cart')}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.text }}>Go to cart</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {COINS.vouchers.map((v, i) => (
            <Animated.View key={v.id} entering={ZoomIn.delay(100 + Math.min(i, 6) * 35).springify()}>
              <Ticket v={v} active={voucherId === v.id} onPress={() => setPick(v)} />
            </Animated.View>
          ))}
        </View>

        {/* How it works timeline */}
        <Txt v="h3" style={{ marginTop: 28, marginBottom: 14 }}>
          How Rosier Coins work
        </Txt>
        {cc.steps.map((st) => [st.icon, st.title, fill(st.body)]).map(([icon, title, body], i, arr) => (
          <Animated.View key={`${title}-${i}`} entering={FadeInDown.delay(Math.min(i, 6) * 35)} style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.deepAlt, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={icon as any} size={20} color="#F3D48B" />
              </View>
              {i < arr.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: t.border, marginVertical: 4 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 18 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>{title}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textSoft, marginTop: 2 }}>{body}</Text>
            </View>
          </Animated.View>
        ))}

        {/* More coins banner */}
        <PressableScale scaleTo={0.98} onPress={() => router.push('/benefits-club')} style={{ marginTop: 10 }}>
          <LinearGradient colors={['#4A2C17', '#7A4B25']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 20, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: '#fff', lineHeight: 27 }}>{cc.promoTitle}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#F1E1CF', marginTop: 6 }}>{cc.promoBody}</Text>
              <View style={{ marginTop: 12, backgroundColor: '#C9A06A', alignSelf: 'flex-start', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: '#3E2415' }}>{cc.promoButton}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="gift" size={90} color="#E8C27A" />
          </LinearGradient>
        </PressableScale>

        {/* FAQ */}
        <Txt v="h3" style={{ marginTop: 28, marginBottom: 10 }}>
          Questions? We've got you
        </Txt>
        {FAQ.map(([q, a], i) => {
          const open = openFaq === i;
          return (
            <Animated.View key={`${q}-${i}`} layout={LinearTransition.springify().damping(18)} style={{ backgroundColor: t.cardStrong, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
              <Pressable onPress={() => setOpenFaq(open ? null : i)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: t.text }}>{q}</Text>
                <Ionicons name={open ? 'remove' : 'add'} size={20} color={t.primary} />
              </Pressable>
              {open && (
                <Animated.Text entering={FadeIn.duration(250)} style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textSoft, paddingHorizontal: 14, paddingBottom: 14, lineHeight: 20 }}>
                  {a}
                </Animated.Text>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>

      {burst > 0 && <CoinBurst key={burst} />}

      {/* Confirm sheet */}
      <Modal visible={!!pick} transparent animationType="fade" onRequestClose={() => setPick(null)}>
        <Pressable onPress={() => setPick(null)} style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' }}>
          {pick && (
            <Animated.View entering={FadeInDown.springify().damping(16)} style={{ backgroundColor: t.cardStrong, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24, alignItems: 'center' }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: t.border, marginBottom: 18 }} />
              <Coin size={64} spin shine />
              <Text style={{ fontFamily: fonts.serifBold, fontSize: 32, color: t.text, marginTop: 10 }}>₹{pick.value} OFF</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: t.textSoft, marginTop: 4, textAlign: 'center' }}>
                Use {pick.cost.toLocaleString('en-IN')} coins for ₹{pick.value} off your next order (min. ₹{COINS.minCartForVoucher}).
              </Text>
              {voucherId === pick.id ? (
                <Button label="Already applied to your cart" kind="dark" onPress={() => { setPick(null); router.navigate('/cart'); }} style={{ alignSelf: 'stretch', marginTop: 20 }} />
              ) : balance >= pick.cost ? (
                <Button label={`Unlock for ${pick.cost.toLocaleString('en-IN')} coins`} onPress={confirmUnlock} style={{ alignSelf: 'stretch', marginTop: 20 }} />
              ) : (
                <>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.danger, marginTop: 16 }}>You need {(pick.cost - balance).toLocaleString('en-IN')} more coins</Text>
                  <Button label="Shop to earn coins" kind="dark" onPress={() => { setPick(null); router.navigate('/shop'); }} style={{ alignSelf: 'stretch', marginTop: 12 }} />
                </>
              )}
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}
