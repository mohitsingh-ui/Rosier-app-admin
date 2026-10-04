import { Brygada1918_400Regular } from '@expo-google-fonts/brygada-1918/400Regular';
import { Brygada1918_600SemiBold } from '@expo-google-fonts/brygada-1918/600SemiBold';
import { Brygada1918_700Bold } from '@expo-google-fonts/brygada-1918/700Bold';
import { Poppins_300Light } from '@expo-google-fonts/poppins/300Light';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import Stack from 'expo-router/stack';
import { usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FlyHost } from '../components/FlyToCart';
import { RemoteGate } from '../components/RemoteGate';
import { getContent, useRemote } from '../config/remote';
import { creditNewOrders, hasTokens, loadCustomer } from '../store/auth';
import { reportRoute, startEditorBridge } from '../lib/editorBridge';
import { ToastHost } from '../components/Toast';
import { useBanners } from '../data/banners';
import { useCatalog } from '../data/catalog';
import { useApp } from '../store/app';
import { useCoins } from '../store/shop';
import { useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Web only: finishes the Shopify login popup. Does nothing on phones.
WebBrowser.maybeCompleteAuthSession();

/** New notifications published from the admin panel land in the inbox once. */
function deliverAnnouncements() {
  const { announced } = useRemote.getState();
  const items = (getContent('announcements').items as { id: string; title: string; body: string; link?: string }[]).filter((a) => a?.id && a.title);
  const fresh = items.filter((a) => !announced.includes(a.id));
  if (!fresh.length) return;
  for (const a of [...fresh].reverse()) useApp.getState().pushNotification(a.title, a.body, { id: `a-${a.id}`, link: a.link || undefined });
  useRemote.setState({ announced: [...announced, ...fresh.map((a) => a.id)].slice(-200) });
}

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);

function useRemoteHydrated() {
  const [done, setDone] = useState(useRemote.persist.hasHydrated());
  useEffect(() => {
    if (done) return;
    return useRemote.persist.onFinishHydration(() => setDone(true));
  }, [done]);
  return done;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Brygada1918_400Regular,
    Brygada1918_600SemiBold,
    Brygada1918_700Bold,
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const appHydrated = useApp((s) => s.hydrated);
  const remoteHydrated = useRemoteHydrated();
  const hydrated = appHydrated && remoteHydrated;
  const t = useTheme();
  const pathname = usePathname();
  useEffect(() => reportRoute(pathname), [pathname]);

  useEffect(() => {
    if (loaded && hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, hydrated]);

  useEffect(() => {
    if (hydrated) startEditorBridge();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      useCatalog.getState().refresh();
      useBanners.getState().refresh();
      // Get the latest content from the admin panel (don't wait more than 4s).
      await withTimeout(useRemote.getState().refresh(), 4000);
      const firstLaunch = !useCoins.getState().initialised;
      useCoins.getState().init();
      if (firstLaunch) {
        const w = getContent('general').welcomeNotification;
        if (w?.title) useApp.getState().pushNotification(w.title, w.body, { id: 'welcome' });
      }
      // Credit any coins whose waiting period is over.
      useCoins.getState().releasePending();
      deliverAnnouncements();
      // Logged-in customers: pick up new Shopify orders (app or website) and their coins.
      if (hasTokens()) loadCustomer().then(() => creditNewOrders());
    })();

    // Coming back to the app picks up anything published in the meantime.
    let last = Date.now();
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || Date.now() - last < 30_000) return;
      last = Date.now();
      await useRemote.getState().refresh();
      deliverAnnouncements();
      useCatalog.getState().refresh();
      if (hasTokens()) loadCustomer().then(() => creditNewOrders());
    });
    return () => sub.remove();
  }, [hydrated]);

  if (!loaded || !hydrated) return <View style={{ flex: 1, backgroundColor: '#FBEBD8' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <SafeAreaProvider>
        <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="product/[handle]" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="search" options={{ animation: 'fade' }} />
          <Stack.Screen name="preview" options={{ animation: 'none' }} />
          <Stack.Screen name="login" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="auth" options={{ animation: 'none' }} />
        </Stack>
        <FlyHost />
        <RemoteGate />
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
