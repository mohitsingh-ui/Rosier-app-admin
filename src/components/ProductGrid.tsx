import { Ionicons } from '@expo/vector-icons';
import React, { ReactElement, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { defaultVariant, useCategories } from '../data/catalog';
import type { CategoryId, Product } from '../data/types';
import { fonts, useLayout, useTheme } from '../theme';
import { Editable } from './Editable';
import { GridCard } from './ProductCard';
import { Chip, EmptyState } from './ui';

type Sort = 'popular' | 'low' | 'high' | 'discount';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'discount', label: 'Best offers' },
  { id: 'low', label: 'Price: Low → High' },
  { id: 'high', label: 'Price: High → Low' },
];

export function ProductGrid({
  products,
  header,
  showCategories = true,
  initialCategory = 'all',
  bottomPad = 130,
}: {
  products: Product[];
  header?: ReactElement;
  showCategories?: boolean;
  initialCategory?: CategoryId | 'all';
  bottomPad?: number;
}) {
  const t = useTheme();
  const CATEGORIES = useCategories();
  const { width } = useWindowDimensions();
  const [cat, setCat] = useState<CategoryId | 'all'>(initialCategory);
  const [sort, setSort] = useState<Sort>('popular');
  const [sortOpen, setSortOpen] = useState(false);
  const L = useLayout();
  const cols = L.gridColumns;
  const cardW = (width - 16 * 2 - 12 * (cols - 1)) / cols;

  const list = useMemo(() => {
    let l = cat === 'all' ? products : products.filter((p) => p.category === cat);
    const price = (p: Product) => defaultVariant(p).price;
    if (sort === 'low') l = [...l].sort((a, b) => price(a) - price(b));
    if (sort === 'high') l = [...l].sort((a, b) => price(b) - price(a));
    if (sort === 'discount') l = [...l].sort((a, b) => defaultVariant(b).discount - defaultVariant(a).discount);
    if (sort === 'popular') l = [...l].sort((a, b) => Number(!!b.badge) - Number(!!a.badge) || b.rating - a.rating);
    return l;
  }, [products, cat, sort]);

  return (
    <FlatList
      data={list}
      key={`${cat}-${sort}-${cols}`}
      keyExtractor={(p) => p.handle}
      numColumns={cols}
      columnWrapperStyle={cols > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined}
      contentContainerStyle={{ gap: 12, paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      windowSize={7}
      ListHeaderComponent={
        <View>
          {header}
          {showCategories && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 6 }}>
              <Chip label="All" active={cat === 'all'} onPress={() => setCat('all')} />
              {CATEGORIES.map((c) => (
                <Chip key={c.id} label={c.label} active={cat === c.id} onPress={() => setCat(c.id)} />
              ))}
            </ScrollView>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 6, marginBottom: 4 }}>
            <Animated.Text key={list.length} entering={FadeIn} style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textSoft }}>
              {list.length} products
            </Animated.Text>
            <Pressable onPress={() => setSortOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} hitSlop={8}>
              <Ionicons name="swap-vertical" size={16} color={t.primary} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.primary }}>{SORTS.find((s) => s.id === sort)?.label}</Text>
            </Pressable>
          </View>
          {sortOpen && (
            <Animated.View entering={FadeInDown.springify().damping(16)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 6 }}>
              {SORTS.map((s) => (
                <Chip
                  key={s.id}
                  label={s.label}
                  active={s.id === sort}
                  onPress={() => {
                    setSort(s.id);
                    setSortOpen(false);
                  }}
                />
              ))}
            </Animated.View>
          )}
        </View>
      }
      ListEmptyComponent={<EmptyState icon="leaf-outline" title="Nothing here yet" body="We're cooking something up for this shelf. Check back soon." />}
      renderItem={({ item, index }) =>
        index === 0 ? (
          <Editable id="theme.cards" label="Product cards (all)" target="theme.layout.productImageRatio" base={L.productImageRatio} style={cols === 1 ? { paddingHorizontal: 16 } : undefined}>
            <GridCard product={item} index={index} width={cardW} />
          </Editable>
        ) : (
          <View style={cols === 1 ? { paddingHorizontal: 16 } : undefined}>
            <GridCard product={item} index={index} width={cardW} />
          </View>
        )
      }
    />
  );
}
