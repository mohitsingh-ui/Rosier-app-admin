import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

type Flight = { id: number; image: string; x: number; y: number; size: number };
type FlyState = { flights: Flight[]; bump: number; launch: (f: Omit<Flight, 'id'>) => void; land: (id: number) => void };

export const useFly = create<FlyState>((set) => ({
  flights: [],
  bump: 0,
  launch: (f) => set((s) => ({ flights: [...s.flights, { ...f, id: Date.now() + Math.random() }] })),
  land: (id) => set((s) => ({ flights: s.flights.filter((x) => x.id !== id), bump: s.bump + 1 })),
}));

const DURATION = 750;

/** Measure a view and fling its product image into the cart tab. */
export function flyFrom(ref: React.RefObject<View | null>, image: string) {
  const node = ref.current;
  if (!node) {
    useFly.setState((s) => ({ bump: s.bump + 1 }));
    return;
  }
  node.measureInWindow((x, y, w, h) => {
    const size = Math.min(w, h, 120) || 80;
    useFly.getState().launch({ image, x: x + w / 2 - size / 2, y: y + h / 2 - size / 2, size });
  });
}

function FlyItem({ f }: { f: Flight }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const p = useSharedValue(0);
  const tx = width * 0.9 - f.size / 2 - f.x;
  const ty = height - insets.bottom - 44 - f.size / 2 - f.y;

  useEffect(() => {
    p.value = withTiming(1, { duration: DURATION, easing: Easing.in(Easing.cubic) });
    const t = setTimeout(() => useFly.getState().land(f.id), DURATION);
    return () => clearTimeout(t);
  }, []);

  const a = useAnimatedStyle(() => {
    const arc = -Math.sin(p.value * Math.PI) * 120;
    return {
      opacity: 1 - p.value * 0.3,
      transform: [
        { translateX: tx * p.value },
        { translateY: ty * p.value * p.value + arc },
        { scale: 1 - p.value * 0.78 },
        { rotate: `${p.value * 200}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', left: f.x, top: f.y, width: f.size, height: f.size, borderRadius: f.size / 2, backgroundColor: '#fff', padding: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 }, a]}>
      <Image source={f.image} style={{ flex: 1 }} contentFit="contain" />
    </Animated.View>
  );
}

export function FlyHost() {
  const flights = useFly((s) => s.flights);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}>
      {flights.map((f) => (
        <FlyItem key={f.id} f={f} />
      ))}
    </View>
  );
}
