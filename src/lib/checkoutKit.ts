/**
 * Shopify Checkout Kit — Shopify's official in-app checkout. Checkout and payment
 * (cards, UPI, wallets, COD…) happen in a sheet inside the app, not in a browser.
 *
 * Only available in real app builds. In Expo Go and the web preview there's no
 * native module, so callers fall back to the in-app browser.
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

type Outcome = { completed: boolean; orderId?: string; total?: number };
type Kit = {
  present: (url: string) => void;
  preload: (url: string) => void;
  addEventListener: (event: string, cb: (e: any) => void) => { remove: () => void } | undefined;
};

let kit: Kit | null | undefined;

function getKit(): Kit | null {
  if (kit !== undefined) return kit;
  kit = null;
  if (Platform.OS === 'web') return kit;
  const native = TurboModuleRegistry.get('ShopifyCheckoutSheetKit') ?? NativeModules.ShopifyCheckoutSheetKit;
  if (!native) return kit;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ShopifyCheckoutSheet, ColorScheme } = require('@shopify/checkout-sheet-kit');
    kit = new ShopifyCheckoutSheet({
      colorScheme: ColorScheme.light,
      title: 'Checkout',
      colors: {
        ios: { tintColor: '#A56312', backgroundColor: '#FFFBF5' },
        android: { progressIndicator: '#A56312', backgroundColor: '#FFFBF5', headerBackgroundColor: '#3E2415', headerTextColor: '#FBE6CF', closeButtonColor: '#FBE6CF' },
      },
    }) as Kit;
  } catch {
    kit = null;
  }
  return kit;
}

export const checkoutKitAvailable = () => !!getKit();

/** Start loading checkout in the background (e.g. when the cart opens) so it appears instantly. */
export function preloadCheckout(url: string) {
  try {
    getKit()?.preload(url);
  } catch {
    /* ignore */
  }
}

/**
 * Shows checkout inside the app and resolves when the customer closes it
 * or finishes paying.
 */
export function presentCheckout(url: string): Promise<Outcome> {
  const k = getKit();
  if (!k) return Promise.reject(new Error('Checkout Kit not available'));
  return new Promise((resolve) => {
    let done = false;
    const subs: ({ remove: () => void } | undefined)[] = [];
    const finish = (o: Outcome) => {
      if (done) return;
      done = true;
      subs.forEach((s) => s?.remove());
      resolve(o);
    };
    let completed: Outcome | null = null;
    subs.push(
      k.addEventListener('completed', (e: any) => {
        const total = Number(e?.orderDetails?.cart?.price?.total?.amount ?? 0);
        completed = { completed: true, orderId: e?.orderDetails?.id, total: Number.isFinite(total) ? total : undefined };
        // iOS closes the sheet itself after the thank-you page; Android waits for the customer.
        setTimeout(() => finish(completed!), 1500);
      }),
    );
    subs.push(k.addEventListener('close', () => finish(completed ?? { completed: false })));
    subs.push(k.addEventListener('error', () => finish(completed ?? { completed: false })));
    k.present(url);
  });
}
