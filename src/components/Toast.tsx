import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { BounceIn, FadeIn, FadeOut, FadeOutDown, FadeOutUp, FlipInXUp, LightSpeedInLeft, SlideInDown, SlideInUp, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useContent } from '../config/remote';
import { safeColor } from '../lib/color';
import { fonts } from '../theme';
import { Coin } from './Coin';

type ToastState = { msg: string | null; kind: 'ok' | 'coin' | 'info'; key: number; show: (msg: string, kind?: 'ok' | 'coin' | 'info') => void; hide: () => void };

export const useToast = create<ToastState>((set) => ({
  msg: null,
  kind: 'ok',
  key: 0,
  show: (msg, kind = 'ok') => set((s) => ({ msg, kind, key: s.key + 1 })),
  hide: () => set({ msg: null }),
}));

export const toast = (msg: string, kind?: 'ok' | 'coin' | 'info') => useToast.getState().show(msg, kind);

/** Entrance animations for the pop-up message (admin panel → Add to cart animations). */
function entering(anim: string, pos: string) {
  switch (anim) {
    case 'fade':
      return FadeIn.duration(250);
    case 'zoom':
      return ZoomIn.springify().damping(14);
    case 'bounce':
      return BounceIn.duration(550);
    case 'flip':
      return FlipInXUp.duration(450);
    case 'lightspeed':
      return LightSpeedInLeft.duration(450);
    case 'slideUp':
      return SlideInDown.springify().damping(16);
    default:
      return pos === 'bottom' ? SlideInDown.springify().damping(16) : SlideInUp.springify().damping(16);
  }
}

export function ToastHost() {
  const { msg, kind, key, hide } = useToast();
  const insets = useSafeAreaInsets();
  const c = (useContent('cartFx') ?? {}) as any;
  const seconds = Math.min(8, Math.max(1, Number(c.toastSeconds) || 2.2));
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(hide, seconds * 1000);
    return () => clearTimeout(t);
  }, [key]);
  if (!msg) return null;
  const pos = c.toastPosition === 'bottom' || c.toastPosition === 'center' ? c.toastPosition : 'top';
  const bg = safeColor(c.toastBg, '#3E2415');
  const fg = safeColor(c.toastTextColor, '#FBE6CF');
  const ic = safeColor(c.toastIconColor, '#F3D48B');
  const radius = Number.isFinite(Number(c.toastRadius)) && c.toastRadius !== '' ? Number(c.toastRadius) : 18;
  const where = pos === 'bottom' ? { bottom: insets.bottom + 96 } : pos === 'center' ? { top: '42%' as const } : { top: insets.top + 8 };
  const icon = c.toastIcon || 'coin';
  return (
    <Animated.View
      key={key}
      entering={entering(String(c.toastAnim || 'slideDown'), pos)}
      exiting={pos === 'bottom' ? FadeOutDown.duration(200) : pos === 'center' ? ZoomOut.duration(180) : FadeOutUp.duration(200)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        ...where,
        left: 20,
        right: 20,
        zIndex: 999,
        backgroundColor: bg,
        borderRadius: radius,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      }}
    >
      {kind === 'info' ? (
        <Ionicons name="information-circle" size={22} color={ic} />
      ) : kind === 'coin' && icon === 'coin' ? (
        <Coin size={24} />
      ) : icon === 'emoji' && c.toastEmoji ? (
        <Text style={{ fontSize: 20 }}>{String(c.toastEmoji)}</Text>
      ) : icon === 'none' ? null : (
        <Ionicons name={icon === 'cart' ? 'cart' : icon === 'gift' ? 'gift' : icon === 'heart' ? 'heart' : 'checkmark-circle'} size={22} color={ic} />
      )}
      <Text style={{ color: fg, fontFamily: fonts.sansMedium, fontSize: 14, flex: 1 }}>{msg}</Text>
    </Animated.View>
  );
}
