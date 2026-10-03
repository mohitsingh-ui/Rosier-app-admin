import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coin } from '../components/Coin';
import { CoinBurst } from '../components/CoinBurst';
import { Button } from '../components/ui';
import { COINS } from '../config/coins';
import { success } from '../lib/haptics';
import { useOrders } from '../store/shop';
import { fonts, useTheme } from '../theme';

export default function OrderSuccess() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const order = useOrders((s) => s.orders.find((o) => o.id === id));
  useEffect(() => {
    success();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 28, paddingBottom: insets.bottom + 28 }}>
      <CoinBurst count={22} />
      <Animated.View entering={ZoomIn.springify().damping(10)}>
        <Coin size={120} spin shine />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(300)} style={{ fontFamily: fonts.serifBold, fontSize: 30, color: t.heading, marginTop: 24, textAlign: 'center' }}>
        Dhanyavaad! 🙏
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(420)} style={{ fontFamily: fonts.sans, fontSize: 15, color: t.textSoft, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
        Order #{id} is with our kitchen now.{'\n'}
        {order ? `${order.coins} Rosier Coins` : 'Your coins'} will unlock in {COINS.pendingDays} days.
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(560)} style={{ alignSelf: 'stretch', marginTop: 30, gap: 10 }}>
        <Button label="View my coins" onPress={() => router.replace('/coins')} />
        <Button label="Continue shopping" kind="ghost" onPress={() => router.replace('/home')} />
      </Animated.View>
      <Text style={{ position: 'absolute', bottom: insets.bottom + 10, fontFamily: fonts.sans, fontSize: 11, color: t.textMute }}>A confirmation is on its way from rosierfoods.com</Text>
    </View>
  );
}
