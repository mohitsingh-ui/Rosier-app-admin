import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const REVEAL = 96;

/** Swipe left to reveal a delete button; swipe far to delete right away. */
export function SwipeRow({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const gone = useSharedValue(0);

  const kill = () => {
    'worklet';
    gone.value = withTiming(1, { duration: 220 });
    x.value = withTiming(-600, { duration: 220 }, () => {
      scheduleOnRN(onDelete);
    });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      start.value = x.value;
    })
    .onUpdate((e) => {
      x.value = Math.min(0, start.value + e.translationX);
    })
    .onEnd((e) => {
      if (x.value < -220 || e.velocityX < -1400) kill();
      else if (x.value < -REVEAL / 2) x.value = withSpring(-REVEAL - 12, { damping: 16 });
      else x.value = withSpring(0, { damping: 16 });
    });

  const tap = Gesture.Tap().onEnd(() => {
    if (x.value < -10) kill();
  });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const btn = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-REVEAL, -20, 0], [1, 0.4, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(x.value, [-REVEAL - 40, -REVEAL, 0], [1.1, 1, 0.6], Extrapolation.CLAMP) }],
  }));
  const wrap = useAnimatedStyle(() => ({ opacity: 1 - gone.value, transform: [{ scaleY: 1 - gone.value * 0.2 }] }));

  return (
    <Animated.View style={wrap}>
      <GestureDetector gesture={tap}>
        <Animated.View style={[{ position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL, borderRadius: 22, backgroundColor: '#E8873F', alignItems: 'center', justifyContent: 'center' }, btn]}>
          <Ionicons name="trash" size={36} color="#fff" />
        </Animated.View>
      </GestureDetector>
      <GestureDetector gesture={pan}>
        <Animated.View style={row}>{children}</Animated.View>
      </GestureDetector>
      <View />
    </Animated.View>
  );
}
