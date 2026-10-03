import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from './storage';
import { COINS, Voucher } from '../config/coins';

/* ───────────────────────── Cart ───────────────────────── */

export type CartItem = { variantId: number; handle: string; qty: number; selected: boolean };

type CartState = {
  items: CartItem[];
  add: (handle: string, variantId: number, qty?: number) => void;
  setQty: (variantId: number, qty: number) => void;
  remove: (variantId: number) => void;
  toggle: (variantId: number) => void;
  removeSelected: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (handle, variantId, qty = 1) =>
        set((s) => {
          const found = s.items.find((i) => i.variantId === variantId);
          if (found) {
            return { items: s.items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(i.qty + qty, 20), selected: true } : i)) };
          }
          return { items: [{ variantId, handle, qty, selected: true }, ...s.items] };
        }),
      setQty: (variantId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(0, Math.min(qty, 20)) } : i))
            .filter((i) => i.qty > 0),
        })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      toggle: (variantId) =>
        set((s) => ({ items: s.items.map((i) => (i.variantId === variantId ? { ...i, selected: !i.selected } : i)) })),
      removeSelected: () => set((s) => ({ items: s.items.filter((i) => !i.selected) })),
    }),
    { name: 'rosier-cart', storage },
  ),
);

export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));

/* ───────────────────────── Coins ───────────────────────── */

export type CoinEntry = {
  id: string;
  kind: 'earn' | 'redeem' | 'bonus' | 'refund' | 'pending';
  amount: number;
  label: string;
  time: number;
  releaseAt?: number;
  orderId?: string;
};

type CoinState = {
  balance: number;
  lifetime: number;
  history: CoinEntry[];
  voucherId: Voucher['id'] | null;
  initialised: boolean;
  init: () => void;
  unlockVoucher: (v: Voucher) => boolean;
  releaseVoucher: () => void;
  consumeVoucher: () => void;
  addPending: (amount: number, orderId: string) => void;
  releasePending: (force?: boolean) => number;
  addBonus: (amount: number, label: string) => void;
};

const DAY = 24 * 60 * 60 * 1000;

export const useCoins = create<CoinState>()(
  persist(
    (set, get) => ({
      balance: 0,
      lifetime: 0,
      history: [],
      voucherId: null,
      initialised: false,
      init: () => {
        if (get().initialised) return;
        set({
          initialised: true,
          balance: COINS.welcomeBonus,
          lifetime: COINS.welcomeBonus,
          history: [{ id: 'welcome', kind: 'bonus', amount: COINS.welcomeBonus, label: 'Welcome to the Rosier family', time: Date.now() }],
        });
      },
      unlockVoucher: (v) => {
        const s = get();
        if (s.balance < v.cost) return false;
        const refund = s.voucherId ? COINS.vouchers.find((x) => x.id === s.voucherId) : undefined;
        const history: CoinEntry[] = [
          { id: `r${Date.now()}`, kind: 'redeem', amount: -v.cost, label: `Unlocked ₹${v.value} OFF voucher`, time: Date.now() },
        ];
        let balance = s.balance - v.cost;
        if (refund) {
          balance += refund.cost;
          history.push({ id: `f${Date.now()}`, kind: 'refund', amount: refund.cost, label: `Swapped out ₹${refund.value} OFF voucher`, time: Date.now() });
        }
        set({ balance, voucherId: v.id, history: [...history, ...s.history] });
        return true;
      },
      releaseVoucher: () => {
        const s = get();
        const v = COINS.vouchers.find((x) => x.id === s.voucherId);
        if (!v) return;
        set({
          voucherId: null,
          balance: s.balance + v.cost,
          history: [{ id: `f${Date.now()}`, kind: 'refund', amount: v.cost, label: `Returned ₹${v.value} OFF voucher`, time: Date.now() }, ...s.history],
        });
      },
      consumeVoucher: () => set({ voucherId: null }),
      addPending: (amount, orderId) =>
        set((s) => ({
          history: [
            { id: `p${Date.now()}`, kind: 'pending', amount, label: `Order #${orderId}`, time: Date.now(), releaseAt: Date.now() + COINS.pendingDays * DAY, orderId },
            ...s.history,
          ],
        })),
      releasePending: (force = false) => {
        const s = get();
        let released = 0;
        const history = s.history.map((h) => {
          if (h.kind === 'pending' && (force || (h.releaseAt ?? 0) <= Date.now())) {
            released += h.amount;
            return { ...h, kind: 'earn' as const, label: `${h.label} · coins credited` };
          }
          return h;
        });
        if (released) set({ history, balance: s.balance + released, lifetime: s.lifetime + released });
        return released;
      },
      addBonus: (amount, label) =>
        set((s) => ({
          balance: s.balance + amount,
          lifetime: s.lifetime + amount,
          history: [{ id: `b${Date.now()}`, kind: 'bonus', amount, label, time: Date.now() }, ...s.history],
        })),
    }),
    { name: 'rosier-coins', storage },
  ),
);

export const usePendingCoins = () =>
  useCoins((s) => s.history.filter((h) => h.kind === 'pending').reduce((n, h) => n + h.amount, 0));

/* ───────────────────────── Wishlist ───────────────────────── */

type WishState = { handles: string[]; toggle: (h: string) => void };
export const useWishlist = create<WishState>()(
  persist(
    (set) => ({
      handles: [],
      toggle: (h) => set((s) => ({ handles: s.handles.includes(h) ? s.handles.filter((x) => x !== h) : [h, ...s.handles] })),
    }),
    { name: 'rosier-wishlist', storage },
  ),
);

/* ───────────────────────── Orders ───────────────────────── */

export type Order = {
  id: string;
  time: number;
  items: { handle: string; title: string; variant: string; qty: number; price: number; image: string }[];
  subtotal: number;
  voucher: number;
  total: number;
  coins: number;
  status: 'Placed' | 'Shipped' | 'Delivered';
};

type OrderState = { orders: Order[]; addOrder: (o: Order) => void };
export const useOrders = create<OrderState>()(
  persist((set) => ({ orders: [], addOrder: (o) => set((s) => ({ orders: [o, ...s.orders] })) }), {
    name: 'rosier-orders',
    storage,
  }),
);
