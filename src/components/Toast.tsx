import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
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

export function ToastHost() {
  const { msg, kind, key, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(hide, 2200);
    return () => clearTimeout(t);
  }, [key]);
  if (!msg) return null;
  return (
    <Animated.View
      key={key}
      entering={SlideInUp.springify().damping(16)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 20,
        right: 20,
        zIndex: 999,
        backgroundColor: '#3E2415',
        borderRadius: 18,
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
      {kind === 'coin' ? (
        <Coin size={24} />
      ) : (
        <Ionicons name={kind === 'ok' ? 'checkmark-circle' : 'information-circle'} size={22} color="#F3D48B" />
      )}
      <Text style={{ color: '#FBE6CF', fontFamily: fonts.sansMedium, fontSize: 14, flex: 1 }}>{msg}</Text>
    </Animated.View>
  );
}
