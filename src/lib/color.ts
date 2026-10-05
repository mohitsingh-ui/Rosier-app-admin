/**
 * Colours typed in the admin panel can have typos ("#F1DCC", "brwn"). A bad colour
 * inside an animation crashes the app on phones, so every admin colour used in
 * animations goes through here first.
 */
import { processColor } from 'react-native';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(rgba?|hsla?)\(\s*[\d.%\s,/-]+\)$/i;

export function isColor(c: unknown): c is string {
  if (typeof c !== 'string') return false;
  const s = c.trim();
  if (!s) return false;
  if (HEX.test(s) || FUNC.test(s)) return true;
  // Named colours (e.g. "white", "tomato") — let React Native decide.
  if (/^[a-z]+$/i.test(s)) {
    try {
      const v = processColor(s.toLowerCase());
      return v != null;
    } catch {
      return false;
    }
  }
  return false;
}

/** The colour if it's valid, otherwise the fallback. */
export const safeColor = (c: unknown, fallback: string): string => (isColor(c) ? String(c).trim() : fallback);
