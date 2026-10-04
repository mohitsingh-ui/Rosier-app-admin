import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../store/storage';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const snapshot: Product[] = require('./catalog.json');
import type { CategoryId, Product, Variant } from './types';
import { Platform } from 'react-native';
import { API_URL, getContent, useContent } from '../config/remote';

export const STORE_URL = 'https://www.rosierfoods.com';

/** Browsers can't read rosierfoods.com directly (CORS), so the web preview goes through our backend. */
export const storeFetchUrl = (path: string) =>
  Platform.OS === 'web' && API_URL ? `${API_URL}/api/store${path === '/' ? '/home' : path}` : `${STORE_URL}${path}`;

export type Category = { id: CategoryId; label: string; icon: string; image: string; blurb: string; tint: string; enabled: boolean };

/** Shop categories, as set in the admin panel (Categories). */
export function useCategories(): Category[] {
  const items = useContent('categories').items as Category[];
  return useMemo(() => items.filter((c) => c.enabled !== false && c.id), [items]);
}
export const getCategories = () => (getContent('categories').items as Category[]).filter((c) => c.enabled !== false && c.id);

const TYPE_TO_CAT: Record<string, CategoryId> = {
  Ghee: 'ghee',
  Flour: 'atta',
  Oil: 'oils',
  Oats: 'breakfast',
  'Bars/Nutbutters': 'breakfast',
  Pickle: 'pickles',
  Honey: 'immunity',
  Amlaprash: 'immunity',
  Combo: 'combos',
};

type CatalogState = {
  products: Product[];
  /** Products added from a website page (e.g. Gift Hampers) — kept even if not in the app's list. */
  pinned?: string[];
  updatedAt: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const clean = (html: string) =>
  (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Shopify variant → app variant. Store offers live in `badge_… X% OFF` tags. */
function mapVariants(raw: any): Variant[] {
  let tagDiscount = 0;
  for (const t of raw.tags as string[]) {
    const m = t.startsWith('badge_') && t.match(/(\d+)% OFF/);
    if (m) tagDiscount = Number(m[1]);
  }
  return (raw.variants as any[])
    .map((v) => {
      const price = Number(v.price);
      const cmp = Number(v.compare_at_price || 0);
      if (cmp > price) {
        return { id: v.id, title: v.title, price, mrp: cmp, discount: Math.round(((cmp - price) / cmp) * 100), available: v.available };
      }
      return {
        id: v.id,
        title: String(v.title).replace(/ /g, ' '),
        price: Math.round(price * (1 - tagDiscount / 100)),
        mrp: price,
        discount: tagDiscount,
        available: v.available,
      };
    })
    .filter((v) => v.mrp > 0);
}

const DUPLICATE = /-(rosiervip|nitro17|copy|\d+)$/;

export const useCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      products: snapshot,
      updatedAt: 0,
      loading: false,
      refresh: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          const res = await fetch(storeFetchUrl('/products.json?limit=250'));
          const json = await res.json();
          let raw: any[] = json.products ?? [];
          // Admin panel → Products in the app: extra Shopify products (not on the website) and hidden ones.
          let rules: { mode: 'website' | 'pick'; show: string[]; hide: string[]; extra: any[] } | null = null;
          try {
            if (API_URL) rules = await (await fetch(`${API_URL}/api/store/app-products`)).json();
          } catch {
            rules = null;
          }
          const extraHandles = new Set<string>((rules?.extra ?? []).map((p: any) => p.handle));
          if (rules?.extra?.length) raw = [...raw.filter((p) => !extraHandles.has(p.handle)), ...rules.extra];
          const byHandle = new Map(raw.map((p) => [p.handle, p]));
          const known = new Set<string>();
          // Start from what we have plus the built-in list (so products hidden earlier can come back).
          const current = get().products;
          const have = new Set(current.map((p) => p.handle));
          const base = [...current, ...snapshot.filter((p) => !have.has(p.handle))];
          const merged: Product[] = base.map((p) => {
            known.add(p.handle);
            const r = byHandle.get(p.handle);
            if (!r) return p;
            const variants = mapVariants(r);
            return {
              ...p,
              title: r.title?.trim() || p.title,
              variants: variants.length ? variants : p.variants,
              images: r.images?.length ? r.images.slice(0, 6).map((i: any) => i.src) : p.images,
            };
          });
          // Pick up brand-new launches automatically.
          const seenTitles = new Set(merged.map((p) => p.title.toLowerCase()));
          for (const r of raw) {
            const picked = extraHandles.has(r.handle);
            const cat = TYPE_TO_CAT[r.product_type] ?? (picked ? 'other' : undefined);
            if (!cat || known.has(r.handle)) continue;
            if (!picked) {
              if (DUPLICATE.test(r.handle)) continue;
              if ((r.tags as string[]).some((t) => /no-recommend|nitro17/i.test(t))) continue;
              if (seenTitles.has(String(r.title).toLowerCase())) continue;
            }
            const variants = mapVariants(r);
            if (!variants.length) continue;
            const body = clean(r.body_html);
            seenTitles.add(String(r.title).toLowerCase());
            merged.unshift({
              handle: r.handle,
              title: r.title,
              category: cat,
              type: r.product_type,
              badge: (r.tags as string[]).find((t) => t.startsWith('tag__'))?.split('_').slice(3).join('_') ?? '🎉 New',
              rating: 4.8,
              short: body.split(/(?<=[.!])\s/).slice(0, 2).join(' ').slice(0, 220),
              description: body.slice(0, 1200),
              variants,
              images: r.images.slice(0, 6).map((i: any) => i.src),
              tags: [],
            });
          }
          let final = merged;
          if (rules?.mode === 'pick') {
            const keep = new Set([...(rules.show ?? []), getContent('benefits').membershipHandle || 'membership']);
            for (const h of get().pinned ?? []) keep.add(h);
            final = merged.filter((p) => keep.has(p.handle));
          } else if (rules?.hide?.length) {
            const hide = new Set(rules.hide);
            final = merged.filter((p) => !hide.has(p.handle));
          }
          set({ products: final, updatedAt: Date.now() });
        } catch {
          // Offline or blocked — keep the cached catalogue.
        } finally {
          set({ loading: false });
        }
      },
    }),
    { name: 'rosier-catalog', storage, partialize: ({ products, updatedAt, pinned }) => ({ products, updatedAt, pinned }) },
  ),
);

/** Turns a website product (/products/<handle>.js shape) into an app product. */
export function productFromWeb(r: any): Product | null {
  const variants = mapVariants(r);
  if (!variants.length) return null;
  const body = clean(r.body_html);
  return {
    handle: r.handle,
    title: r.title,
    category: TYPE_TO_CAT[r.product_type] ?? 'combos',
    type: r.product_type,
    badge: '🎁 Gift',
    rating: 4.8,
    short: body.split(/(?<=[.!])\s/).slice(0, 2).join(' ').slice(0, 220),
    description: body.slice(0, 1200),
    variants,
    images: (r.images ?? []).slice(0, 6).map((i: any) => i.src),
    tags: [],
  } as Product;
}

/** Makes sure a website product is in the app catalogue (so it can go in the cart). */
export async function ensureProduct(handle: string, load: (h: string) => Promise<any>): Promise<Product | null> {
  const have = useCatalog.getState().products.find((p) => p.handle === handle);
  if (have) return have;
  const p = productFromWeb(await load(handle));
  if (!p) return null;
  useCatalog.setState((s) => ({ products: [...s.products.filter((x) => x.handle !== p.handle), p], pinned: [...new Set([...(s.pinned ?? []), p.handle])] }));
  return p;
}

type Override = { handle: string; hidden?: boolean; title?: string; badge?: string; category?: string; rating?: number; image?: string };

/** Apply the admin panel's product changes (hide, rename, badge, category, rating, photo). */
export function applyOverrides(products: Product[], overrides: Override[]): Product[] {
  if (!overrides?.length) return products;
  const byHandle = new Map(overrides.filter((o) => o?.handle).map((o) => [o.handle, o]));
  const out: Product[] = [];
  for (const p of products) {
    const o = byHandle.get(p.handle);
    if (!o) {
      out.push(p);
      continue;
    }
    if (o.hidden) continue;
    out.push({
      ...p,
      title: o.title?.trim() || p.title,
      badge: o.badge?.trim() ? o.badge.trim() : p.badge,
      category: o.category?.trim() || p.category,
      rating: Number(o.rating) > 0 ? Number(o.rating) : p.rating,
      images: o.image?.trim() ? [o.image.trim(), ...p.images.filter((i) => i !== o.image)] : p.images,
    });
  }
  return out;
}

export const useProducts = () => {
  const products = useCatalog((s) => s.products);
  const overrides = useContent('products').overrides as Override[];
  return useMemo(() => applyOverrides(products, overrides), [products, overrides]);
};

/** Turns an image value from the admin panel into a URL: "product:<handle>" means that product's first photo. */
export function resolveImage(value?: string | null): string | undefined {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  if (v.startsWith('product:')) {
    const handle = v.slice(8);
    const p = useCatalog.getState().products.find((x) => x.handle === handle);
    return p?.images[0];
  }
  return v;
}

export function findProduct(products: Product[], handle: string) {
  return products.find((p) => p.handle === handle);
}

export function findVariant(products: Product[], variantId: number) {
  for (const p of products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  return undefined;
}

export const defaultVariant = (p: Product) => p.variants.find((v) => v.available) ?? p.variants[0];

export const shopProducts = (products: Product[]) => products.filter((p) => p.category !== 'membership');
