import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CategoryIcon } from '../../components/CategoryIcon';
import { ProductGrid } from '../../components/ProductGrid';
import { ScreenHeader, Txt } from '../../components/ui';
import { defaultVariant, useCategories, shopProducts, useProducts } from '../../data/catalog';
import type { CategoryId } from '../../data/types';
import { useTheme } from '../../theme';

export default function Collection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const all = shopProducts(useProducts());
  const cat = useCategories().find((c) => c.id === id);

  let products = all;
  let title = 'Shop';
  let blurb = '';
  if (cat) {
    products = all.filter((p) => p.category === cat.id);
    title = cat.label;
    blurb = cat.blurb;
  } else if (id === 'deals') {
    products = all.filter((p) => defaultVariant(p).discount >= 10);
    title = 'Limited deals';
    blurb = 'Our best prices right now';
  } else if (id === 'new') {
    products = all.filter((p) => p.badge && /new/i.test(p.badge));
    title = 'Rosier Now';
    blurb = 'Fresh launches from our kitchen';
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title={title} />
      <ProductGrid
        products={products}
        showCategories={false}
        bottomPad={40}
        header={
          cat ? (
            <Animated.View entering={FadeInDown.springify()} style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: t.mode === 'dark' ? t.card : cat.tint, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <CategoryIcon name={cat.icon} image={cat.image} size={64} color={t.mode === 'dark' ? '#D8A15A' : '#7E3F18'} />
              <View style={{ flex: 1 }}>
                <Txt v="h2">{cat.label}</Txt>
                <Txt v="small" color={t.textSoft}>
                  {blurb}
                </Txt>
              </View>
            </Animated.View>
          ) : (
            <Txt v="small" color={t.textSoft} style={{ paddingHorizontal: 16, marginBottom: 6 }}>
              {blurb}
            </Txt>
          )
        }
        initialCategory={'all' as CategoryId | 'all'}
      />
    </View>
  );
}
