import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ProductGrid } from '../components/ProductGrid';
import { Button, Img, ScreenHeader } from '../components/ui';
import { useProducts } from '../data/catalog';
import { useContent } from '../config/remote';
import { fonts, useTheme } from '../theme';

export default function Gifting() {
  const t = useTheme();
  const g = useContent('gifting');
  const hampers = (((useContent('webPages' as any) as any)?.items ?? []) as any[]).find((p) => p && p.enabled !== false && /hamper/i.test(`${p.id} ${p.handle}`));
  const combos = useProducts().filter((p) => p.category === (g.category || 'combos'));
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Gifting" />
      <ProductGrid
        products={combos}
        showCategories={false}
        bottomPad={40}
        header={
          <Animated.View entering={FadeInDown.springify()} style={{ marginHorizontal: 16, marginBottom: 10 }}>
            <LinearGradient colors={['#4A2C17', '#8C552E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, overflow: 'hidden' }}>
              {g.image ? (
                <Img source={g.image} size={400} style={{ height: 150, marginHorizontal: -18, marginTop: -18, marginBottom: 12 }} contentFit="cover" />
              ) : (
                <MaterialCommunityIcons name="gift-outline" size={36} color="#E8C27A" />
              )}
              <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: '#FFF5E8', marginTop: 6 }}>{g.title}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: '#E9D6C0', marginTop: 4 }}>
                {g.body}
              </Text>
              <Button
                small
                kind="gold"
                label={g.buttonLabel}
                icon="mail-outline"
                style={{ alignSelf: 'flex-start', marginTop: 14 }}
                onPress={() => Linking.openURL(`mailto:${g.email}?subject=${encodeURIComponent(g.subject)}`)}
              />
            </LinearGradient>
            {hampers && (
              <Pressable onPress={() => router.push({ pathname: '/page/[handle]', params: { handle: hampers.id || hampers.handle } })} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: t.border }}>
                <MaterialCommunityIcons name="gift-open-outline" size={30} color={t.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>{hampers.title || 'Gift Hampers'}</Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft }}>Festive hampers — pre-book now</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={t.textMute} />
              </Pressable>
            )}
          </Animated.View>
        }
      />
    </View>
  );
}
