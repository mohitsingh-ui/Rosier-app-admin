import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { toast } from '../components/Toast';
import { useRemote } from '../config/remote';
import { fonts } from '../theme';

/**
 * Opened by the "Preview on phone" QR code in the admin panel:
 * rosier://preview?token=…&api=…  → shows unpublished changes on this phone.
 */
export default function Preview() {
  const { token, api } = useLocalSearchParams<{ token?: string; api?: string }>();
  useEffect(() => {
    (async () => {
      const ok = token ? await useRemote.getState().startPreview(String(token), String(api ?? '')) : false;
      toast(ok ? 'Showing your unpublished changes' : 'Preview link did not work', ok ? 'ok' : 'info');
      router.replace('/');
    })();
  }, [token, api]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBEBD8', gap: 12 }}>
      <ActivityIndicator color="#A56312" />
      <Text style={{ fontFamily: fonts.sansMedium, color: '#7A6453' }}>Loading preview…</Text>
    </View>
  );
}
