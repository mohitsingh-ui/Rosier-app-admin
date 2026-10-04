import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useContent } from '../config/remote';
import { fonts, useTheme } from '../theme';
import { Img, Txt } from './ui';

export function Reviews() {
  const t = useTheme();
  const REVIEWS = useContent('reviews').items;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} snapToInterval={272} decelerationRate="fast">
      {REVIEWS.map((r, i) => (
        <Animated.View key={`${r.name}-${i}`} entering={FadeInRight.delay(Math.min(i, 6) * 35).springify()} style={{ width: 260, backgroundColor: t.cardStrong, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: t.border }}>
          <MaterialCommunityIcons name="format-quote-open" size={28} color={t.gold} />
          <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: t.heading, marginTop: 2 }}>{r.title}</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: t.textSoft, marginTop: 6, lineHeight: 19 }} numberOfLines={5}>
            {r.body}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {r.photo ? (
                <Img source={r.photo} size={30} style={{ width: 30, height: 30 }} contentFit="cover" />
              ) : (
                <Text style={{ fontFamily: fonts.serifBold, color: t.primary }}>{(r.name || '?')[0]}</Text>
              )}
            </View>
            <View>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: t.text }}>{r.name}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: t.textMute }}>{r.product}</Text>
            </View>
            <View style={{ marginLeft: 'auto', flexDirection: 'row' }}>
              {[0, 1, 2, 3, 4].map((k) => (
                <MaterialCommunityIcons key={k} name={k < Math.round(Number(r.rating) || 5) ? 'star' : 'star-outline'} size={12} color={t.gold} />
              ))}
            </View>
          </View>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

export function Pillars() {
  const t = useTheme();
  const p = useContent('pillars');
  const items = p.items.map((x) => [x.icon, x.title, x.body] as [any, string, string]);
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Txt v="h2">{p.title}</Txt>
      <Txt v="body" color={t.textSoft} style={{ marginBottom: 14 }}>
        {p.subtitle}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {items.map(([icon, title, body], i) => (
          <View key={i} style={{ width: '47.5%', backgroundColor: t.card, borderRadius: 18, padding: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.cardStrong, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name={icon} size={22} color={t.primary} />
            </View>
            <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: t.text, marginTop: 10 }}>{title}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: t.textSoft, marginTop: 4, lineHeight: 16 }}>{body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
