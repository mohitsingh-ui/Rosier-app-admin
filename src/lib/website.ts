/**
 * Content the app shows exactly as on rosierfoods.com — read through our backend
 * (A+ banners, product tabs, Judge.me reviews, category banners). Kept in memory
 * and on the phone so pages open instantly the second time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { API_URL } from '../config/remote';

export type ProductExtras = { handle: string; aplus: { image: string; ratio: number }[]; tabs: { title: string; body: string }[]; productId: string | null; rating: number; reviewCount: number };
export type Review = { id: string; rating: number; title: string; body: string; name: string; initial: string; verified: boolean; at: string; variant: string; photos: { small: string; large: string }[]; reply: string };
export type ReviewPage = { average: number; count: number; histogram: { rating: number; count: number; percent: number }[]; summary: string; page: number; pages: number; reviews: Review[] };
export type CollectionBanner = { image: string; ratio: number; link: string } | null;

const mem = new Map<string, any>();

async function getJson<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as T;
  mem.set(key, json);
  AsyncStorage.setItem(`web:${key}`, JSON.stringify(json)).catch(() => {});
  return json;
}

/** Shows the last saved copy at once, then refreshes from the network. */
function useCached<T>(key: string | null, path: string | null): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(key ? mem.get(key) ?? null : null);
  const [loading, setLoading] = useState(!data);
  useEffect(() => {
    if (!key || !path) return;
    let alive = true;
    if (!mem.has(key))
      AsyncStorage.getItem(`web:${key}`)
        .then((s) => alive && s && !mem.has(key) && setData(JSON.parse(s)))
        .catch(() => {});
    getJson<T>(path, key)
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key, path]);
  return { data, loading };
}

export const useProductExtras = (handle?: string | null) =>
  useCached<ProductExtras>(handle ? `px:${handle}` : null, handle ? `/api/store/product-extras/${encodeURIComponent(handle)}` : null);

export const useCollectionBanner = (collection?: string | null) =>
  useCached<{ banner: CollectionBanner }>(collection ? `cb:${collection}` : null, collection ? `/api/store/collection-banner/${encodeURIComponent(collection)}` : null);

/** Reviews with "load more". */
export function useReviews(productId: string | null | undefined, perPage = 5) {
  const first = useCached<ReviewPage>(productId ? `rv:${productId}:1:${perPage}` : null, productId ? `/api/store/reviews/${productId}?page=1&per=${perPage}` : null);
  const [more, setMore] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setMore([]);
    setPage(1);
  }, [productId]);
  const loadMore = async () => {
    if (!productId || busy) return;
    setBusy(true);
    try {
      const next = page + 1;
      const r = await getJson<ReviewPage>(`/api/store/reviews/${productId}?page=${next}&per=${perPage}`, `rv:${productId}:${next}:${perPage}`);
      setMore((m) => [...m, ...r.reviews]);
      setPage(next);
    } finally {
      setBusy(false);
    }
  };
  const d = first.data;
  return { data: d, reviews: d ? [...d.reviews, ...more] : [], loading: first.loading, busy, canLoadMore: !!d && page < d.pages, loadMore };
}

export async function submitReview(input: { productId: string; name: string; email: string; rating: number; title: string; body: string }) {
  const res = await fetch(`${API_URL}/api/store/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Your review couldn’t be sent. Please try again.');
  return true;
}

/** A website product (e.g. a hamper that isn't in the app's list yet), in /products.json shape. */
export async function fetchProductJson(handle: string) {
  return getJson<any>(`/api/store/product-json/${encodeURIComponent(handle)}`, `pj:${handle}`);
}
