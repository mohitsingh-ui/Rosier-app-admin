import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Coin } from './Coin';

function Particle({ angle, dist, delay, size }: { angle: number; dist: number; delay: number; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, []);
  const a = useAnimatedStyle(() => {
    const d = p.value * dist;
    return {
      opacity: p.value < 0.7 ? 1 : 1 - (p.value - 0.7) / 0.3,
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d + p.value * p.value * 140 },
        { rotate: `${p.value * 720}deg` },
        { scale: 0.4 + p.value * 0.8 },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute' }, a]}>
      <Coin size={size} />
    </Animated.View>
  );
}

/** Coins exploding out from the centre. Re-mount with a new key to replay. */
export function CoinBurst({ count = 16 }: { count?: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Particle key={i} angle={(i / count) * Math.PI * 2 + (i % 3) * 0.2} dist={110 + (i % 4) * 35} delay={(i % 5) * 30} size={16 + (i % 3) * 7} />
      ))}
    </View>
  );
}
