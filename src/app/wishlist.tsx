import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { ProductGrid } from '../components/ProductGrid';
import { EmptyState, ScreenHeader } from '../components/ui';
import { useProducts } from '../data/catalog';
import { useWishlist } from '../store/shop';
import { useTheme } from '../theme';

export default function Wishlist() {
  const t = useTheme();
  const handles = useWishlist((s) => s.handles);
  const products = useProducts().filter((p) => handles.includes(p.handle));
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Wishlist" />
      {products.length ? (
        <ProductGrid products={products} showCategories={false} bottomPad={40} />
      ) : (
        <EmptyState icon="heart-outline" title="Nothing saved yet" body="Tap the heart on anything you love and it'll wait for you here." cta="Explore products" onCta={() => router.navigate('/shop')} />
      )}
    </View>
  );
}
