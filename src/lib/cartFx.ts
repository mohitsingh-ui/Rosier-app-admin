/**
 * What happens when something goes into the cart — all set in the admin panel →
 * "Add to cart animations": the message (text, look, animation) and any number of
 * effects at once (fly to cart, cart bounce, sparkles, confetti, hearts, coins,
 * petals, your own emoji, a big tick).
 */
import type { View } from 'react-native';
import { create } from 'zustand';
import { flyFrom, useFly } from '../components/FlyToCart';
import { toast } from '../components/Toast';
import { getContent } from '../config/remote';
import { success } from './haptics';

export type Burst = { id: number; types: string[]; emoji: string; amount: number; seconds: number; tick: boolean };
export const useCartFx = create<{ burst: Burst | null }>(() => ({ burst: null }));

const cfg = () => (getContent('cartFx') ?? {}) as any;

/** Call whenever an item is added to the cart. */
export function cartAdded({ ref, image, coins, title, message }: { ref?: React.RefObject<View | null>; image?: string; coins?: number; title?: string; message?: string }) {
  const c = cfg();
  if (c.fly !== false && ref && image) flyFrom(ref, image);
  else if (c.cartBounce !== false) useFly.setState((s) => ({ bump: s.bump + 1 }));
  if (c.haptic !== false) success();

  const types = ['confetti', 'sparkles', 'hearts', 'coins', 'petals'].filter((k) => c[k]);
  const emoji = String(c.emoji || '').trim();
  if (types.length || emoji || c.bigTick) {
    useCartFx.setState({
      burst: {
        id: Date.now(),
        types,
        emoji,
        amount: Math.min(80, Math.max(6, Number(c.burstAmount) || 26)),
        seconds: Math.min(5, Math.max(0.6, Number(c.burstSeconds) || 1.6)),
        tick: !!c.bigTick,
      },
    });
  }

  if (c.toastEnabled === false) return;
  const text =
    message ??
    String(c.toastText || 'Added to cart')
      .replaceAll('{coins}', String(coins ?? 0))
      .replaceAll('{product}', title || 'Item');
  toast(text, c.toastIcon === 'coin' ? 'coin' : 'ok');
}
