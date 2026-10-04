import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openProduct } from '../components/ProductCard';
import { Chip, EmptyState, Img } from '../components/ui';
import { defaultVariant, shopProducts, useProducts } from '../data/catalog';
import { rupee, shortTitle } from '../lib/format';
import { useContent } from '../config/remote';
import { fonts, useTheme } from '../theme';


export default function Search() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const products = shopProducts(useProducts());
  const [q, setQ] = useState('');
  const POPULAR = useContent('search').popular as string[];

  const results = useMemo(() => {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return products.filter((p) => {
      const hay = `${p.title} ${p.type} ${p.category} ${p.short}`.toLowerCase();
      return words.every((w) => hay.includes(w.replace(/s$/, '')));
    });
  }, [q, products]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color={t.text} />
        </Pressable>
        <Animated.View entering={FadeInRight.springify().damping(16)} style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: t.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, borderWidth: 1, borderColor: t.border }}>
          <Ionicons name="search" size={20} color={t.textMute} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="search for ghee, Khapli, oil..."
            placeholderTextColor={t.textMute}
            returnKeyType="search"
            style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: t.text }}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={t.textMute} />
            </Pressable>
          )}
        </Animated.View>
      </View>

      {!q.trim() ? (
        <Animated.View entering={FadeIn} style={{ padding: 20 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: t.heading, marginBottom: 12 }}>Popular searches</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {POPULAR.map((p) => (
              <Chip key={p} label={p} onPress={() => setQ(p)} />
            ))}
          </View>
        </Animated.View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.handle}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={<EmptyState icon="search" title="No matches" body={`We couldn't find "${q}". Try "ghee" or "atta".`} />}
          renderItem={({ item, index }) => {
            const v = defaultVariant(item);
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 35)}>
                <Pressable onPress={() => openProduct(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.cardStrong, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: t.border }}>
                  <Img source={item.images[0]} size={60} style={{ width: 60, height: 60, borderRadius: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: t.text }}>
                      {shortTitle(item.title)}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft }}>{v.title}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.price }}>{rupee(v.price)}</Text>
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}
