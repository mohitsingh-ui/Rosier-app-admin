/**
 * Shopify login INSIDE the app (no jumping to the browser).
 *
 * The Shopify sign-in page (same account as rosierfoods.com) opens in an in-app
 * window. Their email is filled in and sent for them; when Shopify asks for the
 * 6-digit code, the app fills it in automatically as soon as they copy it from the
 * email (Gmail shows a "Copy code" button on the notification) — or with one tap on
 * "Paste code". On iPhone the code from Mail is also offered on the keyboard.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { completeLogin, loginUrls } from '../store/auth';
import { fonts, useTheme } from '../theme';

const CODE = /\b(\d{6})\b/;

function script(email: string) {
  return `(function(){
  if (window.__rosierLogin) return; window.__rosierLogin = true;
  var EMAIL = ${JSON.stringify(email)};
  var post = function(m){ try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch(e){} };
  var setVal = function(el, v){
    var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    d && d.set ? d.set.call(el, v) : (el.value = v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  var submitNear = function(el){
    var f = el.form || el.closest('form');
    var b = f && (f.querySelector('button[type=submit]') || f.querySelector('button:not([type=button])'));
    if (b && !b.disabled) b.click(); else if (f && f.requestSubmit) f.requestSubmit();
  };
  var codeInputs = function(){
    var one = document.querySelector('input[autocomplete="one-time-code"], input[name="code"], input[name*="otp" i]');
    if (one && one.maxLength !== 1) return [one];
    var boxes = Array.prototype.slice.call(document.querySelectorAll('input[inputmode="numeric"], input[type="tel"], input[type="number"]')).filter(function(i){ return i.maxLength === 1 || i.size === 1; });
    if (boxes.length >= 4) return boxes;
    return one ? [one] : [];
  };
  window.__rosierFillCode = function(code){
    var ins = codeInputs(); if (!ins.length) return false;
    if (ins.length === 1) { ins[0].focus(); setVal(ins[0], code); }
    else ins.forEach(function(el, i){ el.focus(); setVal(el, code.charAt(i) || ''); });
    setTimeout(function(){ submitNear(ins[ins.length - 1]); }, 250);
    return true;
  };
  var emailDone = false, codeSent = false;
  setInterval(function(){
    var e = document.querySelector('input[type="email"], input[name="email"], input[autocomplete="email"], input[autocomplete="username"]');
    if (e && EMAIL && !emailDone && e.offsetParent !== null) {
      emailDone = true;
      if (!e.value) setVal(e, EMAIL);
      setTimeout(function(){ submitNear(e); }, 350);
    }
    var c = codeInputs();
    if (c.length && c[0].offsetParent !== null && !codeSent) { codeSent = true; post({ type: 'codeStep' }); }
    if (!c.length) codeSent = false;
  }, 600);
})(); true;`;
}

export function InAppLogin({ email, onClose, onDone }: { email: string; onClose: () => void; onDone: (ok: boolean, error?: string) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { start, redirect } = useMemo(() => loginUrls(email), [email]);
  const js = useMemo(() => script(email), [email]);
  const web = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [codeStep, setCodeStep] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const lastCode = useRef('');
  const handled = useRef(false);
  const { WebView } = require('react-native-webview');

  const fill = (code: string) => {
    if (!code || code === lastCode.current) return false;
    lastCode.current = code;
    web.current?.injectJavaScript(`window.__rosierFillCode && window.__rosierFillCode(${JSON.stringify(code)}); true;`);
    return true;
  };

  const readClipboard = async (manual = false) => {
    try {
      const s = await Clipboard.getStringAsync();
      const m = String(s || '').match(CODE);
      if (m) fill(m[1]);
      else if (manual) onDoneHint('Copy the 6-digit code from the email first');
    } catch {
      /* clipboard not available */
    }
  };
  const [hint, setHint] = useState('');
  const onDoneHint = (h: string) => {
    setHint(h);
    setTimeout(() => setHint(''), 2500);
  };

  // Android: watch for the code being copied (e.g. "Copy code" on the Gmail notification) and fill it in.
  useEffect(() => {
    if (!codeStep || Platform.OS !== 'android') return;
    const id = setInterval(() => readClipboard(false), 1200);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && readClipboard(false));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [codeStep]);

  const finish = async (url: string) => {
    if (handled.current) return;
    handled.current = true;
    setFinishing(true);
    try {
      const ok = await completeLogin(url);
      onDone(ok);
    } catch (e: any) {
      onDone(false, e?.message);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52, borderBottomWidth: 1, borderColor: t.border }}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color={t.text} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.sansSemi, fontSize: 16, color: t.text }}>Log in to Rosier</Text>
          <View style={{ width: 40, alignItems: 'center' }}>
            <Ionicons name="lock-closed" size={16} color={t.green} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <WebView
            ref={web}
            source={{ uri: start }}
            injectedJavaScript={js}
            injectedJavaScriptForMainFrameOnly
            onMessage={(e: any) => {
              try {
                const m = JSON.parse(e.nativeEvent.data);
                if (m.type === 'codeStep') {
                  setCodeStep(true);
                  readClipboard(false);
                }
              } catch {}
            }}
            onLoadEnd={() => setLoading(false)}
            onShouldStartLoadWithRequest={(req: any) => {
              // Shopify sends them back to rosier://auth?ticket=… — finish the login right here.
              if (req.url.startsWith(redirect) || /^(rosier|exp|exps):\/\//.test(req.url)) {
                finish(req.url);
                return false;
              }
              return true;
            }}
            onRenderProcessGone={() => onDone(false, 'Login window closed. Please try again.')}
            // Private window: Shopify's sign-in isn't remembered on the phone, so logging out of the app is enough.
            incognito
            setSupportMultipleWindows={false}
            keyboardDisplayRequiresUserAction={false}
            style={{ flex: 1, backgroundColor: t.bg }}
          />
          {(loading || finishing) && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={t.primary} />
              <Text style={{ fontFamily: fonts.sansMedium, color: t.textSoft }}>{finishing ? 'Logging you in…' : 'Opening secure login…'}</Text>
            </View>
          )}
        </View>
        {codeStep && !finishing && (
          <Animated.View entering={FadeInUp.springify()} style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderColor: t.border, backgroundColor: t.cardStrong, gap: 10 }}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: t.textSoft, textAlign: 'center' }}>
              {hint || (Platform.OS === 'android' ? 'Copy the code from the email — we’ll fill it in for you automatically.' : 'Tap the code above your keyboard, or copy it from the email and tap Paste.')}
            </Text>
            <Pressable onPress={() => readClipboard(true)} style={{ height: 48, borderRadius: 14, backgroundColor: t.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="clipboard-outline" size={18} color="#fff" />
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: '#fff' }}>Paste code</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

/* ───────── Host: opened from anywhere with login() ───────── */

function EmailStep({ initial, onNext, onClose }: { initial: string; onNext: (e: string) => void; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(initial);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const { TextInput, KeyboardAvoidingView } = require('react-native');
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: t.cardStrong, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: t.heading }}>Log in</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: t.textSoft, marginTop: 4 }}>Same account as rosierfoods.com. We’ll email you a 6-digit code.</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoFocus
            placeholder="you@example.com"
            placeholderTextColor={t.textMute}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={() => ok && onNext(email.trim())}
            style={{ marginTop: 14, height: 54, borderRadius: 16, backgroundColor: t.card, paddingHorizontal: 16, fontFamily: fonts.sans, fontSize: 16, color: t.text, borderWidth: 1.5, borderColor: ok ? t.primary : t.border }}
          />
          <Pressable disabled={!ok} onPress={() => onNext(email.trim())} style={{ marginTop: 14, height: 52, borderRadius: 16, backgroundColor: t.accent, opacity: ok ? 1 : 0.5, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 16, color: '#fff' }}>Send me the code</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function LoginHost() {
  const { useLoginHost } = require('../store/auth') as typeof import('../store/auth');
  const { useApp } = require('../store/app') as typeof import('../store/app');
  const { open, email, resolve, reject } = useLoginHost();
  const [step, setStep] = useState<'email' | 'web'>('email');
  const [addr, setAddr] = useState('');
  useEffect(() => {
    if (!open) return;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setAddr(email);
    setStep(ok ? 'web' : 'email');
  }, [open]);
  if (!open || Platform.OS === 'web') return null;
  const close = (ok: boolean, err?: string) => {
    useLoginHost.setState({ open: false, resolve: null, reject: null });
    if (err) reject?.(new Error(err));
    else resolve?.(ok);
  };
  if (step === 'email')
    return (
      <EmailStep
        initial={addr}
        onClose={() => close(false)}
        onNext={(e) => {
          useApp.getState().setProfile({ email: e });
          setAddr(e);
          setStep('web');
        }}
      />
    );
  return <InAppLogin email={addr} onClose={() => close(false)} onDone={(ok, err) => close(ok, ok ? undefined : err)} />;
}
