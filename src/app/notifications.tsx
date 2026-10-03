import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EmptyState, PressableScale, ScreenHeader } from '../components/ui';
import { openLink } from '../lib/links';
import { timeAgo } from '../lib/format';
import { useApp } from '../store/app';
import { fonts, useTheme } from '../theme';

export default function Notifications() {
  const t = useTheme();
  const items = useApp((s) => s.notifications);
  const markAllRead = useApp((s) => s.markAllRead);
  useEffect(() => {
    const id = setTimeout(markAllRead, 1200);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {!items.length && <EmptyState icon="notifications-outline" title="All caught up" body="Offers, order updates and coin credits will show up here." />}
        {items.map((n, i) => (
          <Animated.View key={n.id} entering={FadeInDown.delay(i * 50).springify()}>
          <PressableScale scaleTo={n.link ? 0.97 : 1} haptic={!!n.link} onPress={() => n.link && openLink(n.link)} style={{ flexDirection: 'row', gap: 12, backgroundColor: n.read ? t.cardStrong : t.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: t.border }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.cardStrong, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="bell-ring-outline" size={20} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: t.text }}>{n.title}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textSoft, marginTop: 2 }}>{n.body}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute, marginTop: 6 }}>{timeAgo(n.time)}</Text>
            </View>
            {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D64545', marginTop: 6 }} />}
          </PressableScale>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
