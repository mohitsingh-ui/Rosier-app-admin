import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useApp } from '../store/app';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RosierLogo } from '../components/Logo';
import { toast } from '../components/Toast';
import { Button } from '../components/ui';
import { useContent } from '../config/remote';
import { success } from '../lib/haptics';
import { login, useShopifyFlags } from '../store/auth';
import { fonts, useTheme } from '../theme';

/** Log in with the same Shopify account people use on rosierfoods.com. */
export default function Login() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const a = useContent('account');
  const flags = useShopifyFlags();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(useApp.getState().email || '');
  const native = Platform.OS !== 'web';
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // After logging in, always land on Home.
  const loggedIn = () => {
    success();
    toast('You’re logged in', 'ok');
    router.dismissAll?.();
    router.replace('/home');
  };

  const go = async () => {
    if (native) {
      if (!validEmail) return toast('Please enter your email', 'info');
      useApp.getState().setProfile({ email: email.trim() });
    }
    setBusy(true);
    try {
      const ok = await login(native ? email.trim() : undefined);
      if (ok) loggedIn();
    } catch (e: any) {
      toast(e?.message || 'Login didn’t work. Please try again.', 'info');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 30, flexGrow: 1 }}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center' }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="account-heart-outline" size={48} color={t.primary} />
          </View>
          <View style={{ marginTop: 18 }}>
            <RosierLogo width={110} color={t.mode === 'dark' ? '#E8C27A' : '#3E2415'} />
          </View>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(60)} style={{ fontFamily: fonts.serifBold, fontSize: 30, color: t.heading, textAlign: 'center', marginTop: 14 }}>
          {a.loginTitle}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(100)} style={{ fontFamily: fonts.sans, fontSize: 15, color: t.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
          {a.loginBody}
        </Animated.Text>

        <View style={{ marginTop: 26, gap: 10 }}>
          {a.perks.map((p, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(120 + Math.min(i, 6) * 35).springify()} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.cardStrong, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: t.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={p.icon as any} size={20} color={t.primary} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: t.text }}>{p.text}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />
        {flags.loginEnabled && native && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.textSoft, marginBottom: 6 }}>Your email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={t.textMute}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="go"
              onSubmitEditing={go}
              style={{ height: 54, borderRadius: 16, backgroundColor: t.cardStrong, paddingHorizontal: 16, fontFamily: fonts.sans, fontSize: 16, color: t.text, borderWidth: 1.5, borderColor: validEmail ? t.primary : t.border }}
            />
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute, marginTop: 6 }}>We’ll email you a 6-digit code. No password needed.</Text>
          </View>
        )}
        {flags.loginEnabled ? (
          <Button label={busy ? 'Opening…' : native ? 'Send me the code' : a.loginButton} icon="mail-outline" onPress={go} disabled={busy} style={{ marginTop: 14 }} />
        ) : (
          <Text style={{ fontFamily: fonts.sansMedium, color: t.textSoft, textAlign: 'center', marginTop: 20 }}>Login is coming soon.</Text>
        )}
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.sansMedium, color: t.textSoft, fontSize: 15 }}>{a.skipLabel}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
