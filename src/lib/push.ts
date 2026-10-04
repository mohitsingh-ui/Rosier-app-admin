/**
 * Phone notifications + app usage pings.
 *
 * - Asks for permission (after our own friendly card), gets an Expo push token and
 *   registers it with the backend together with the logged-in Shopify customer.
 * - Shows notifications while the app is open too, adds them to the in-app inbox,
 *   and opens the right screen when one is tapped.
 * - Pings the backend on open and every minute in front (sessions + "live in app").
 *
 * Push needs a real build (not Expo Go) with Firebase set up for Android — see README.
 */
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { API_URL, IN_EDITOR, getContent } from '../config/remote';
import { membershipOf } from './membership';
import { openLink } from './links';
import { useApp } from '../store/app';
import { loadCustomer, useAuth } from '../store/auth';

type N = typeof import('expo-notifications');
let N: N | null = null;
function notifications(): N | null {
  if (Platform.OS === 'web') return null;
  if (N) return N;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    N = require('expo-notifications') as N;
  } catch {
    N = null;
  }
  return N;
}

const SOUNDS = ['chime', 'bell', 'coin', 'soft'];
let token: string | null = null;

const post = (path: string, body: object) =>
  fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);

/** Android: one channel per sound (a channel's sound can't change later). */
async function makeChannels(n: N) {
  if (Platform.OS !== 'android') return;
  const common = { importance: n.AndroidImportance.HIGH, vibrationPattern: [0, 200, 120, 200], lightColor: '#A56312' };
  await n.setNotificationChannelAsync('rosier_default', { name: 'Orders & offers', ...common }).catch(() => {});
  for (const s of SOUNDS) await n.setNotificationChannelAsync(`rosier_${s}`, { name: `Orders & offers (${s})`, sound: `rosier_${s}.wav`, ...common }).catch(() => {});
}

function handleTap(data: any) {
  if (data?.kind === 'order') loadCustomer();
  if (data?.link) setTimeout(() => openLink(String(data.link)), 300);
}

function toInbox(content: { title?: string | null; body?: string | null; data?: any }) {
  const id = content.data?.id ? `p-${content.data.id}` : undefined;
  if (id && useApp.getState().notifications.some((x) => x.id === id)) return;
  useApp.getState().pushNotification(content.title || 'Rosier', content.body || '', { id, link: content.data?.link });
}

let started = false;
/** Call once at startup. */
export async function startNotifications() {
  if (started || IN_EDITOR) return;
  started = true;
  const n = notifications();
  if (!n) return;
  n.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  await makeChannels(n);
  n.addNotificationReceivedListener((e) => {
    const c = e.request.content;
    toInbox(c);
    if ((c.data as any)?.kind === 'order') loadCustomer();
  });
  n.addNotificationResponseReceivedListener((r) => {
    toInbox(r.notification.request.content);
    handleTap(r.notification.request.content.data);
  });
  // Opened from a notification while the app was closed.
  const last = await n.getLastNotificationResponseAsync().catch(() => null);
  if (last) {
    toInbox(last.notification.request.content);
    handleTap(last.notification.request.content.data);
  }
  const perm = await n.getPermissionsAsync().catch(() => null);
  if (perm?.granted) await registerPush(false);
}

export async function pushStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  const n = notifications();
  if (!n) return 'unsupported';
  const p = await n.getPermissionsAsync().catch(() => null);
  if (!p) return 'unsupported';
  return p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'undetermined';
}

/** Asks (if `ask`) and registers this phone. Returns true when notifications are on. */
export async function registerPush(ask = true): Promise<boolean> {
  const n = notifications();
  if (!n) return false;
  try {
    let p = await n.getPermissionsAsync();
    if (!p.granted && ask && p.canAskAgain !== false) p = await n.requestPermissionsAsync();
    if (!p.granted) return false;
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) {
      console.warn('Push: no EAS projectId in app.json (run `npx eas-cli init` once).');
      return false;
    }
    token = (await n.getExpoPushTokenAsync({ projectId })).data;
    await syncPush();
    return true;
  } catch (e) {
    console.warn('Push registration failed', e);
    return false;
  }
}

/** Tells the backend who this phone belongs to (after login / logout / joining membership). */
export async function syncPush() {
  if (!token) return;
  const app = useApp.getState();
  const c = useAuth.getState().customer;
  await post('/api/push/register', {
    token,
    deviceId: app.deviceId,
    platform: Platform.OS,
    customerId: c?.id ?? null,
    email: c?.email || app.email || null,
    phone: c?.phone || app.phone || null,
    name: c?.firstName || app.name || null,
    member: c ? membershipOf(c, getContent('benefits')).active : false,
  });
}

/* ───────── Usage pings (sessions + live visitors) ───────── */

let pingTimer: ReturnType<typeof setInterval> | null = null;
function ping() {
  const app = useApp.getState();
  if (!app.deviceId || IN_EDITOR) return;
  post('/api/app/ping', { deviceId: app.deviceId, platform: Platform.OS, customerId: useAuth.getState().customer?.id ?? null });
}

export function startUsagePings() {
  if (pingTimer || IN_EDITOR) return;
  ping();
  pingTimer = setInterval(() => AppState.currentState === 'active' && ping(), 60_000);
  AppState.addEventListener('change', (s) => s === 'active' && ping());
}
