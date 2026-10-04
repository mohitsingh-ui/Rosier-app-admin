import { useLocalSearchParams } from 'expo-router';
import { useContent } from '../../config/remote';
import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CategoryIcon } from '../../components/CategoryIcon';
import { ProductGrid } from '../../components/ProductGrid';
import { ScreenHeader, Txt } from '../../components/ui';
import { defaultVariant, useCategories, shopProducts, useProducts } from '../../data/catalog';
import type { CategoryId } from '../../data/types';
import { useTheme } from '../../theme';
import { Editable } from '../../components/Editable';
import { Img } from '../../components/ui';
import { Pressable, useWindowDimensions } from 'react-native';
import { openLink } from '../../lib/links';
import { useCollectionBanner } from '../../lib/website';

/** The category's banner from the website (phone image), or one set in the admin panel. */
function CategoryBanner({ cat, index }: { cat: any; index: number }) {
  const { width } = useWindowDimensions();
  const on = cat?.showBanner !== false;
  const own = String(cat?.bannerImage || '').trim();
  const { data } = useCollectionBanner(on && !own ? cat?.collection : null);
  const [r, setR] = React.useState(0);
  const web = data?.banner;
  const image = own || web?.image;
  if (!on || !image) return null;
  const ratio = r || (own ? 0 : web?.ratio) || 1.6;
  const radius = Number.isFinite(Number(cat.bannerRadius)) && cat.bannerRadius !== '' ? Number(cat.bannerRadius) : 16;
  const w = width - 32;
  const link = own ? cat.bannerLink : web?.link;
  return (
    <Editable id={`categories.banner.${index}`} label="Category banner" target={`categories.items.${index}.bannerRadius`} base={radius}>
      <Animated.View entering={FadeInDown.springify()} style={{ marginHorizontal: 16, marginBottom: 10 }}>
        <Pressable disabled={!link} onPress={() => openLink(link)}>
          <Img
            source={image}
            size={w}
            style={{ width: w, height: w / ratio, borderRadius: radius, backgroundColor: '#EFE5DA' }}
            contentFit="cover"
            onLoad={(e: any) => {
              const sw = e?.source?.width;
              const sh = e?.source?.height;
              if (own && sw && sh) setR(sw / sh);
            }}
          />
        </Pressable>
      </Animated.View>
    </Editable>
  );
}

export default function Collection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const all = shopProducts(useProducts());
  const cats = useCategories();
  const cat = cats.find((c) => c.id === id);
  const catIndex = (useContent('categories').items as any[]).findIndex((c) => c?.id === id);

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
            <View>
            <CategoryBanner cat={cat} index={catIndex} />
            <Animated.View entering={FadeInDown.springify()} style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: t.mode === 'dark' ? t.card : cat.tint, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <CategoryIcon name={cat.icon} image={cat.image} size={64} color={t.mode === 'dark' ? '#D8A15A' : '#7E3F18'} />
              <View style={{ flex: 1 }}>
                <Txt v="h2">{cat.label}</Txt>
                <Txt v="small" color={t.textSoft}>
                  {blurb}
                </Txt>
              </View>
            </Animated.View>
            </View>
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
