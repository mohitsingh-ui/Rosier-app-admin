/**
 * Live preview inside the admin panel (web only).
 *
 * The admin panel shows this app in an iframe and sends it the *draft* content on
 * every keystroke, so editors see changes instantly without publishing.
 *   panel → app: { type: 'rosier:content', content }   replace all content
 *                { type: 'rosier:navigate', path }     open a screen
 *                { type: 'rosier:mode', mode }         light / dark
 *   app → panel: { type: 'rosier:ready' }, { type: 'rosier:route', path }
 */
import { router } from 'expo-router';
import { create } from 'zustand';
import { startEditOverlay } from './editOverlay';
import { applyCoins } from '../config/coins';
import { build, IN_EDITOR, useRemote } from '../config/remote';
import { useApp } from '../store/app';
import { useTryEffect } from '../components/SeasonalEffects';

let started = false;
let overlay: ReturnType<typeof startEditOverlay> | null = null;

/** Bumped to replay a section's entrance animation from the editor. */
export const useReplay = create<{ n: Record<string, number> }>(() => ({ n: {} }));

export function startEditorBridge() {
  if (!IN_EDITOR || started) return;
  started = true;
  try {
    window.sessionStorage?.setItem('rosier-editor', '?editor=1');
  } catch {
    /* private mode */
  }
  // Skip the intro slides when previewing other screens.
  useApp.setState({ onboarded: true });

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== window.location.origin || !e.data || typeof e.data !== 'object') return;
    const msg = e.data as { type: string; content?: any; path?: string; mode?: 'light' | 'dark'; on?: boolean; id?: string; effect?: any };
    if (msg.type === 'rosier:content' && msg.content) {
      const content = build(msg.content);
      applyCoins(content.coins);
      useRemote.setState({ content });
    } else if (msg.type === 'rosier:navigate' && msg.path) {
      try {
        router.replace(msg.path as any);
      } catch {
        /* unknown route */
      }
    } else if (msg.type === 'rosier:mode' && msg.mode) {
      useApp.getState().setThemePref(msg.mode);
    } else if (msg.type === 'rosier:editMode') {
      overlay?.setEditing(!!msg.on);
    } else if (msg.type === 'rosier:highlight') {
      overlay?.select(msg.id ?? null);
    } else if (msg.type === 'rosier:tryEffect') {
      useTryEffect.setState((s) => ({ effect: msg.effect ?? null, n: s.n + 1 }));
    } else if (msg.type === 'rosier:tryCartFx') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./cartFx').cartAdded({ coins: 29, title: 'Gir Cow A2 Ghee' });
    } else if (msg.type === 'rosier:replay' && msg.id) {
      useReplay.setState((s) => ({ n: { ...s.n, [msg.id!]: (s.n[msg.id!] ?? 0) + 1 } }));
    }
  });
  overlay = startEditOverlay((m) => window.parent.postMessage(m, window.location.origin));
  window.parent.postMessage({ type: 'rosier:ready' }, window.location.origin);
}

export function reportRoute(path: string) {
  if (IN_EDITOR) window.parent.postMessage({ type: 'rosier:route', path }, window.location.origin);
}
