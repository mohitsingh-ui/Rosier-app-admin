/**
 * Coupon codes in the cart. The code is checked with Shopify against the actual
 * items (a throwaway cart on the backend), so customers see the real saving
 * before checkout. If the shop isn't connected yet, we estimate from the coupon
 * list in the admin panel and Shopify applies the code at checkout.
 */
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Content, getContent, isLive } from '../config/remote';
import { apiPost } from './auth';
import { storage } from './storage';

export type Coupon = Content['coupons']['items'][number];

type CouponState = { code: string | null; apply: (code: string) => void; clear: () => void };
export const useCoupon = create<CouponState>()(
  persist(
    (set) => ({
      code: null,
      apply: (code) => set({ code: code.trim().toUpperCase() || null }),
      clear: () => set({ code: null }),
    }),
    { name: 'rosier-coupon', storage, partialize: ({ code }) => ({ code }) as any },
  ),
);

export type CouponCheck = {
  code: string;
  state: 'checking' | 'ok' | 'invalid';
  /** Rupees off (0 for free shipping / gift codes). */
  saving: number;
  /** True when Shopify confirmed it, false when it's our estimate. */
  confirmed: boolean;
  message: string;
};

/** Coupons from the admin panel that are switched on and inside their dates. */
export function liveCoupons(): Coupon[] {
  const c = getContent('coupons');
  return (c.items ?? []).filter((x) => x?.code && isLive(x));
}

export const findCoupon = (code: string) => (getContent('coupons').items ?? []).find((x) => x?.code && x.code.toLowerCase() === code.toLowerCase());

/** Saving worked out from the admin list (used when Shopify can't be asked). */
export function estimate(c: Coupon | undefined, subtotal: number): { ok: boolean; saving: number; message: string } {
  if (!c) return { ok: true, saving: 0, message: 'Shopify will apply this code at checkout.' };
  if (!isLive(c)) return { ok: false, saving: 0, message: 'This coupon has expired.' };
  const min = Number(c.minOrder) || 0;
  if (min > subtotal) return { ok: false, saving: 0, message: `Add items worth ₹${Math.ceil(min - subtotal)} more to use this coupon.` };
  const v = Number(c.value) || 0;
  if (c.kind === 'percent') {
    const cap = Number(c.maxDiscount) || Infinity;
    return { ok: true, saving: Math.round(Math.min(cap, (subtotal * v) / 100)), message: c.title || `${v}% off` };
  }
  if (c.kind === 'flat') return { ok: true, saving: Math.round(Math.min(v, subtotal)), message: c.title || `₹${v} off` };
  if (c.kind === 'freeship') return { ok: true, saving: 0, message: c.title || 'Free shipping at checkout' };
  return { ok: true, saving: 0, message: c.title || 'Applied at checkout' };
}

/** Why a coupon can't be used yet, for the list (null = can be used). */
export function couponBlocker(c: Coupon, subtotal: number) {
  const min = Number(c.minOrder) || 0;
  return min > subtotal ? `Add ₹${Math.ceil(min - subtotal)} more` : null;
}

/**
 * Checks the applied code whenever it or the cart changes (waits a moment so
 * quick +/- taps don't each hit Shopify).
 */
export function useCouponCheck(code: string | null, lines: { variantId: number; qty: number }[], subtotal: number): CouponCheck | null {
  const [check, setCheck] = useState<CouponCheck | null>(null);
  const key = code ? `${code}|${lines.map((l) => `${l.variantId}:${l.qty}`).join(',')}` : '';
  const seq = useRef(0);
  useEffect(() => {
    if (!code || !lines.length) {
      setCheck(null);
      return;
    }
    const mine = ++seq.current;
    const local = findCoupon(code);
    setCheck((prev) => ({ code, state: 'checking', saving: prev?.code === code ? prev.saving : 0, confirmed: false, message: 'Checking with the store…' }));
    const timer = setTimeout(async () => {
      let next: CouponCheck;
      try {
        const r = await apiPost<{ code: string; applicable: boolean; saving: number }>('/api/checkout/coupon', { code, lines });
        if (!r.applicable) {
          const est = estimate(local, subtotal);
          next = { code, state: 'invalid', saving: 0, confirmed: true, message: !est.ok ? est.message : 'This code isn’t valid for the items in your cart.' };
        } else {
          const kindNote = local?.kind === 'freeship' ? 'Free shipping applied at checkout' : r.saving > 0 ? `You save ₹${r.saving}` : local?.title || 'Applied — shown at checkout';
          next = { code: r.code || code, state: 'ok', saving: r.saving, confirmed: true, message: kindNote };
        }
      } catch (e: any) {
        if (e?.status === 429) next = { code, state: 'invalid', saving: 0, confirmed: false, message: e.message };
        else {
          // Shop not connected / offline: estimate from the admin list.
          const est = estimate(local, subtotal);
          next = { code, state: est.ok ? 'ok' : 'invalid', saving: est.saving, confirmed: false, message: est.message };
        }
      }
      if (mine === seq.current) setCheck(next);
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, subtotal]);
  return check;
}
