/** Draws the add-to-cart effects (bursts + big tick) over the whole app. */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { BounceIn, FadeOut, ZoomOut } from 'react-native-reanimated';
import { useCartFx } from '../lib/cartFx';
import { Layer } from './SeasonalEffects';

const TYPE: Record<string, { type: string; emoji?: string }> = {
  confetti: { type: 'confetti' },
  sparkles: { type: 'sparkles' },
  hearts: { type: 'hearts' },
  petals: { type: 'petals' },
  coins: { type: 'emoji', emoji: '🪙' },
};

export function CartFxHost() {
  const burst = useCartFx((s) => s.burst);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => useCartFx.setState({ burst: null }), burst.seconds * 1000 + 1700);
    return () => clearTimeout(t);
  }, [burst?.id]);
  if (!burst) return null;
  const layers = [...burst.types.map((k) => TYPE[k]).filter(Boolean), ...(burst.emoji ? [{ type: 'emoji', emoji: burst.emoji }] : [])];
  const each = Math.max(6, Math.round(burst.amount / Math.max(1, layers.length)));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 998 }]}>
      {layers.map((l, i) => (
        <Layer
          key={`${burst.id}:${i}`}
          effect={{ id: `cart-${i}`, enabled: true, name: 'cart', type: l.type, amount: each, speed: 1.8, size: 1.1, opacity: 1, colors: [], emoji: l.emoji ?? '', image: '', screens: 'all', stopAfter: burst.seconds, startAt: '', endAt: '' } as any}
        />
      ))}
      {burst.tick && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View key={burst.id} entering={BounceIn.duration(600)} exiting={ZoomOut.duration(250)} style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(62,36,21,0.92)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={64} color="#F3D48B" />
          </Animated.View>
        </View>
      )}
    </View>
  );
}
