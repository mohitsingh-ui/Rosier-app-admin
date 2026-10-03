import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE_URL = process.env.STORE_URL || 'https://www.rosierfoods.com';
const here = path.dirname(fileURLToPath(import.meta.url));
let cache = { at: 0, items: null };

const TYPE_TO_CAT = { Ghee: 'ghee', Flour: 'atta', Oil: 'oils', Oats: 'breakfast', 'Bars/Nutbutters': 'breakfast', Pickle: 'pickles', Honey: 'immunity', Amlaprash: 'immunity', Combo: 'combos' };

function fromSnapshot() {
  const snap = JSON.parse(fs.readFileSync(path.resolve(here, '../seed/catalog.json'), 'utf8'));
  return snap.map((p) => ({ handle: p.handle, title: p.title, image: p.images?.[0] || '', images: p.images || [], category: p.category, type: p.type }));
}

/** Product list for the admin pickers — live from Shopify, cached 10 minutes. */
export async function listProducts() {
  if (cache.items && Date.now() - cache.at < 10 * 60 * 1000) return cache.items;
  try {
    const r = await fetch(`${STORE_URL}/products.json?limit=250`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const json = await r.json();
    const live = json.products.map((p) => ({
      handle: p.handle,
      title: p.title,
      image: p.images?.[0]?.src || '',
      images: (p.images || []).slice(0, 6).map((i) => i.src),
      category: p.handle === 'membership' ? 'membership' : TYPE_TO_CAT[p.product_type] || '',
      type: p.product_type,
    }));
    // Keep snapshot products that the live feed doesn't list.
    const known = new Set(live.map((p) => p.handle));
    const items = [...live, ...fromSnapshot().filter((p) => !known.has(p.handle))];
    cache = { at: Date.now(), items };
  } catch {
    cache = { at: Date.now() - 9 * 60 * 1000, items: fromSnapshot() };
  }
  return cache.items;
}
