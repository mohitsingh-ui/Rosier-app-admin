import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { fonts } from '../theme';

/**
 * Rosier gold coin, drawn in code so it stays crisp at any size.
 * `spin` flips it on its axis every few seconds, `shine` sweeps a highlight.
 */
export function Coin({ size = 28, spin = false, shine = false, style }: { size?: number; spin?: boolean; shine?: boolean; style?: StyleProp<ViewStyle> }) {
  const r = useSharedValue(0);
  const s = useSharedValue(0);

  useEffect(() => {
    if (spin) {
      r.value = withRepeat(
        withSequence(withDelay(1800, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })), withTiming(0, { duration: 0 })),
        -1,
      );
    }
    if (shine) {
      s.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withDelay(1600, withTiming(0, { duration: 0 }))), -1);
    }
  }, [spin, shine]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${interpolate(r.value, [0, 1], [0, 360])}deg` }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(s.value, [0, 1], [-size * 1.2, size * 1.2]) }, { rotate: '25deg' }],
  }));

  const ring = Math.max(2, size * 0.09);
  return (
    <Animated.View style={[{ width: size, height: size }, spinStyle, style]}>
      <LinearGradient
        colors={['#FBE08A', '#D9A441', '#9C6B1C', '#E8BE5C']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <LinearGradient
          colors={['#C98F2E', '#F6D27A', '#B17A24']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size - ring * 2,
            height: size - ring * 2,
            borderRadius: size,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: Math.max(1, size * 0.03),
            borderColor: 'rgba(255,240,190,0.7)',
          }}
        >
          <Text
            style={{
              fontFamily: fonts.serifBold,
              fontSize: size * 0.5,
              lineHeight: size * 0.62,
              color: '#7A4E12',
              textShadowColor: 'rgba(255,236,170,0.9)',
              textShadowOffset: { width: 0.5, height: 0.8 },
              textShadowRadius: 0.5,
              includeFontPadding: false,
            }}
          >
            R
          </Text>
        </LinearGradient>
        {shine && (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', width: size * 0.28, height: size * 1.6, backgroundColor: 'rgba(255,255,255,0.45)' }, shineStyle]}
          />
        )}
      </LinearGradient>
    </Animated.View>
  );
}

/** A small stack of coins for hero banners. */
export function CoinStack({ size = 90 }: { size?: number }) {
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [0, -8]) }] }));
  const disc = (i: number) => (
    <LinearGradient
      key={i}
      colors={['#E8BE5C', '#9C6B1C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{
        position: 'absolute',
        bottom: i * size * 0.09,
        left: (i % 2) * 3,
        width: size * 0.78,
        height: size * 0.16,
        borderRadius: size,
        borderWidth: 1,
        borderColor: 'rgba(255,230,160,0.8)',
      }}
    />
  );
  return (
    <View style={{ width: size, height: size * 1.05 }}>
      <View style={{ position: 'absolute', bottom: 0, left: size * 0.12, width: size, height: size * 0.5 }}>{[0, 1, 2, 3].map(disc)}</View>
      <Animated.View style={[{ position: 'absolute', top: 0, right: 0 }, a]}>
        <Coin size={size * 0.72} shine />
      </Animated.View>
    </View>
  );
}
