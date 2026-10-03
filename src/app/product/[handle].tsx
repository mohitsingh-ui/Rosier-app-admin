import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dot } from '../../components/Banners';
import { Coin } from '../../components/Coin';
import { flyFrom } from '../../components/FlyToCart';
import { CATEGORY_CHIPS, DealCard } from '../../components/ProductCard';
import { toast } from '../../components/Toast';
import { EmptyState, Img, PressableScale, QtyStepper } from '../../components/ui';
import { coinsForAmount } from '../../config/coins';
import { defaultVariant, findProduct, STORE_URL, useProducts } from '../../data/catalog';
import { rupee, shortTitle } from '../../lib/format';
import { success } from '../../lib/haptics';
import { useCart, useWishlist } from '../../store/shop';
import { fonts, useTheme } from '../../theme';

const FEATURES: Record<string, { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[]> = {
  ghee: [
    { icon: 'bowl-mix-outline', label: 'Curd' },
    { icon: 'water', label: 'A2 Milk' },
  ],
  atta: [
    { icon: 'grain', label: 'Chakki' },
    { icon: 'leaf', label: 'Fibre' },
  ],
  oils: [
    { icon: 'cog-outline', label: 'Stone Press' },
    { icon: 'water-outline', label: 'Unrefined' },
  ],
  breakfast: [
    { icon: 'arm-flex-outline', label: 'Protein' },
    { icon: 'timer-outline', label: 'Quick' },
  ],
  immunity: [
    { icon: 'bee', label: 'Raw' },
    { icon: 'forest', label: 'Forest' },
  ],
  pickles: [
    { icon: 'white-balance-sunny', label: 'Sun Dried' },
    { icon: 'hand-heart-outline', label: 'Handmade' },
  ],
  combos: [
    { icon: 'gift-outline', label: 'Combo' },
    { icon: 'sale', label: 'Savings' },
  ],
  membership: [
    { icon: 'crown-outline', label: 'Member' },
    { icon: 'truck-fast-outline', label: 'Free Ship' },
  ],
};

const TAGLINE: Record<string, string> = {
  ghee: 'देसी घी  देसी लोगों के लिए',
  atta: 'पुराना अनाज, नई ताक़त',
  oils: 'कच्ची घानी का असली स्वाद',
  pickles: 'दादी के हाथ का स्वाद',
  immunity: 'प्रकृति की मिठास',
  breakfast: 'सुबह की सही शुरुआत',
  combos: 'ज़्यादा लो, ज़्यादा बचाओ',
  membership: 'परिवार का हिस्सा बनिए',
};

export default function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const products = useProducts();
  const product = findProduct(products, handle);
  const [vid, setVid] = useState<number | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const liked = useWishlist((s) => (product ? s.handles.includes(product.handle) : false));
  const toggleLike = useWishlist((s) => s.toggle);
  const heroRef = useRef<View>(null);
  const y = useSharedValue(0);
  const heart = useSharedValue(1);
  const coinPulse = useSharedValue(1);

  useEffect(() => {
    coinPulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, []);

  const variant = product ? product.variants.find((v) => v.id === vid) ?? defaultVariant(product) : undefined;
  const line = useCart((s) => (variant ? s.items.find((i) => i.variantId === variant.id) : undefined));

  const HERO = height * 0.58;
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(y.value, [-200, 0, HERO], [-100, 0, HERO * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [-200, 0], [1.35, 1], Extrapolation.CLAMP) },
    ],
  }));
  const topBar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [HERO * 0.5, HERO * 0.8], [0, 1], Extrapolation.CLAMP) }));
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));
  const coinStyle = useAnimatedStyle(() => ({ transform: [{ scale: coinPulse.value }] }));

  if (!product || !variant) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}>
        <EmptyState icon="search" title="Product not found" body="It may have sold out or moved." cta="Back to shop" onCta={() => router.replace('/shop')} />
      </View>
    );
  }

  const related = products.filter((p) => p.category === product.category && p.handle !== product.handle && p.category !== 'membership').slice(0, 8);
  const features = FEATURES[product.category] ?? FEATURES.combos;
  const coins = coinsForAmount(variant.price);

  const addToCart = () => {
    if (!variant.available) return;
    add(product.handle, variant.id);
    flyFrom(heroRef, product.images[0]);
    success();
    toast(`Added! You'll earn ${coins} coins on this`, 'coin');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.cardStrong }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero gallery */}
        <Animated.View ref={heroRef as any} collapsable={false} style={[{ height: HERO, backgroundColor: '#2A1A10' }, heroStyle]}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {product.images.map((uri, i) => (
              <View key={uri} style={{ width, height: HERO, backgroundColor: '#F7EFE6' }}>
                <Img source={uri} size={width} style={{ width: '100%', height: '100%' }} contentFit={i === 0 ? 'contain' : 'cover'} />
              </View>
            ))}
          </ScrollView>
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(20,12,6,0.85)']} locations={[0, 0.2, 0.55, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />

          {/* Info panel over the image */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 26, flexDirection: 'row', alignItems: 'flex-end' }}>
            <Animated.View entering={FadeInUp.delay(150).springify()} style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 24, color: '#fff', lineHeight: 30 }} numberOfLines={2}>
                {shortTitle(product.title)}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: '#D9CFC6', marginTop: 2 }} numberOfLines={1}>
                {(CATEGORY_CHIPS[product.category] ?? []).join(' · ')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
                <Ionicons name="star" size={20} color="#D9844A" />
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: '#fff' }}>{product.rating.toFixed(1)}</Text>
                {product.badge && <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#D9CFC6', marginLeft: 6 }}>{product.badge}</Text>}
              </View>
            </Animated.View>
            <View style={{ gap: 10, alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {features.map((f, i) => (
                  <Animated.View key={f.label} entering={ZoomIn.delay(250 + i * 120).springify()} style={{ width: 66, height: 66, borderRadius: 14, backgroundColor: 'rgba(22,24,30,0.88)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name={f.icon} size={26} color="#D9844A" />
                    <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#E8E1DA', marginTop: 2 }}>{f.label}</Text>
                  </Animated.View>
                ))}
              </View>
              <Animated.View entering={FadeIn.delay(500)} style={{ backgroundColor: 'rgba(22,24,30,0.88)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, width: 142 }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: '#E8E1DA', textAlign: 'center' }}>{TAGLINE[product.category] ?? 'असली स्वाद'}</Text>
              </Animated.View>
            </View>
          </View>
          {product.images.length > 1 && (
            <View style={{ position: 'absolute', top: insets.top + 64, alignSelf: 'center', flexDirection: 'row', gap: 5 }}>
              {product.images.map((_, i) => (
                <Dot key={i} active={i === imgIdx} color="#fff" />
              ))}
            </View>
          )}
        </Animated.View>

        {/* Sheet */}
        <View style={{ backgroundColor: t.cardStrong, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -18, padding: 20 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: t.textMute }}>Description</Text>
          <Animated.View layout={LinearTransition}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: t.heading, marginTop: 4, lineHeight: 23 }} numberOfLines={expanded ? undefined : 3}>
              {expanded ? product.description : product.short}
            </Text>
          </Animated.View>
          {product.description.length > product.short.length + 10 && (
            <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: t.primary, marginTop: 6 }}>{expanded ? 'Show less' : 'Read more'}</Text>
            </Pressable>
          )}

          {/* Coins badge */}
          <Animated.View style={[{ alignSelf: 'flex-end', marginTop: 12 }, coinStyle]}>
            <Pressable onPress={() => router.navigate('/coins')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.cardStrong, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6, borderWidth: t.mode === 'dark' ? 1 : 0, borderColor: t.border }}>
              <Coin size={40} spin shine />
              <View>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: t.text }}>GET</Text>
                <Animated.Text key={coins} entering={FadeInDown.springify()} style={{ fontFamily: fonts.sansSemi, fontSize: 20, color: t.text, lineHeight: 23 }}>
                  {coins}
                </Animated.Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.text }}>Rosier Coins</Text>
              </View>
            </Pressable>
          </Animated.View>

          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: t.textMute, marginTop: 10 }}>Size</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {product.variants.map((v) => {
              const active = v.id === variant.id;
              return (
                <PressableScale
                  key={v.id}
                  onPress={() => setVid(v.id)}
                  disabled={!v.available}
                  style={{
                    minWidth: (width - 60) / 3,
                    paddingHorizontal: 12,
                    height: 50,
                    borderRadius: 12,
                    backgroundColor: '#151A20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: active ? '#C47A48' : '#151A20',
                    opacity: v.available ? 1 : 0.4,
                  }}
                >
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: active ? '#D9844A' : '#C9CDD2' }}>{v.title.toUpperCase()}</Text>
                  {!v.available && <Text style={{ fontFamily: fonts.sans, fontSize: 9, color: '#C9CDD2' }}>Sold out</Text>}
                </PressableScale>
              );
            })}
          </View>

          {/* Price breakup */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}>
            {variant.discount > 0 && (
              <View style={{ backgroundColor: t.greenSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: t.green }}>{variant.discount}% OFF</Text>
              </View>
            )}
            {variant.mrp > variant.price && (
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textMute }}>
                MRP <Text style={{ textDecorationLine: 'line-through' }}>{rupee(variant.mrp)}</Text> · You save {rupee(variant.mrp - variant.price)}
              </Text>
            )}
          </View>

          {/* Trust row */}
          <View style={{ flexDirection: 'row', marginTop: 18, backgroundColor: t.card, borderRadius: 18, paddingVertical: 14 }}>
            {[
              ['flask-outline', 'Lab tested'],
              ['sprout-outline', 'Farm sourced'],
              ['shield-check-outline', 'Secure checkout'],
            ].map(([icon, label]) => (
              <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <MaterialCommunityIcons name={icon as any} size={22} color={t.primary} />
                <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, color: t.textSoft, textAlign: 'center' }}>{label}</Text>
              </View>
            ))}
          </View>

          {related.length > 0 && (
            <>
              <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: t.heading, marginTop: 26, marginBottom: 12 }}>You may also like</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
                {related.map((p, i) => (
                  <DealCard key={p.handle} product={p} index={i} width={150} />
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </Animated.ScrollView>

      {/* Floating top bar */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 60, backgroundColor: t.cardStrong, borderBottomWidth: 1, borderColor: t.border }, topBar]}>
        <Text style={{ position: 'absolute', bottom: 16, left: 80, right: 80, textAlign: 'center', fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }} numberOfLines={1}>
          {shortTitle(product.title)}
        </Text>
      </Animated.View>
      <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(22,24,30,0.85)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </PressableScale>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PressableScale
            onPress={() => Share.share({ message: `${product.title} from Rosier Foods — ${STORE_URL}/products/${product.handle}` })}
            style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(22,24,30,0.85)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-social-outline" size={20} color="#fff" />
          </PressableScale>
          <PressableScale
            onPress={() => {
              toggleLike(product.handle);
              heart.value = withSequence(withSpring(1.4), withSpring(1));
              success();
              toast(liked ? 'Removed from wishlist' : 'Saved to your wishlist', 'ok');
            }}
            style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(22,24,30,0.85)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View style={heartStyle}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? '#E0474C' : '#fff'} />
            </Animated.View>
          </PressableScale>
        </View>
      </View>

      {/* Sticky buy bar */}
      <Animated.View entering={FadeInUp.delay(200).springify()} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.cardStrong, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: 1, borderColor: t.border }}>
        <View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textMute }}>Price</Text>
          <Animated.Text key={variant.id} entering={FadeInDown.springify()} style={{ fontFamily: fonts.serifBold, fontSize: 28, color: t.text }}>
            {rupee(variant.price)}
          </Animated.Text>
        </View>
        <View style={{ flex: 1 }}>
          {!variant.available ? (
            <View style={{ height: 58, borderRadius: 20, backgroundColor: t.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 16, color: t.textSoft }}>Out of stock</Text>
            </View>
          ) : line ? (
            <Animated.View entering={ZoomIn.springify()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ height: 58, borderRadius: 20, borderWidth: 1.5, borderColor: t.accent, paddingHorizontal: 10, justifyContent: 'center' }}>
                <QtyStepper qty={line.qty} onChange={(n) => setQty(variant.id, n)} compact />
              </View>
              <PressableScale onPress={() => router.navigate('/cart')} style={{ flex: 1, height: 58, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                <Ionicons name="cart" size={18} color="#fff" />
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: '#fff' }}>Cart</Text>
              </PressableScale>
            </Animated.View>
          ) : (
            <PressableScale onPress={addToCart} style={{ height: 58, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 18, color: '#fff' }}>Add to Cart</Text>
            </PressableScale>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
