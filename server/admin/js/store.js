/* Shared state: who is logged in, the schema, every section's draft/published copy, and the product list. */
import { api } from './api.js';

export const state = {
  user: null,
  schema: [],
  sections: {}, // key -> { draft, published, changed, updated_at, updated_by, published_at, published_by }
  products: null, // [{handle,title,image,images,category,type}] once loaded
};

const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const emit = () => listeners.forEach((fn) => fn());

export const sectionDef = (key) => state.schema.find((s) => s.key === key);
export const changedKeys = () => state.schema.map((s) => s.key).filter((k) => state.sections[k]?.changed);

export async function loadContent() {
  const { sections } = await api.get('/content');
  state.sections = Object.fromEntries(sections.map((s) => [s.key, s]));
  emit();
}

export function setSection(row) {
  const changed = row.changed ?? JSON.stringify(row.draft) !== JSON.stringify(row.published);
  state.sections[row.key] = { ...state.sections[row.key], ...row, changed };
  emit();
}

/* ───────── Products (loaded once, lazily) ───────── */

let productsPromise = null;
let productMap = new Map();

export function loadProducts() {
  if (!productsPromise) {
    productsPromise = api
      .get('/products')
      .then(({ products }) => {
        state.products = products || [];
        productMap = new Map(state.products.map((p) => [p.handle, p]));
        return state.products;
      })
      .catch((e) => {
        productsPromise = null; // allow a retry later
        throw e;
      });
  }
  return productsPromise;
}

export const productByHandle = (handle) => productMap.get(handle);

/** Run fn now if products are loaded, otherwise once they are. */
export function whenProducts(fn) {
  if (state.products) fn();
  else loadProducts().then(fn, () => {});
}

/* ───────── Images & links: turn stored values into something to show ───────── */

/**
 * Image values can be "/img/<id>", "https://…" or "product:<handle>".
 * Returns a URL to show (thumbnail size when `w` is given), or '' if unknown yet.
 */
export function imageUrl(value, w = 400) {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('/img/')) return w ? `${value}?w=${w}` : value;
  if (value.startsWith('product:')) {
    const p = productByHandle(value.slice(8));
    return p?.image || '';
  }
  if (/^https?:\/\//i.test(value)) return value;
  return '';
}

export function imageSource(value) {
  if (!value) return '';
  if (value.startsWith('/img/')) return 'From your image library';
  if (value.startsWith('product:')) {
    const p = productByHandle(value.slice(8));
    return p ? `Product photo · ${p.title}` : `Product photo · ${value.slice(8)}`;
  }
  return 'Image from a web link';
}

export const LINK_PRESETS = [
  { value: 'app:/home', label: 'Home' },
  { value: 'app:/shop', label: 'Shop' },
  { value: '/collections/all', label: 'All products' },
  { value: 'app:/coins', label: 'Rosier Coins' },
  { value: 'app:/cart', label: 'Cart' },
  { value: 'app:/benefits-club', label: 'Benefits Club' },
  { value: 'app:/gifting', label: 'Gifting' },
  { value: 'app:/blog', label: 'Blog' },
  { value: 'app:/about', label: 'Our Story' },
  { value: 'app:/help', label: 'Help & Support' },
];

/** Plain-English description of where a link goes. */
export function describeLink(link) {
  if (!link) return 'Nothing — not tappable';
  const preset = LINK_PRESETS.find((p) => p.value === link);
  if (preset) return `${preset.label} screen`;
  let m = link.match(/^\/products\/([^/?#]+)/);
  if (m) {
    const p = productByHandle(m[1]);
    return p ? `Product · ${p.title}` : `Product · ${m[1]}`;
  }
  m = link.match(/^\/collections\/([^/?#]+)/);
  if (m) return `Collection · ${m[1]}`;
  if (link.startsWith('app:/')) return `App screen · ${link.slice(5)}`;
  if (/^https?:\/\//i.test(link)) return 'Web page (opens in the browser)';
  if (link.startsWith('/')) return 'Page on rosierfoods.com';
  return 'Not a recognised link — check it';
}

/** Category options from the *draft* of the Categories section. */
export function categoryOptions() {
  const items = state.sections.categories?.draft?.items || [];
  return items.filter((c) => c && c.id).map((c) => ({ value: c.id, label: c.label || c.id }));
}
