import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Coin } from '../components/Coin';
import { Chip, CountUp, EmptyState, ScreenHeader } from '../components/ui';
import { timeAgo } from '../lib/format';
import { CoinEntry, useCoins, usePendingCoins } from '../store/shop';
import { fonts, useTheme } from '../theme';

const META: Record<CoinEntry['kind'], { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string }> = {
  earn: { icon: 'arrow-down-bold-circle-outline', tint: '#2F8A3E' },
  bonus: { icon: 'gift-outline', tint: '#B8862E' },
  refund: { icon: 'undo-variant', tint: '#2F8A3E' },
  redeem: { icon: 'ticket-percent-outline', tint: '#C0392B' },
  pending: { icon: 'timer-sand', tint: '#8B7B6E' },
};

export default function CoinHistory() {
  const t = useTheme();
  const history = useCoins((s) => s.history);
  const balance = useCoins((s) => s.balance);
  const lifetime = useCoins((s) => s.lifetime);
  const pending = usePendingCoins();
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const list = history.filter((h) => (filter === 'all' ? true : filter === 'in' ? h.amount > 0 : h.amount < 0));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Coin History" />
      <FlatList
        data={list}
        keyExtractor={(h) => h.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                ['Available', balance],
                ['Pending', pending],
                ['Lifetime', lifetime],
              ].map(([label, n]) => (
                <View key={label as string} style={{ flex: 1, backgroundColor: t.card, borderRadius: 16, padding: 12, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Coin size={16} />
                    <CountUp value={n as number} style={{ fontFamily: fonts.sansSemi, fontSize: 17, color: t.text }} />
                  </View>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textSoft }}>{label as string}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label="Earned" active={filter === 'in'} onPress={() => setFilter('in')} />
              <Chip label="Spent" active={filter === 'out'} onPress={() => setFilter('out')} />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="time-outline" title="No coin activity yet" body="Place an order and watch your coins roll in." />}
        renderItem={({ item, index }) => {
          const m = META[item.kind];
          return (
            <Animated.View entering={FadeInDown.delay(index * 40)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.cardStrong, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: t.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={m.icon} size={20} color={m.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: t.text }}>{item.label}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: t.textMute }}>
                  {item.kind === 'pending' && item.releaseAt ? `Unlocks ${new Date(item.releaseAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : timeAgo(item.time)}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: m.tint }}>
                {item.amount > 0 ? '+' : ''}
                {item.amount}
              </Text>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}
