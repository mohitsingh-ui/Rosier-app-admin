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
import { SeasonalEffects } from '../components/SeasonalEffects';
import { getContent, useRemote } from '../config/remote';
import { creditNewOrders, hasTokens, loadCustomer } from '../store/auth';
import { reportRoute, startEditorBridge } from '../lib/editorBridge';
import { startNotifications, startUsagePings, syncPush } from '../lib/push';
import { useAuth } from '../store/auth';
import { ToastHost } from '../components/Toast';
import { CartFxHost } from '../components/CartFxHost';
import { prefetchImages } from '../components/ui';
import { Image as ExpoImage } from 'expo-image';
import { useBanners } from '../data/banners';
import { useCatalog } from '../data/catalog';
import { useApp } from '../store/app';
import { useCoins } from '../store/shop';
import { useTheme } from '../theme';
import { startBootGuard } from '../lib/bootGuard';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';

/**
 * If any screen hits an error, show a friendly "try again" screen instead of closing
 * the app. "Go to Home" also marks the intro as seen so the app can always open.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  console.warn('Screen error:', error?.message);
  return (
    <View style={{ flex: 1, backgroundColor: '#FBEBD8', alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }}>
      <Text style={{ fontSize: 44 }}>🫙</Text>
      <Text style={{ fontSize: 20, fontWeight: '600', color: '#3E2415', textAlign: 'center' }}>Oops, something went wrong</Text>
      <Text style={{ fontSize: 14, color: '#7A6453', textAlign: 'center' }}>Don’t worry — your cart and coins are safe.</Text>
      <Pressable
        onPress={() => {
          const wanted = Number(getContent('onboarding')?.reshowVersion) || 1;
          useApp.setState({ onboarded: true, introVersion: wanted } as any);
          retry().catch(() => {});
          setTimeout(() => router.replace('/home'), 50);
        }}
        style={{ marginTop: 8, backgroundColor: '#3E2415', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 }}
      >
        <Text style={{ color: '#FBE6CF', fontSize: 15, fontWeight: '600' }}>Go to Home</Text>
      </Pressable>
      <Pressable onPress={() => retry().catch(() => {})} hitSlop={10}>
        <Text style={{ color: '#A56312', fontSize: 14, fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {});
startBootGuard();
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
    if (!hydrated) return;
    startEditorBridge();
    startNotifications();
    startUsagePings();
    // Keep the backend's phone ↔ customer link fresh (login, logout, membership).
    return useAuth.subscribe((s, prev) => {
      if (s.customer?.id !== prev.customer?.id || s.customer?.tags?.join() !== prev.customer?.tags?.join() || s.customer?.orders.length !== prev.customer?.orders.length) syncPush();
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      // Photos from last time are already cached; fetch fresh data and pre-download photos.
      prefetchImages(useCatalog.getState().products.slice(0, 60).map((p) => p.images[0]));
      useCatalog.getState().refresh().then(() => prefetchImages(useCatalog.getState().products.slice(0, 80).map((p) => p.images[0])));
      useBanners.getState().refresh().then(() => {
        const b = useBanners.getState();
        const urls = [...b.slides, ...b.tiles].map((x) => x.image).filter(Boolean);
        if (urls.length) ExpoImage.prefetch(urls, 'memory-disk').catch(() => {});
      });
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
          <Stack.Screen name="track" options={{ animation: 'fade_from_bottom' }} />
          <Stack.Screen name="page/[handle]" options={{ animation: 'fade_from_bottom' }} />
        </Stack>
        <SeasonalEffects />
        <FlyHost />
        <RemoteGate />
        <ToastHost />
        <CartFxHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
