import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { COINS, coinsForAmount } from '../config/coins';
import { findVariant, STORE_URL, useProducts } from '../data/catalog';
import { CartItem, useCart, useCoins } from '../store/shop';
import type { Product, Variant } from '../data/types';

export type CartLine = CartItem & { product: Product; variant: Variant };


/** Everything the cart screen and checkout need, derived from stores. */
export function useCartSummary() {
  const items = useCart((s) => s.items);
  const products = useProducts();
  const voucherId = useCoins((s) => s.voucherId);

  return useMemo(() => {
    const lines = items
      .map((i) => {
        const hit = findVariant(products, i.variantId);
        return hit ? { ...i, product: hit.product, variant: hit.variant } : null;
      })
      .filter(Boolean) as CartLine[];
    const selected = lines.filter((l) => l.selected && l.variant.available);
    const mrp = selected.reduce((n, l) => n + l.variant.mrp * l.qty, 0);
    const subtotal = selected.reduce((n, l) => n + l.variant.price * l.qty, 0);
    const voucher = COINS.vouchers.find((v) => v.id === voucherId) ?? null;
    const voucherOk = !!voucher && subtotal >= COINS.minCartForVoucher;
    const voucherValue = voucherOk ? Math.min(voucher!.value, subtotal) : 0;
    // Shipping is calculated by Shopify at checkout.
    const total = Math.max(0, subtotal - voucherValue);
    const coins = coinsForAmount(subtotal - voucherValue);
    const count = selected.reduce((n, l) => n + l.qty, 0);
    return { lines, selected, mrp, subtotal, savings: mrp - subtotal, voucher, voucherOk, voucherValue, total, coins, count };
  }, [items, products, voucherId]);
}

/**
 * Opens Shopify checkout with the selected lines already in the cart.
 * Uses Shopify's cart permalink: /cart/{variant}:{qty},…?discount=CODE
 */
export async function openCheckout(lines: { variantId: number; qty: number }[], discountCode?: string) {
  const path = lines.map((l) => `${l.variantId}:${l.qty}`).join(',');
  const params = new URLSearchParams({ utm_source: 'rosier_app', utm_medium: 'app' });
  if (discountCode) params.set('discount', discountCode);
  const url = `${STORE_URL}/cart/${path}?${params.toString()}`;
  return WebBrowser.openBrowserAsync(url, {
    toolbarColor: '#3E2415',
    controlsColor: '#F3D48B',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}

export const openStorePage = (path: string) =>
  WebBrowser.openBrowserAsync(`${STORE_URL}${path}`, { toolbarColor: '#3E2415', controlsColor: '#F3D48B' });
