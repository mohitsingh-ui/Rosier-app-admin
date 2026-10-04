import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { resolveImage } from '../data/catalog';
import { LiveBanner, useBanners } from '../data/banners';
import { useContent } from '../config/remote';
import { openLink } from '../lib/links';
import { useLayout, useTheme } from '../theme';
import { PressableScale } from './ui';

export function openBanner(href: string) {
  openLink(href);
}

/** One hero slide, pulled live from rosierfoods.com. */
export function LiveBannerSlide({ banner, width, height }: { banner: LiveBanner; width: number; height: number }) {
  const t = useTheme();
  const L = useLayout();
  return (
    <PressableScale scaleTo={0.98} onPress={() => openBanner(banner.href)} style={{ width }}>
      <Image
        source={{ uri: resolveImage(banner.image) }}
        style={{ width, height, borderRadius: L.heroRadius, backgroundColor: t.card }}
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
        onLoad={(e) => {
          const { width: w, height: h } = e.source;
          if (!w || !h) return;
          const aspect = Math.min(3, Math.max(0.6, w / h));
          if (Math.abs(aspect - useBanners.getState().aspect) > 0.02) useBanners.setState({ aspect });
        }}
      />
    </PressableScale>
  );
}

/** The two tiles under the slider — live from the website, or set in the admin panel. */
export function LiveTiles({ width }: { width: number }) {
  const t = useTheme();
  const home = useContent('home');
  const L = useLayout();
  const website = useBanners((s) => s.tiles);
  const tiles: LiveBanner[] =
    home.tilesSource === 'none' ? [] : home.tilesSource === 'custom' ? (home.tiles as { image: string; link: string }[]).filter((x) => x.image).map((x, i) => ({ id: `t${i}`, image: x.image, href: x.link })) : website;
  if (!tiles.length) return null;
  const w = (width - 40 - 12) / 2;
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 16 }}>
      {tiles.slice(0, 2).map((b, i) => (
        <Animated.View key={b.id} entering={FadeInDown.delay(Math.min(i, 6) * 35).springify()}>
          <PressableScale onPress={() => openBanner(b.href)} style={{ width: w }}>
            <Image source={{ uri: resolveImage(b.image) }} style={{ width: w, height: w * L.tileRatio, borderRadius: L.tileRadius, backgroundColor: t.card }} contentFit="cover" transition={300} cachePolicy="memory-disk" />
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}
