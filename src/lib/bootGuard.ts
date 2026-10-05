/**
 * Crash guard. If the app closes by itself within a few seconds of opening (a crash),
 * the next open starts in "safe mode": the intro slides are skipped and the heavy
 * animations stay off, so the app always opens again. Safe mode clears itself once
 * the app has run normally.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

const KEY = 'rosier-boot';
const STABLE_AFTER = 12_000;

export const useBoot = create<{ ready: boolean; safe: boolean }>(() => ({ ready: Platform.OS === 'web', safe: false }));

let started = false;
export async function startBootGuard() {
  if (started || Platform.OS === 'web') return;
  started = true;
  let safe = false;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const prev = raw ? JSON.parse(raw) : null;
    // Last open never reached "stable" → it crashed.
    safe = !!prev && prev.stable === false && Date.now() - Number(prev.at || 0) < 24 * 3600 * 1000;
    await AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), stable: false, safe }));
  } catch {
    /* storage unavailable */
  }
  useBoot.setState({ ready: true, safe });
  setTimeout(() => {
    AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), stable: true })).catch(() => {});
  }, STABLE_AFTER);
}

/** Call when something finished normally (e.g. the intro), so a crash later doesn't count. */
export function markStable() {
  if (Platform.OS === 'web') return;
  AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), stable: true })).catch(() => {});
}
