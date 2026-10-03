import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Avatar } from '../components/Avatar';
import { toast } from '../components/Toast';
import { Button, ScreenHeader } from '../components/ui';
import { openStorePage } from '../lib/cart';
import { success } from '../lib/haptics';
import { useApp } from '../store/app';
import { fonts, useTheme } from '../theme';

export default function Account() {
  const t = useTheme();
  const app = useApp();
  const [name, setName] = useState(app.name);
  const [phone, setPhone] = useState(app.phone);
  const [email, setEmail] = useState(app.email);

  const field = (label: string, value: string, set: (s: string) => void, props: object = {}, i = 0) => (
    <Animated.View entering={FadeInDown.delay(i * 70).springify()} style={{ marginTop: 16 }}>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: t.textSoft, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        placeholderTextColor={t.textMute}
        style={{ height: 52, borderRadius: 14, backgroundColor: t.card, paddingHorizontal: 16, fontFamily: fonts.sans, fontSize: 15, color: t.text, borderWidth: 1, borderColor: t.border }}
        {...props}
      />
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Account" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center' }}>
          <Avatar size={96} editable />
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: t.textMute, marginTop: 8 }}>Tap to change your photo</Text>
        </View>
        {field('Name', name, setName, { placeholder: 'Your name' }, 0)}
        {field('Phone', phone, setPhone, { placeholder: '+91', keyboardType: 'phone-pad' }, 1)}
        {field('Email', email, setEmail, { placeholder: 'you@example.com', keyboardType: 'email-address', autoCapitalize: 'none' }, 2)}
        <Button
          label="Save"
          style={{ marginTop: 26 }}
          onPress={() => {
            app.setProfile({ name: name.trim() || app.name, phone: phone.trim(), email: email.trim() });
            success();
            toast('Profile updated');
            router.back();
          }}
        />
        <Button label="Manage addresses on rosierfoods.com" kind="ghost" style={{ marginTop: 12 }} onPress={() => openStorePage('/account')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
