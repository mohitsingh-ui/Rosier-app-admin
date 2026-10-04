/**
 * Background check for notifications (backup for phones where push can't reach yet,
 * e.g. before Firebase is set up). Android/iOS wake the app roughly every 15+ minutes;
 * it asks the backend for new messages and shows them as normal notifications.
 *
 * Imported from index.js (before the app) so the task exists even when the app is closed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const TASK = 'rosier-notify';
const LAST = 'rosier-push-last';
export const BG_QUEUE = 'rosier-push-bg';

const apiUrl = () => String(process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra as any)?.apiUrl || '').replace(/\/$/, '');

async function deviceId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('rosier-app');
    return raw ? JSON.parse(raw)?.state?.deviceId ?? null : null;
  } catch {
    return null;
  }
}

type Msg = { id: number; title: string; body: string; data: any };

/**
 * Fetches messages not shown yet and shows them. In the background they're also queued
 * so the in-app inbox picks them up next time the app opens.
 */
export async function checkPending(background: boolean): Promise<Msg[]> {
  if (Platform.OS === 'web') return [];
  const dev = await deviceId();
  const api = apiUrl();
  if (!dev || !api) return [];
  const after = Number((await AsyncStorage.getItem(LAST)) || 0);
  let messages: Msg[] = [];
  try {
    const res = await fetch(`${api}/api/push/pending?deviceId=${encodeURIComponent(dev)}&after=${after}`);
    messages = (await res.json())?.messages ?? [];
  } catch {
    return [];
  }
  if (!messages.length) return [];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const N = require('expo-notifications') as typeof import('expo-notifications');
  for (const m of messages) {
    const snd = m.data?.sound && m.data.sound !== 'default' ? String(m.data.sound) : 'default';
    await N.scheduleNotificationAsync({
      content: { title: m.title, body: m.body, data: m.data ?? {}, sound: snd === 'default' ? 'default' : `rosier_${snd}.wav` },
      trigger: Platform.OS === 'android' ? { channelId: snd === 'default' ? 'rosier_default' : `rosier_${snd}` } : null,
    }).catch(() => {});
  }
  await AsyncStorage.setItem(LAST, String(messages[messages.length - 1].id));
  if (background) {
    const q = JSON.parse((await AsyncStorage.getItem(BG_QUEUE)) || '[]');
    await AsyncStorage.setItem(BG_QUEUE, JSON.stringify([...q, ...messages].slice(-30)));
  }
  return messages;
}

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundTask = require('expo-background-task') as typeof import('expo-background-task');
    TaskManager.defineTask(TASK, async () => {
      try {
        await checkPending(true);
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch {
    /* modules missing (Expo Go) */
  }
}

/** Ask the phone to run the check every ~15 minutes. */
export async function scheduleBackgroundCheck() {
  if (Platform.OS === 'web') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundTask = require('expo-background-task') as typeof import('expo-background-task');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
    return true;
  } catch {
    return false;
  }
}
