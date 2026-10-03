import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { coinsForAmount } from '../config/coins';
import { defaultVariant } from '../data/catalog';
import type { Product } from '../data/types';
import { rupee, shortTitle } from '../lib/format';
import { success } from '../lib/haptics';
import { useCart, useWishlist } from '../store/shop';
import { fonts, useTheme } from '../theme';
import { Coin } from './Coin';
import { flyFrom } from './FlyToCart';
import { toast } from './Toast';
import { Img, PressableScale, QtyStepper, styles } from './ui';

export const CATEGORY_CHIPS: Record<string, string[]> = {
  ghee: ['Made From Curd', 'Bilona'],
  atta: ['Stone Ground', 'Chakki Fresh'],
  oils: ['Stone Pressed', 'Unrefined'],
  breakfast: ['High Protein', 'Quick Prep'],
  immunity: ['Raw', 'Forest Sourced'],
  pickles: ['Sun Dried', 'Small Batch'],
  combos: ['Combo', 'Save More'],
  membership: ['Members Only'],
};

export const openProduct = (p: Product) => router.push({ pathname: '/product/[handle]', params: { handle: p.handle } });

/** Compact "Limited deals" card from the design. */
export function DealCard({ product, index = 0, width = 150 }: { product: Product; index?: number; width?: number }) {
  const t = useTheme();
  const v = defaultVariant(product);
  const add = useCart((s) => s.add);
  const imgRef = useRef<View>(null);
  return (
    <Animated.View entering={FadeInDown.delay(80 * index).springify().damping(14)}>
      <PressableScale onPress={() => openProduct(product)} style={{ width, backgroundColor: t.card, borderRadius: 18, padding: 10 }}>
        <View ref={imgRef} collapsable={false} style={{ height: width * 0.95, alignItems: 'center', justifyContent: 'center' }}>
          <Img source={product.images[0]} size={width} style={{ width: '100%', height: '100%' }} />
          {v.available && (
            <PressableScale
              onPress={() => {
                add(product.handle, v.id);
                flyFrom(imgRef, product.images[0]);
                success();
              }}
              style={{ position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: t.deepAlt, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={20} color="#FBE6CF" />
            </PressableScale>
          )}
        </View>
        <Text numberOfLines={2} style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.text, marginTop: 6, minHeight: 36, lineHeight: 18 }}>
          {shortTitle(product.title)} {v.title.length < 12 ? v.title : ''}
        </Text>
        <View style={[styles.row, { gap: 4, marginTop: 4, flexWrap: 'wrap' }]}>
          <Text style={{ fontFamily: fonts.serifBold, fontSize: 16, color: t.price }}>{rupee(v.price)}</Text>
          {v.mrp > v.price && <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute, textDecorationLine: 'line-through' }}>{rupee(v.mrp)}</Text>}
          {v.discount > 0 && (
            <View style={{ backgroundColor: t.green, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 'auto' }}>
              <Text style={{ color: '#fff', fontFamily: fonts.sansMedium, fontSize: 10 }}>{v.discount}% off</Text>
            </View>
          )}
        </View>
        <View style={{ height: 1, backgroundColor: t.border, marginVertical: 7 }} />
        <View style={[styles.row, { gap: 6 }]}>
          <Coin size={18} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft }}>Earn {coinsForAmount(v.price)} Coins</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** Bigger card used in "Loved Across Generations" and the shop grid. */
export function GridCard({ product, index = 0, width }: { product: Product; index?: number; width: number }) {
  const t = useTheme();
  const [vid, setVid] = useState(defaultVariant(product).id);
  const [open, setOpen] = useState(false);
  const v = product.variants.find((x) => x.id === vid) ?? product.variants[0];
  const line = useCart((s) => s.items.find((i) => i.variantId === v.id));
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const liked = useWishlist((s) => s.handles.includes(product.handle));
  const toggleLike = useWishlist((s) => s.toggle);
  const imgRef = useRef<View>(null);

  return (
    <Animated.View entering={FadeInDown.delay(60 * (index % 6)).springify().damping(15)} layout={LinearTransition.springify()} style={{ width }}>
      <PressableScale scaleTo={0.97} onPress={() => openProduct(product)} style={[{ backgroundColor: t.cardStrong, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: t.border }, styles.shadow]}>
        <View ref={imgRef} collapsable={false} style={{ backgroundColor: t.card, borderRadius: 14, height: width * 0.9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Img source={product.images[0]} size={width} style={{ width: '92%', height: '92%' }} />
          {product.badge && (
            <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(62,36,21,0.85)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#FBE6CF', fontFamily: fonts.sansMedium, fontSize: 9 }}>{product.badge}</Text>
            </View>
          )}
          <Pressable
            hitSlop={8}
            onPress={() => {
              toggleLike(product.handle);
              success();
            }}
            style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Animated.View key={String(liked)} entering={ZoomIn.springify()}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={17} color={liked ? '#D64545' : '#5A3520'} />
            </Animated.View>
          </Pressable>
        </View>

        <Text numberOfLines={2} style={{ fontFamily: fonts.serif, fontSize: 14, color: t.heading, marginTop: 8, minHeight: 38, lineHeight: 19 }}>
          {shortTitle(product.title)}
        </Text>
        <View style={[styles.row, { gap: 4, marginTop: 4, flexWrap: 'wrap' }]}>
          {(CATEGORY_CHIPS[product.category] ?? []).map((c) => (
            <View key={c} style={{ backgroundColor: t.mode === 'dark' ? '#3B4A2F' : '#3F5A2A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 }}>
              <Text style={{ color: '#E9F3DE', fontFamily: fonts.sans, fontSize: 9 }}>{c}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.row, { marginTop: 6, gap: 3, backgroundColor: t.card, alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5 }]}>
          <Ionicons name="star" size={10} color={t.gold} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10, color: t.text }}>{product.rating.toFixed(1)}</Text>
        </View>

        {product.variants.length > 1 ? (
          <View style={{ marginTop: 8 }}>
            <Pressable
              onPress={() => setOpen((o) => !o)}
              style={[styles.row, { borderWidth: 1.2, borderColor: t.accent, borderRadius: 10, height: 34, paddingHorizontal: 10, justifyContent: 'space-between' }]}
            >
              <Text numberOfLines={1} style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: t.text, flex: 1 }}>{v.title}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={t.accent} />
            </Pressable>
            {open && (
              <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ marginTop: 4, backgroundColor: t.card, borderRadius: 10, overflow: 'hidden' }}>
                {product.variants.map((x) => (
                  <Pressable
                    key={x.id}
                    disabled={!x.available}
                    onPress={() => {
                      setVid(x.id);
                      setOpen(false);
                    }}
                    style={{ paddingVertical: 7, paddingHorizontal: 10, backgroundColor: x.id === v.id ? t.border : 'transparent', opacity: x.available ? 1 : 0.4 }}
                  >
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.text }}>
                      {x.title} · {rupee(x.price)}
                    </Text>
                  </Pressable>
                ))}
              </Animated.View>
            )}
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textSoft, marginTop: 8, height: 34, textAlignVertical: 'center', lineHeight: 34 }} numberOfLines={1}>
            {v.title}
          </Text>
        )}

        <View style={{ marginTop: 6 }}>
          {v.discount > 0 && <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: t.green }}>({v.discount}% off)</Text>}
          <View style={[styles.row, { gap: 6 }]}>
            {v.mrp > v.price && <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute, textDecorationLine: 'line-through' }}>{rupee(v.mrp, true)}</Text>}
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>{rupee(v.price, true)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 8, height: 36, justifyContent: 'center' }}>
          {!v.available ? (
            <View style={{ height: 36, borderRadius: 10, backgroundColor: t.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 1.5, color: t.textSoft }}>OUT OF STOCK</Text>
            </View>
          ) : line ? (
            <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center' }}>
              <QtyStepper compact qty={line.qty} onChange={(n) => setQty(v.id, n)} />
            </Animated.View>
          ) : (
            <PressableScale
              onPress={() => {
                add(product.handle, v.id);
                flyFrom(imgRef, product.images[0]);
                success();
                toast(`Added to cart · earn ${coinsForAmount(v.price)} coins`, 'coin');
              }}
              style={{ height: 36, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 1.8, color: '#fff' }}>ADD TO CART</Text>
            </PressableScale>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
}
