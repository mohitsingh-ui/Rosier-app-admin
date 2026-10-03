import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openProduct } from '../components/ProductCard';
import { Button, Img, ScreenHeader } from '../components/ui';
import { useContent } from '../config/remote';
import { findProduct, useProducts } from '../data/catalog';
import { fonts, useTheme } from '../theme';

type Article = { id: string; enabled?: boolean; title: string; kicker: string; mins: number; icon: string; colors: string[]; image: string; product?: string; body: string };

const paras = (body: string) => String(body ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const grad = (c: string[]) => (c?.length >= 2 ? c : ['#F6D98C', '#C98A52']) as [string, string, ...string[]];

export default function Blog() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const products = useProducts();
  const [open, setOpen] = useState<Article | null>(null);
  const ARTICLES = (useContent('blog').articles as Article[]).filter((a) => a.enabled !== false);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Blog & Articles" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {ARTICLES.map((a, i) => (
          <Animated.View key={a.id} entering={FadeInDown.delay(i * 80).springify()}>
            <Pressable onPress={() => setOpen(a)} style={{ backgroundColor: t.cardStrong, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: t.border }}>
              {a.image ? (
                <Img source={a.image} size={400} style={{ height: 160, width: '100%' }} contentFit="cover" />
              ) : (
                <LinearGradient colors={grad(a.colors)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 130, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name={a.icon as any} size={64} color="rgba(62,36,21,0.75)" />
                </LinearGradient>
              )}
              <View style={{ padding: 16 }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, color: t.primary, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {a.kicker} · {a.mins} min read
                </Text>
                <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: t.text, marginTop: 4, lineHeight: 26 }}>{a.title}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textSoft, marginTop: 6 }} numberOfLines={2}>
                  {paras(a.body)[0]}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' }}>
          {open && (
            <Animated.View entering={SlideInDown.springify().damping(18)} style={{ maxHeight: '88%', backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
              <LinearGradient colors={grad(open.colors)} style={{ height: open.image ? 200 : 140, alignItems: 'center', justifyContent: 'center' }}>
                {open.image ? (
                  <Img source={open.image} size={400} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
                ) : (
                  <MaterialCommunityIcons name={open.icon as any} size={70} color="rgba(62,36,21,0.75)" />
                )}
                <Pressable onPress={() => setOpen(null)} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="close" size={20} color="#3E2415" />
                </Pressable>
              </LinearGradient>
              <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 24 }}>
                <Text style={{ fontFamily: fonts.serifBold, fontSize: 26, color: t.heading, lineHeight: 32 }}>{open.title}</Text>
                {paras(open.body).map((p, i) => (
                  <Animated.Text key={i} entering={FadeInDown.delay(100 + i * 80)} style={{ fontFamily: fonts.sans, fontSize: 15.5, color: t.text, lineHeight: 25, marginTop: 12 }}>
                    {p}
                  </Animated.Text>
                ))}
                {open.product && findProduct(products, open.product) && (
                  <Button
                    label="Shop the product"
                    style={{ marginTop: 22 }}
                    onPress={() => {
                      const p = findProduct(products, open.product!)!;
                      setOpen(null);
                      openProduct(p);
                    }}
                  />
                )}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </Modal>
    </View>
  );
}
