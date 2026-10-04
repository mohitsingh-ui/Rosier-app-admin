import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { LiveBannerSlide, LiveTiles } from '../../components/LiveBanners';
import type { LiveBanner } from '../../data/banners';
import { RosierLogo, Tagline } from '../../components/Logo';
import { useBanners } from '../../data/banners';
import { BenefitsBanner, Carousel, CoinsBanner, ProductBanner } from '../../components/Banners';
import { CategoryIcon } from '../../components/CategoryIcon';
import { Coin } from '../../components/Coin';
import { Pillars, Reviews } from '../../components/HomeExtras';
import { DealCard, GridCard } from '../../components/ProductCard';
import { CountUp, PressableScale, SectionHeader, Txt } from '../../components/ui';
import { defaultVariant, resolveImage, shopProducts, useCatalog, useCategories, useProducts } from '../../data/catalog';
import type { Product } from '../../data/types';
import { isLive, useContent } from '../../config/remote';
import { openLink } from '../../lib/links';
import { Image } from 'expo-image';
import { greeting } from '../../lib/format';
import { useApp } from '../../store/app';
import { useCoins } from '../../store/shop';
import { fonts, useLayout, useTheme } from '../../theme';

const GREET_H = 58;
const GREET_GAP = 12;
const SEARCH_H = 48;

const TOP_TABS = [
  { key: 'rosier', label: 'ROSIER' },
  { key: 'breakfast', label: 'Breakfast\nclub' },
  { key: 'club', label: 'Benefit\nclub' },
  { key: 'now', label: 'Rosier\nNow' },
  { key: 'coins', label: 'Rosier\nCoins' },
];

export default function Home() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const products = useProducts();
  const loading = useCatalog((s) => s.loading);
  const refresh = useCatalog((s) => s.refresh);
  const name = useApp((s) => s.name);
  const unread = useApp((s) => s.notifications.filter((n) => !n.read).length);
  const openMenu = useApp((s) => s.setMenuOpen);
  const balance = useCoins((s) => s.balance);
  const [tab, setTab] = useState('rosier');
  const liveSlides = useBanners((s) => s.slides);
  const bannerAspect = useBanners((s) => s.aspect);
  const refreshBanners = useBanners((s) => s.refresh);

  const y = useSharedValue(0);
  // The header sits on top of the list and only slides/fades (no height changes),
  // so scrolling never resizes the list underneath — that's what caused the glitching.
  const topPad = insets.top + 8;
  const headerH = topPad + GREET_H + GREET_GAP + SEARCH_H + 12;
  const isIOS = Platform.OS === 'ios';
  const onScroll = useAnimatedScrollHandler((e) => {
    // iOS uses a content inset (so pull-to-refresh shows below the header), which starts the offset at -headerH.
    y.value = e.contentOffset.y + (isIOS ? headerH : 0);
  });
  const headerSlide = useAnimatedStyle(() => ({
    transform: [{ translateY: -interpolate(y.value, [0, GREET_H + GREET_GAP], [0, GREET_H + GREET_GAP], 'clamp') }],
  }));
  const greetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 40], [1, 0], 'clamp'),
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [20, 70], [0, 1], 'clamp'),
  }));

  const home = useContent('home');
  const L = useLayout();
  const gap = (n: number) => Math.round(n * L.sectionSpacing);
  const general = useContent('general');
  const categories = useCategories();
  const all = useMemo(() => shopProducts(products), [products]);
  const byHandle = (h: string) => all.find((p) => p.handle === h);
  const pick = (handles: string[] = [], category = '') =>
    (handles.length ? (handles.map(byHandle).filter(Boolean) as Product[]) : category ? all.filter((p) => p.category === category) : []);
  const autoDeals = useMemo(
    () =>
      [...all]
        .filter((p) => p.category !== 'combos' && defaultVariant(p).available)
        .sort((a, b) => defaultVariant(b).discount - defaultVariant(a).discount)
        .filter((p, i, arr) => arr.findIndex((x) => x.category === p.category) === i || i < 3)
        .slice(0, 8),
    [all],
  );
  const cardW = (width - 20 * 2 - 12) / 2;
  const dealW = Math.min(L.dealCardWidth, width * 0.62);

  // Top slider: live website banners and/or the banners set in the admin panel.
  type Slide = { web: LiveBanner } | { custom: (typeof home.heroBanners)[number] };
  const custom = home.heroBanners.filter(isLive);
  const web = liveSlides.map((b) => ({ web: b }) as Slide);
  const mine = custom.map((b) => ({ custom: b }) as Slide);
  const hero: Slide[] = home.heroSource === 'custom' ? mine : home.heroSource === 'both' ? [...mine, ...web] : web.length ? web : mine;
  const hasImageSlides = hero.some((x) => 'web' in x || x.custom.kind === 'image');
  const slideW = width - 40;
  // Image banners keep their shape (or the ratio set in Theme); colour cards use the card height from Theme.
  const slideH = hasImageSlides ? Math.round(slideW / (L.heroImageRatio > 0 ? L.heroImageRatio : bannerAspect)) : L.heroCardHeight;

  const onTopTab = (k: string) => {
    setTab(k);
    if (k === 'breakfast') router.push({ pathname: '/collection/[id]', params: { id: 'breakfast' } });
    if (k === 'club') router.push('/benefits-club');
    if (k === 'now') router.push({ pathname: '/collection/[id]', params: { id: 'new' } });
    if (k === 'coins') router.navigate('/coins');
    setTimeout(() => setTab('rosier'), 600);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Covers the status bar so the greeting can slide up behind it */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topPad, backgroundColor: t.header, zIndex: 11 }} />
      {/* Sticky header */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: headerH, backgroundColor: t.header, paddingTop: topPad, paddingHorizontal: 20, zIndex: 10 }, headerSlide]}>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: -10, height: 10 }, shadowStyle]}>
          <LinearGradient colors={['rgba(60,30,10,0.14)', 'rgba(60,30,10,0)']} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', height: GREET_H, marginBottom: GREET_GAP }, greetStyle]}>
          <PressableScale onPress={() => openMenu(true)}>
            <Avatar size={54} />
          </PressableScale>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: t.text }} numberOfLines={1}>
              Hi {name || 'there'}!
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textSoft }}>{greeting()}</Text>
          </View>
          <PressableScale
            onPress={() => router.navigate('/coins')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.cardStrong, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7, shadowColor: '#5A3520', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 }}
          >
            <Coin size={30} spin />
            <View>
              <CountUp value={balance} style={{ fontFamily: fonts.sansSemi, fontSize: 16, color: t.text, lineHeight: 19 }} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 9.5, color: t.textSoft }}>Rosier Coins</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.text} />
          </PressableScale>
        </Animated.View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <PressableScale scaleTo={0.98} onPress={() => router.push('/search')} style={{ flex: 1, height: SEARCH_H, borderRadius: 24, backgroundColor: t.cardStrong, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }}>
            <Ionicons name="search" size={20} color={t.textMute} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: t.textMute, flex: 1 }} numberOfLines={1}>
              {home.searchPlaceholder}
            </Text>
            <Ionicons name="options-outline" size={20} color={t.textMute} />
          </PressableScale>
          <PressableScale onPress={() => router.push('/notifications')} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.cardStrong, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications" size={22} color={t.textSoft} />
            {unread > 0 && (
              <Animated.View entering={FadeIn} style={{ position: 'absolute', top: 6, right: 7, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#D64545', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 9, fontFamily: fonts.sansSemi }}>{unread}</Text>
              </Animated.View>
            )}
          </PressableScale>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: isIOS ? 0 : headerH }}
        contentInset={isIOS ? { top: headerH } : undefined}
        contentOffset={isIOS ? { x: 0, y: -headerH } : undefined}
        scrollIndicatorInsets={isIOS ? { top: headerH } : undefined}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            progressViewOffset={headerH}
            onRefresh={() => {
              refresh();
              refreshBanners();
            }}
            tintColor={t.primary}
          />
        }
      >
        {/* Sub-brand tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingTop: 4 }}>
          {TOP_TABS.map((tb, i) => {
            const active = tab === tb.key;
            return (
              <Animated.View key={tb.key} entering={FadeInDown.delay(i * 60)}>
                <PressableScale
                  onPress={() => onTopTab(tb.key)}
                  style={{ width: 82, height: 54, borderRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: active ? t.card : t.cardStrong, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  {tb.key === 'rosier' ? (
                    <RosierLogo width={70} color={t.mode === 'dark' ? '#E8C27A' : '#3E2415'} />
                  ) : tb.key === 'breakfast' ? (
                    <Text style={{ fontFamily: fonts.sansBold, fontSize: 12, color: '#D6338A', textAlign: 'center', lineHeight: 13 }}>{tb.label}</Text>
                  ) : (
                    <Text style={{ fontFamily: fonts.serifRegular, fontSize: 13.5, color: t.text, textAlign: 'center', lineHeight: 16 }}>{tb.label}</Text>
                  )}
                </PressableScale>
              </Animated.View>
            );
          })}
        </ScrollView>

        <View style={{ marginTop: 14 }}>
          <Carousel
            width={width}
            seconds={L.carouselSeconds}
            slides={[
              home.showCoinsBanner && <CoinsBanner key="coins" width={slideW} height={slideH} />,
              ...hero.map((x, i) =>
                'web' in x ? (
                  <LiveBannerSlide key={`w${x.web.id}`} banner={x.web} width={slideW} height={slideH} />
                ) : x.custom.kind === 'image' ? (
                  <LiveBannerSlide key={`c${i}`} banner={{ id: x.custom.id, image: x.custom.image, href: x.custom.link }} width={slideW} height={slideH} />
                ) : (
                  <ProductBanner
                    key={`c${i}`}
                    width={slideW}
                    height={slideH}
                    title={x.custom.title}
                    sub={x.custom.sub}
                    image={x.custom.image}
                    colors={(x.custom.colors.length >= 2 ? x.custom.colors : ['#FFF3D6', '#E9B955']) as [string, string, ...string[]]}
                    light={x.custom.light}
                    onPress={() => openLink(x.custom.link)}
                  />
                ),
              ),
            ].filter(Boolean)}
          />
        </View>

        <LiveTiles width={width} />

        {home.sections.filter((sec) => sec.enabled !== false).map((sec: any, si) => {
          switch (sec.type) {
            case 'categories':
              return (
                <View key={sec.id ?? si}>
                  <SectionHeader title={sec.title || 'Discover category'} style={{ marginTop: gap(22) }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                    {categories.map((c, i) => (
                      <Animated.View key={c.id} entering={FadeInDown.delay(i * 70).springify()}>
                        <PressableScale onPress={() => router.push({ pathname: '/collection/[id]', params: { id: c.id } })} style={{ alignItems: 'center', width: L.categoryTile + 4 }}>
                          <View style={{ width: L.categoryTile, height: Math.round(L.categoryTile * 0.89), borderRadius: 12, backgroundColor: t.mode === 'dark' ? t.card : '#F4E3CF', alignItems: 'center', justifyContent: 'center' }}>
                            <CategoryIcon name={c.icon} image={c.image} size={L.categoryIcon} color={t.mode === 'dark' ? '#D8A15A' : '#7E3F18'} />
                          </View>
                          <Text style={{ fontFamily: fonts.serifRegular, fontSize: 15, color: t.heading, marginTop: 6 }} numberOfLines={1}>{c.label}</Text>
                        </PressableScale>
                      </Animated.View>
                    ))}
                  </ScrollView>
                </View>
              );
            case 'deals': {
              const list = sec.handles?.length ? pick(sec.handles) : autoDeals;
              if (!list.length) return null;
              return (
                <View key={sec.id ?? si}>
                  <SectionHeader title={sec.title || 'Limited deals'} action="see all" onAction={() => router.push({ pathname: '/collection/[id]', params: { id: 'deals' } })} style={{ marginTop: gap(24) }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                    {list.map((p, i) => (
                      <DealCard key={p.handle} product={p} index={i} width={dealW} />
                    ))}
                  </ScrollView>
                </View>
              );
            }
            case 'benefits':
              return (
                <View key={sec.id ?? si} style={{ marginTop: gap(26) }}>
                  <BenefitsBanner width={width} />
                </View>
              );
            case 'grid': {
              const list = pick(sec.handles, sec.category).slice(0, Number(sec.limit) || 6);
              if (!list.length) return null;
              return (
                <View key={sec.id ?? si}>
                  {sec.subtitle ? (
                    <>
                      <Txt v="h1" style={{ textAlign: 'center', marginTop: gap(28), marginBottom: 4, fontFamily: fonts.serif, paddingHorizontal: 20 }}>
                        {sec.title}
                      </Txt>
                      <Txt v="small" color={t.textSoft} style={{ textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 }}>
                        {sec.subtitle}
                      </Txt>
                    </>
                  ) : (
                    !!sec.title && (
                      <Txt v="h2" style={{ textAlign: 'center', marginTop: gap(30), marginBottom: 14, paddingHorizontal: 20 }}>
                        {sec.title}
                      </Txt>
                    )
                  )}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>
                    {list.map((p, i) => (
                      <GridCard key={p.handle} product={p} index={i} width={cardW} />
                    ))}
                  </View>
                  {sec.showViewAll && (
                    <PressableScale
                      onPress={() => (sec.category ? router.push({ pathname: '/collection/[id]', params: { id: sec.category } }) : router.navigate('/shop'))}
                      style={{ alignSelf: 'center', marginTop: 22, borderWidth: 1.5, borderColor: t.primary, borderRadius: 30, paddingHorizontal: 44, paddingVertical: 12 }}
                    >
                      <Text style={{ fontFamily: fonts.sansMedium, color: t.primary, letterSpacing: 3, fontSize: 13 }}>VIEW ALL</Text>
                    </PressableScale>
                  )}
                </View>
              );
            }
            case 'promo': {
              const img = resolveImage(sec.image);
              const colors = (sec.colors?.length >= 2 ? sec.colors : ['#FFF4DC', '#F6D98C']) as [string, string, ...string[]];
              return (
                <View key={sec.id ?? si} style={{ marginTop: gap(28) }}>
                  <PressableScale scaleTo={0.98} onPress={() => openLink(sec.link)}>
                    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20 }}>
                      <View style={{ flex: 1.1, flexDirection: 'row' }}>
                        {!!img &&
                          [0, 1, 2].map((k) => (
                            <View key={k} style={{ width: 70, height: 100, marginLeft: k ? -18 : 0, transform: [{ rotate: `${(k - 1) * 6}deg` }] }}>
                              <Animated.Image entering={FadeInDown.delay(k * 120)} source={{ uri: img }} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="contain" />
                            </View>
                          ))}
                      </View>
                      <View style={{ flex: 1 }}>
                        {!!sec.kicker && <Text style={{ fontFamily: fonts.serif, fontSize: 13, color: '#5A3A1E' }}>{sec.kicker}</Text>}
                        <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, color: '#3E2415', lineHeight: 30 }}>{sec.title}</Text>
                        {!!sec.body && <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, color: '#5A3A1E', marginTop: 4 }}>{sec.body}</Text>}
                        {!!sec.button && (
                          <View style={{ marginTop: 8, backgroundColor: '#3E2415', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: '#FBE6CF', fontFamily: fonts.sansMedium, fontSize: 10 }}>{sec.button}</Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </PressableScale>
                </View>
              );
            }
            case 'row': {
              const list = pick(sec.handles, sec.category);
              if (!list.length) return null;
              return (
                <View key={sec.id ?? si}>
                  <SectionHeader title={sec.title} action="see all" onAction={() => (sec.link ? openLink(sec.link) : router.navigate('/shop'))} style={{ marginTop: gap(26) }} />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                    {list.map((p, i) => (
                      <DealCard key={p.handle} product={p} index={i} width={dealW} />
                    ))}
                  </ScrollView>
                </View>
              );
            }
            case 'image':
              return sec.image ? <ImageSection key={sec.id ?? si} image={sec.image} link={sec.link} width={width} height={Number(sec.height) || 0} radius={L.imageBannerRadius} top={gap(26)} /> : null;
            case 'reviews':
              return (
                <View key={sec.id ?? si}>
                  <Txt v="h2" style={{ marginTop: gap(30), marginBottom: 4, paddingHorizontal: 20 }}>
                    {sec.title}
                  </Txt>
                  {!!sec.subtitle && (
                    <Txt v="small" color={t.textSoft} style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                      {sec.subtitle}
                    </Txt>
                  )}
                  <Reviews />
                </View>
              );
            case 'pillars':
              return (
                <View key={sec.id ?? si} style={{ marginTop: gap(30) }}>
                  <Pillars />
                </View>
              );
            default:
              return null;
          }
        })}

        <View style={{ alignItems: 'center', marginTop: 36, gap: 4 }}>
          <RosierLogo width={130} color={t.textMute} />
          <Tagline style={{ fontFamily: fonts.serif, fontSize: 15, color: t.textSoft, marginTop: 4 }} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute }}>{general.footerNote}</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

/** Full-width image section — keeps the uploaded image's own shape. */
function ImageSection({ image, link, width, height = 0, radius = 18, top = 26 }: { image: string; link?: string; width: number; height?: number; radius?: number; top?: number }) {
  const t = useTheme();
  const [aspect, setAspect] = useState(2);
  const w = width - 40;
  return (
    <PressableScale scaleTo={0.98} onPress={() => openLink(link)} style={{ marginTop: top, alignSelf: 'center', width: w }}>
      <Image
        source={{ uri: resolveImage(image) }}
        style={{ width: w, height: height > 0 ? height : w / aspect, borderRadius: radius, backgroundColor: t.card }}
        contentFit="cover"
        transition={250}
        cachePolicy="memory-disk"
        onLoad={(e) => e.source.width && e.source.height && setAspect(Math.min(4, Math.max(0.5, e.source.width / e.source.height)))}
      />
    </PressableScale>
  );
}
