import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductGrid } from '../../components/ProductGrid';
import { PressableScale, Txt } from '../../components/ui';
import { shopProducts, useProducts } from '../../data/catalog';
import { fonts, useTheme } from '../../theme';

export default function Shop() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const products = shopProducts(useProducts());
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ProductGrid
        products={products}
        header={
          <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 8 }}>
            <Txt v="h1">Shop Rosier</Txt>
            <Txt v="small" color={t.textSoft}>
              Pure, traditional, straight from our farm families.
            </Txt>
            <PressableScale scaleTo={0.98} onPress={() => router.push('/search')} style={{ marginTop: 14, height: 48, borderRadius: 24, backgroundColor: t.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, borderWidth: 1, borderColor: t.border }}>
              <Ionicons name="search" size={20} color={t.textMute} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: t.textMute }}>Search ghee, atta, oils...</Text>
            </PressableScale>
          </View>
        }
      />
    </View>
  );
}
