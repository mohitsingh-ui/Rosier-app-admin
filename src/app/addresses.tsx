/**
 * Saved addresses — the same list customers see in their rosierfoods.com account.
 * Add, edit, delete and pick the default (used at checkout).
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '../components/Toast';
import { Button, PressableScale, ScreenHeader } from '../components/ui';
import { success } from '../lib/haptics';
import { Address, AddressInput, addAddress, editAddress, fetchAddresses, removeAddress, useAuth, useLoggedIn } from '../store/auth';
import { fonts, useTheme } from '../theme';

/** Indian states & union territories with Shopify's codes. */
export const IN_STATES: [string, string][] = [
  ['AN', 'Andaman and Nicobar Islands'], ['AP', 'Andhra Pradesh'], ['AR', 'Arunachal Pradesh'], ['AS', 'Assam'], ['BR', 'Bihar'], ['CH', 'Chandigarh'],
  ['CG', 'Chhattisgarh'], ['DN', 'Dadra and Nagar Haveli and Daman and Diu'], ['DL', 'Delhi'], ['GA', 'Goa'], ['GJ', 'Gujarat'], ['HR', 'Haryana'],
  ['HP', 'Himachal Pradesh'], ['JK', 'Jammu and Kashmir'], ['JH', 'Jharkhand'], ['KA', 'Karnataka'], ['KL', 'Kerala'], ['LA', 'Ladakh'], ['LD', 'Lakshadweep'],
  ['MP', 'Madhya Pradesh'], ['MH', 'Maharashtra'], ['MN', 'Manipur'], ['ML', 'Meghalaya'], ['MZ', 'Mizoram'], ['NL', 'Nagaland'], ['OR', 'Odisha'],
  ['PY', 'Puducherry'], ['PB', 'Punjab'], ['RJ', 'Rajasthan'], ['SK', 'Sikkim'], ['TN', 'Tamil Nadu'], ['TS', 'Telangana'], ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'], ['UK', 'Uttarakhand'], ['WB', 'West Bengal'],
];
const stateName = (code: string) => IN_STATES.find(([c]) => c === code)?.[1] ?? code;

const EMPTY: AddressInput = { firstName: '', lastName: '', company: '', address1: '', address2: '', city: '', zoneCode: '', country: 'IN', zip: '', phone: '' };

export default function Addresses() {
  const t = useTheme();
  const loggedIn = useLoggedIn();
  const [list, setList] = useState<Address[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; data: AddressInput; makeDefault: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setList(await fetchAddresses());
    } catch (e: any) {
      setError(e.message);
      setList((l) => l ?? []);
    }
  }, []);
  useEffect(() => {
    if (loggedIn) load();
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <ScreenHeader title="Saved addresses" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }}>
          <MaterialCommunityIcons name="map-marker-account-outline" size={56} color={t.primary} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: t.text, textAlign: 'center' }}>Log in to see and add your delivery addresses.</Text>
          <Button label="Log in" onPress={() => router.push('/login')} />
        </View>
      </View>
    );
  }

  const openNew = () => {
    const c = useAuth.getState().customer;
    setEditing({ id: null, data: { ...EMPTY, firstName: c?.firstName ?? '', lastName: c?.lastName ?? '', phone: c?.phone ?? '' }, makeDefault: !list?.length });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title="Saved addresses" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <PressableScale onPress={openNew} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.primary }}>
          <Ionicons name="add-circle" size={24} color={t.primary} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: t.primary }}>Add a new address</Text>
        </PressableScale>
        {list === null && <ActivityIndicator color={t.primary} style={{ marginTop: 30 }} />}
        {!!error && (
          <Pressable onPress={load} style={{ padding: 14, borderRadius: 14, backgroundColor: t.card }}>
            <Text style={{ fontFamily: fonts.sans, color: t.textSoft }}>{error} Tap to try again.</Text>
          </Pressable>
        )}
        {list?.length === 0 && !error && <Text style={{ fontFamily: fonts.sans, color: t.textMute, textAlign: 'center', marginTop: 20 }}>No saved addresses yet.</Text>}
        {list?.map((a, i) => (
          <Animated.View key={a.id} entering={FadeInDown.delay(Math.min(i, 6) * 40).springify()} layout={LinearTransition} style={{ backgroundColor: t.cardStrong, borderRadius: 18, padding: 16, borderWidth: a.isDefault ? 1.5 : 1, borderColor: a.isDefault ? t.primary : t.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={t.primary} />
              <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 15, color: t.text }}>{[a.firstName, a.lastName].filter(Boolean).join(' ') || 'Address'}</Text>
              {a.isDefault && (
                <View style={{ backgroundColor: t.greenSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, color: t.green }}>Default</Text>
                </View>
              )}
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: t.textSoft, marginTop: 6 }}>
              {[a.address1, a.address2, a.city, a.province || stateName(a.zoneCode), a.zip].filter(Boolean).join(', ')}
            </Text>
            {!!a.phone && <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textMute, marginTop: 4 }}>📞 {a.phone}</Text>}
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}>
              <Pressable hitSlop={8} onPress={() => setEditing({ id: a.id, data: { firstName: a.firstName, lastName: a.lastName, company: a.company, address1: a.address1, address2: a.address2, city: a.city, zoneCode: a.zoneCode, country: a.country || 'IN', zip: a.zip, phone: a.phone }, makeDefault: a.isDefault })}>
                <Text style={{ fontFamily: fonts.sansSemi, color: t.primary }}>Edit</Text>
              </Pressable>
              {!a.isDefault && (
                <Pressable
                  hitSlop={8}
                  disabled={busyId === a.id}
                  onPress={async () => {
                    setBusyId(a.id);
                    try {
                      setList(await editAddress(a.id, null, true));
                      success();
                      toast('Default address updated', 'ok');
                    } catch (e: any) {
                      toast(e.message, 'info');
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  <Text style={{ fontFamily: fonts.sansSemi, color: t.text }}>Make default</Text>
                </Pressable>
              )}
              <Pressable
                hitSlop={8}
                disabled={busyId === a.id}
                onPress={async () => {
                  setBusyId(a.id);
                  try {
                    setList(await removeAddress(a.id));
                    toast('Address deleted', 'ok');
                  } catch (e: any) {
                    toast(e.message, 'info');
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                <Text style={{ fontFamily: fonts.sansSemi, color: '#C0392B' }}>{busyId === a.id ? '…' : 'Delete'}</Text>
              </Pressable>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
      {editing && (
        <AddressForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(l) => {
            setList(l);
            setEditing(null);
            success();
            toast('Address saved', 'ok');
          }}
        />
      )}
    </View>
  );
}

function AddressForm({ initial, onClose, onSaved }: { initial: { id: string | null; data: AddressInput; makeDefault: boolean }; onClose: () => void; onSaved: (l: Address[]) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<AddressInput>(initial.data);
  const [makeDefault, setMakeDefault] = useState(initial.makeDefault);
  const [statePick, setStatePick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof AddressInput) => (v: string) => setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setErr('');
    if (!d.firstName.trim() || !d.address1.trim() || !d.city.trim()) return setErr('Please fill in your name, address and city.');
    if (!/^\d{6}$/.test(d.zip.trim())) return setErr('PIN code should be 6 digits.');
    if (!d.zoneCode) return setErr('Please choose your state.');
    if (d.phone && d.phone.replace(/\D/g, '').length < 10) return setErr('Please check the phone number.');
    setBusy(true);
    try {
      onSaved(initial.id ? await editAddress(initial.id, d, makeDefault) : await addAddress(d, makeDefault));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const input = { height: 50, borderRadius: 12, backgroundColor: t.card, paddingHorizontal: 14, fontFamily: fonts.sans, fontSize: 15, color: t.text, borderWidth: 1, borderColor: t.border } as const;
  const label = { fontFamily: fonts.sansMedium, fontSize: 12.5, color: t.textMute, marginTop: 12, marginBottom: 6 } as const;
  const F = (l: string, k: keyof AddressInput, props: object = {}) => (
    <View style={{ flex: 1 }}>
      <Text style={label}>{l}</Text>
      <TextInput value={String(d[k] ?? '')} onChangeText={set(k)} placeholderTextColor={t.textMute} style={input} {...props} />
    </View>
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: t.cardStrong, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontFamily: fonts.serif, fontSize: 21, color: t.heading }}>{initial.id ? 'Edit address' : 'New address'}</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={t.textSoft} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {F('First name', 'firstName', { autoComplete: 'name-given', textContentType: 'givenName' })}
              {F('Last name', 'lastName', { autoComplete: 'name-family', textContentType: 'familyName' })}
            </View>
            {F('Phone', 'phone', { keyboardType: 'phone-pad', placeholder: '10-digit mobile number', autoComplete: 'tel', textContentType: 'telephoneNumber' })}
            {F('Flat, house no., building', 'address1', { autoComplete: 'address-line1', textContentType: 'streetAddressLine1' })}
            {F('Area, street, landmark (optional)', 'address2', { autoComplete: 'address-line2', textContentType: 'streetAddressLine2' })}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {F('City', 'city', { autoComplete: 'postal-address-locality', textContentType: 'addressCity' })}
              {F('PIN code', 'zip', { keyboardType: 'number-pad', maxLength: 6, autoComplete: 'postal-code', textContentType: 'postalCode' })}
            </View>
            <Text style={label}>State</Text>
            <Pressable onPress={() => setStatePick(true)} style={[input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: d.zoneCode ? t.text : t.textMute }}>{d.zoneCode ? stateName(d.zoneCode) : 'Choose your state'}</Text>
              <Ionicons name="chevron-down" size={18} color={t.textMute} />
            </Pressable>
            <Pressable onPress={() => setMakeDefault((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <Ionicons name={makeDefault ? 'checkbox' : 'square-outline'} size={22} color={t.primary} />
              <Text style={{ fontFamily: fonts.sansMedium, color: t.text }}>Use as my default delivery address</Text>
            </Pressable>
            {!!err && <Text style={{ fontFamily: fonts.sans, color: '#C0392B', marginTop: 12 }}>{err}</Text>}
            <Button label={busy ? 'Saving…' : 'Save address'} disabled={busy} onPress={save} style={{ marginTop: 18 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={statePick} transparent animationType="fade" onRequestClose={() => setStatePick(false)}>
        <Pressable onPress={() => setStatePick(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: t.cardStrong, borderRadius: 20, maxHeight: '75%', overflow: 'hidden' }}>
            <ScrollView>
              {IN_STATES.map(([code, name]) => (
                <Pressable
                  key={code}
                  onPress={() => {
                    setD((x) => ({ ...x, zoneCode: code }));
                    setStatePick(false);
                  }}
                  style={{ paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: 1, borderColor: t.border, backgroundColor: d.zoneCode === code ? t.card : 'transparent' }}
                >
                  <Text style={{ fontFamily: d.zoneCode === code ? fonts.sansSemi : fonts.sans, fontSize: 15, color: t.text }}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}
