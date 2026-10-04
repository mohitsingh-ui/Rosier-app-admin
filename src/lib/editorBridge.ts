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
import { applyCoins } from '../config/coins';
import { build, IN_EDITOR, useRemote } from '../config/remote';
import { useApp } from '../store/app';

let started = false;

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
    const msg = e.data as { type: string; content?: any; path?: string; mode?: 'light' | 'dark' };
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
    }
  });
  window.parent.postMessage({ type: 'rosier:ready' }, window.location.origin);
}

export function reportRoute(path: string) {
  if (IN_EDITOR) window.parent.postMessage({ type: 'rosier:route', path }, window.location.origin);
}
