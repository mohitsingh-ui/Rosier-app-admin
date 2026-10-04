import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Pillars } from '../components/HomeExtras';
import { RosierLogo, Tagline } from '../components/Logo';
import { Button, Img, ScreenHeader, Txt } from '../components/ui';
import { useContent } from '../config/remote';
import { openStorePage } from '../lib/cart';
import { fonts, useTheme } from '../theme';

const Para = ({ children, delay = 0 }: { children: string; delay?: number }) => {
  const t = useTheme();
  return (
    <Animated.Text entering={FadeInDown.delay(delay)} style={{ fontFamily: fonts.sans, fontSize: 15, color: t.textSoft, lineHeight: 24, marginTop: 10 }}>
      {children}
    </Animated.Text>
  );
};

const paras = (body: string) => String(body ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

export default function About() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const about = useContent('about');
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Our Story" />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {!!about.heroImage && <Img source={about.heroImage} size={width} style={{ width, height: width * 0.6 }} contentFit="cover" />}
        <LinearGradient colors={[t.header, t.bg]} style={{ padding: 20, paddingTop: 10 }}>
          <Animated.View entering={FadeInDown.springify()} style={{ alignItems: 'center', marginBottom: 14 }}>
            <RosierLogo width={150} color={t.mode === 'dark' ? '#E8C27A' : '#3E2415'} />
            <Tagline style={{ fontFamily: fonts.serif, fontSize: 16, color: t.heading, marginTop: 4 }} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(80).springify()} style={{ fontFamily: fonts.serifBold, fontSize: 28, color: t.heading, lineHeight: 34 }}>
            {about.headline}
          </Animated.Text>
          <Para delay={100}>{about.intro}</Para>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20 }}>
          {about.blocks.map((b, i) =>
            b.type === 'quote' ? (
              <Animated.View key={i} entering={FadeInDown.delay(100)} style={{ marginTop: 24, backgroundColor: t.card, borderRadius: 22, padding: 18 }}>
                {!!b.image && <Img source={b.image} size={300} style={{ width: '100%', height: 180, borderRadius: 16, marginBottom: 12 }} contentFit="cover" />}
                <MaterialCommunityIcons name="format-quote-open" size={30} color={t.gold} />
                <Txt v="h3" style={{ marginTop: 4 }}>
                  {b.title}
                </Txt>
                {paras(b.body).map((p, k) => (
                  <Para key={k}>{p}</Para>
                ))}
                {!!b.signature && <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: t.heading, marginTop: 12 }}>{b.signature}</Text>}
              </Animated.View>
            ) : (
              <View key={i}>
                <Txt v="h2" style={{ marginTop: i ? 28 : 10 }}>
                  {b.title}
                </Txt>
                {!!b.image && <Img source={b.image} size={300} style={{ width: '100%', height: 190, borderRadius: 18, marginTop: 12 }} contentFit="cover" />}
                {paras(b.body).map((p, k) => (
                  <Para key={k}>{p}</Para>
                ))}
              </View>
            ),
          )}
        </View>

        <View style={{ marginTop: 28 }}>
          <Pillars />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 10 }}>
          <Button label="See our lab reports" icon="flask-outline" kind="dark" onPress={() => openStorePage(about.labReportsPath)} />
          <Button label="Visit rosierfoods.com" kind="ghost" onPress={() => openStorePage(about.websitePath)} />
        </View>
      </ScrollView>
    </View>
  );
}
