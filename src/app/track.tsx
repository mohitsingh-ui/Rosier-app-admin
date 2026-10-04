/**
 * Track an order. Logged-in customers jump straight to their order; anyone else
 * enters the order number + the email or phone they ordered with.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Editable } from '../components/Editable';
import { TrackingView, TrackOrder } from '../components/Tracking';
import { Button, ScreenHeader } from '../components/ui';
import { useContent } from '../config/remote';
import { tap } from '../lib/haptics';
import { apiPost, loadCustomer, useAuth, useLoggedIn } from '../store/auth';
import { useApp } from '../store/app';
import { fonts, useTheme } from '../theme';

const digits = (s: string) => s.replace(/\D/g, '');

export default function Track() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cfg = useContent('tracking');
  const params = useLocalSearchParams<{ order?: string }>();
  const loggedIn = useLoggedIn();
  const customer = useAuth((s) => s.customer);
  const loading = useAuth((s) => s.loading);
  const myEmail = useApp((s) => s.email);
  const myPhone = useApp((s) => s.phone);

  const mine = loggedIn && params.order ? customer?.orders.find((o) => digits(o.name) === digits(String(params.order))) : undefined;
  const [orderNo, setOrderNo] = useState(params.order ? digits(String(params.order)) : '');
  const [contact, setContact] = useState(customer?.email || myEmail || myPhone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<TrackOrder | null>(null);

  const lookup = async () => {
    tap();
    setError('');
    if (!digits(orderNo) || !contact.trim()) return setError('Enter your order number and email or phone.');
    // Logged in and it's one of theirs: no need to ask the server.
    const own = customer?.orders.find((o) => digits(o.name) === digits(orderNo));
    if (loggedIn && own) return setFound(own);
    setBusy(true);
    try {
      setFound(await apiPost<TrackOrder>('/api/track', { order: orderNo, contact: contact.trim() }));
    } catch (e: any) {
      setError(e?.status === 503 ? 'Order lookup isn’t available yet. Please log in to see your orders.' : e?.message || 'Couldn’t look that up. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const order = mine ?? found;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title={cfg.title} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={mine ? <RefreshControl refreshing={loading} onRefresh={() => loadCustomer()} tintColor={t.primary} /> : undefined}
        >
          {order ? (
            <>
              <TrackingView order={order} />
              {!mine && <Button kind="ghost" small label="Track another order" icon="search" onPress={() => setFound(null)} />}
            </>
          ) : (
            <Editable id="tracking" label="Track order">
              <Animated.View entering={FadeInDown.springify()} style={{ backgroundColor: t.cardStrong, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: t.border, gap: 12 }}>
                <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="truck-fast-outline" size={28} color={t.primary} />
                </View>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: t.textSoft, lineHeight: 20 }}>{cfg.intro}</Text>
                <View>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: t.textSoft, marginBottom: 6 }}>{cfg.orderLabel}</Text>
                  <TextInput
                    value={orderNo}
                    onChangeText={setOrderNo}
                    placeholder="e.g. 1042"
                    placeholderTextColor={t.textMute}
                    keyboardType="number-pad"
                    style={{ height: 48, borderRadius: 14, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.bg, paddingHorizontal: 14, fontFamily: fonts.sansMedium, fontSize: 15, color: t.text }}
                  />
                </View>
                <View>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: t.textSoft, marginBottom: 6 }}>{cfg.contactLabel}</Text>
                  <TextInput
                    value={contact}
                    onChangeText={setContact}
                    placeholder="you@email.com or 98xxxxxxxx"
                    placeholderTextColor={t.textMute}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onSubmitEditing={lookup}
                    style={{ height: 48, borderRadius: 14, borderWidth: 1.2, borderColor: t.border, backgroundColor: t.bg, paddingHorizontal: 14, fontFamily: fonts.sansMedium, fontSize: 15, color: t.text }}
                  />
                </View>
                {!!error && (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={t.danger} />
                    <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12.5, color: t.danger }}>{error}</Text>
                  </View>
                )}
                {busy ? <ActivityIndicator color={t.primary} style={{ height: 54 }} /> : <Button label="Track order" icon="navigate-outline" onPress={lookup} />}
              </Animated.View>
            </Editable>
          )}

          {/* Logged in: quick picks of recent orders */}
          {!order && loggedIn && !!customer?.orders.length && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: t.textMute, marginTop: 6 }}>YOUR RECENT ORDERS</Text>
              {customer.orders.slice(0, 5).map((o) => (
                <Button key={o.id} kind="light" small label={`Order ${o.name} · ${new Date(o.processedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} onPress={() => setFound(o)} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
