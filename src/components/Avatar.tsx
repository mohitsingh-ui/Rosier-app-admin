import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { choosePhoto, removePhoto } from '../lib/photo';
import { useApp } from '../store/app';
import { fonts, useTheme } from '../theme';

export function Avatar({ size = 52, editable = false }: { size?: number; editable?: boolean }) {
  const name = useApp((s) => s.name);
  const photo = useApp((s) => s.photo);
  const [sheet, setSheet] = useState(false);
  const initials =
    name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'R';

  const face = photo ? (
    <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: '#FFF5E8' }} contentFit="cover" transition={200} />
  ) : (
    <LinearGradient
      colors={['#C47A48', '#7E3F18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF5E8' }}
    >
      <Text style={{ color: '#FFF5E8', fontFamily: fonts.serifBold, fontSize: size * 0.38 }}>{initials}</Text>
    </LinearGradient>
  );

  if (!editable) return face;

  return (
    <>
      <Pressable onPress={() => setSheet(true)} accessibilityLabel="Change profile photo">
        {face}
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: size * 0.34, height: size * 0.34, minWidth: 24, minHeight: 24, borderRadius: size, backgroundColor: '#C47A48', borderWidth: 2, borderColor: '#FFF5E8', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="camera" size={Math.max(12, size * 0.17)} color="#fff" />
        </View>
      </Pressable>
      <PhotoSheet visible={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

export function PhotoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const hasPhoto = useApp((s) => !!s.photo);
  const row = (icon: keyof typeof Ionicons.glyphMap, label: string, fn: () => void, danger = false) => (
    <Pressable
      onPress={() => {
        onClose();
        setTimeout(fn, 350);
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 6, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={danger ? '#C0392B' : t.primary} />
      </View>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 16, color: danger ? '#C0392B' : t.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' }}>
        {visible && (
          <Animated.View entering={SlideInDown.springify().damping(18)} style={{ backgroundColor: t.cardStrong, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: t.border, alignSelf: 'center', marginBottom: 12 }} />
            <Animated.Text entering={FadeIn} style={{ fontFamily: fonts.serif, fontSize: 20, color: t.heading, marginBottom: 6 }}>
              Your profile photo
            </Animated.Text>
            {row('camera-outline', 'Take a photo', () => choosePhoto('camera'))}
            {row('images-outline', 'Choose from gallery', () => choosePhoto('library'))}
            {hasPhoto && row('trash-outline', 'Remove photo', removePhoto, true)}
          </Animated.View>
        )}
      </Pressable>
    </Modal>
  );
}
