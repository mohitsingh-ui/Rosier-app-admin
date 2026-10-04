/**
 * Which products the app sells.
 *
 * mode 'website': everything on rosierfoods.com, minus `hide`, plus `show` (products
 *                 in Shopify that aren't on the website).
 * mode 'pick':    only the products in `show`.
 *
 * Products that aren't on the website are read with the Storefront API, so they must be
 * available on the app's sales channel (the Headless / Storefront API channel) —
 * otherwise Shopify can't check them out.
 */
import { query } from './db.js';
import * as shopify from './shopify.js';

const KEY = 'app_products';
const DEFAULT = { mode: 'website', show: [], hide: [] };

export async function getSetting() {
  const { rows } = await query('select value from settings where key = $1', [KEY]);
  return { ...DEFAULT, ...(rows[0]?.value ?? {}) };
}

export async function saveSetting({ mode, show, hide }, by) {
  const clean = (a) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x).trim()).filter((x) => /^[\w-]{1,200}$/.test(x)))].slice(0, 1000);
  const value = { mode: mode === 'pick' ? 'pick' : 'website', show: clean(show), hide: clean(hide) };
  await query(
    `insert into settings (key, value, updated_at, updated_by) values ($1, $2, now(), $3)
     on conflict (key) do update set value = $2, updated_at = now(), updated_by = $3`,
    [KEY, JSON.stringify(value), by],
  );
  cache = null;
  return value;
}

/** Every product in Shopify (admin panel list). */
export async function adminList() {
  const out = [];
  let after = null;
  for (let page = 0; page < 5; page++) {
    const json = await shopify.adminGraphql(
      `query($after: String) {
        products(first: 100, after: $after, sortKey: TITLE) {
          pageInfo { hasNextPage endCursor }
          nodes { handle title status onlineStoreUrl productType featuredMedia { preview { image { url } } } priceRangeV2 { minVariantPrice { amount } } }
        }
      }`,
      { after },
    );
    if (json?.errors?.length) {
      const m = json.errors[0].message;
      throw new shopify.ShopifyError(/access|scope/i.test(m) ? 'Your Shopify app needs the read_products permission (Shopify connection → Admin API).' : m, 403);
    }
    const c = json?.data?.products;
    if (!c) break;
    out.push(...c.nodes);
    if (!c.pageInfo.hasNextPage) break;
    after = c.pageInfo.endCursor;
  }
  return out.map((p) => ({
    handle: p.handle,
    title: p.title,
    status: p.status,
    onWebsite: !!p.onlineStoreUrl,
    type: p.productType,
    image: p.featuredMedia?.preview?.image?.url ? `${p.featuredMedia.preview.image.url}${p.featuredMedia.preview.image.url.includes('?') ? '&' : '?'}width=120` : '',
    price: Math.round(Number(p.priceRangeV2?.minVariantPrice?.amount ?? 0)),
  }));
}

const PRODUCT_FIELDS = `handle title productType tags descriptionHtml
  images(first: 6) { nodes { url } }
  variants(first: 40) { nodes { id title availableForSale price { amount } compareAtPrice { amount } } }`;

/** Products by handle from the Storefront API, in the same shape as the website's /products.json. */
export async function storefrontProducts(handles) {
  const out = [];
  const list = [...new Set(handles)].slice(0, 200);
  for (let i = 0; i < list.length; i += 25) {
    const chunk = list.slice(i, i + 25);
    const q = `query { ${chunk.map((h, k) => `p${k}: product(handle: ${JSON.stringify(h)}) { ${PRODUCT_FIELDS} }`).join('\n')} }`;
    const data = await shopify.storefront(q);
    for (let k = 0; k < chunk.length; k++) {
      const p = data?.[`p${k}`];
      if (!p) continue;
      out.push({
        handle: p.handle,
        title: p.title,
        product_type: p.productType || '',
        tags: p.tags || [],
        body_html: p.descriptionHtml || '',
        images: (p.images?.nodes ?? []).map((x) => ({ src: x.url })),
        variants: (p.variants?.nodes ?? []).map((v) => ({
          id: Number(String(v.id).split('/').pop()),
          title: v.title,
          price: v.price?.amount ?? '0',
          compare_at_price: v.compareAtPrice?.amount ?? null,
          available: !!v.availableForSale,
        })),
        app_only: true,
      });
    }
  }
  return out;
}

let cache = null;
/** What the app needs: the rules + the products that aren't on the website. */
export async function publicList() {
  if (cache && Date.now() - cache.at < 3 * 60 * 1000) return cache.data;
  const s = await getSetting();
  let extra = [];
  if (s.show.length) extra = await storefrontProducts(s.show).catch(() => []);
  const data = { mode: s.mode, show: s.show, hide: s.hide, extra };
  cache = { at: Date.now(), data };
  return data;
}

/** Admin page: every Shopify product with whether it's in the app (and can be checked out there). */
export async function adminView() {
  const [s, all] = await Promise.all([getSetting(), adminList()]);
  const show = new Set(s.show);
  const hide = new Set(s.hide);
  const appOnlyShown = all.filter((p) => !p.onWebsite && show.has(p.handle)).map((p) => p.handle);
  let ready = new Set();
  let notice = '';
  if (appOnlyShown.length) {
    try {
      ready = new Set((await storefrontProducts(appOnlyShown)).map((p) => p.handle));
    } catch (e) {
      notice = `Couldn’t check the app sales channel: ${e.message}`;
    }
    const missing = all.filter((p) => appOnlyShown.includes(p.handle) && !ready.has(p.handle)).map((p) => p.title);
    if (missing.length && !notice)
      notice = `Not yet available to the app: ${missing.join(', ')}. In Shopify open each product → Sales channels (Publishing) → tick your app / Headless channel, and set it Active.`;
  }
  return {
    mode: s.mode,
    notice,
    products: all.map((p) => ({
      ...p,
      inApp: s.mode === 'pick' ? show.has(p.handle) : p.onWebsite ? !hide.has(p.handle) : show.has(p.handle),
      ready: p.onWebsite || ready.has(p.handle),
    })),
  };
}
