/**
 * Things the app shows exactly as on rosierfoods.com (mobile view), read from the
 * live website so you only maintain them in one place:
 *  - Product A+ banners and the Description / Key Benefits / Nutrition tabs
 *  - Judge.me reviews (summary, list, photos) + writing a new review
 *  - The banner at the top of each collection (category) page
 */
const STORE_URL = (process.env.STORE_URL || 'https://www.rosierfoods.com').replace(/\/$/, '');
// Overridable for tests only.
const JUDGEME_WIDGET = process.env.JUDGEME_WIDGET_URL || 'https://judge.me/reviews/reviews_for_widget';
const JUDGEME_API = process.env.JUDGEME_API_URL || 'https://api.judge.me/api/v1/reviews';
const JUDGEME_SHOP = process.env.JUDGEME_SHOP || 'rosier-foods-store.myshopify.com';
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36 RosierApp/1.0';

const cache = new Map();
async function cached(key, ms, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value;
  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return value;
  } catch (e) {
    if (hit) return hit.value; // stale is better than nothing
    throw e;
  }
}

async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw Object.assign(new Error(`Website said ${r.status}`), { status: r.status === 404 ? 404 : 502 });
  return r.text();
}

const decode = (s) =>
  String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
const abs = (u) => {
  let s = decode(u).trim();
  if (s.startsWith('//')) s = 'https:' + s;
  if (s.startsWith('/')) s = STORE_URL + s;
  return s;
};
const bestOfSrcset = (set) =>
  set
    .split(',')
    .map((p) => p.trim().split(/\s+/))
    .map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 }))
    .filter((c) => c.u)
    .sort((a, b) => b.w - a.w)[0]?.u;

/** HTML → readable text with line breaks and bullets kept. */
export function htmlToText(html) {
  return decode(
    String(html ?? '')
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[a-z][^>]*$/i, '')
      .replace(/<\/t[dh]>/gi, ' · ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|h\d|li|tr|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((l) => l.trim().replace(/\s*·\s*$/, ''))
    .join('\n')
    .trim();
}

/* ───────── Product page: A+ banners, tabs, rating ───────── */

export function parseProductPage(html) {
  // A+ banners: <div class="aplus-banners"> <img …> … </div> (may appear for mobile and desktop).
  const blocks = [...html.matchAll(/<div[^>]*class="([^"]*aplus[^"]*)"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/gi)];
  let aplus = [];
  const pick = blocks.find((b) => /mobile/i.test(b[1])) ?? blocks.find((b) => !/desktop/i.test(b[1])) ?? blocks[0];
  if (pick) {
    aplus = [...pick[2].matchAll(/<img\b[^>]*>/gi)]
      .map((m) => {
        const tag = m[0];
        const set = tag.match(/\s(?:data-)?srcset="([^"]+)"/i)?.[1];
        const src = (set && bestOfSrcset(decode(set))) || tag.match(/\s(?:data-src|src)="([^"]+)"/i)?.[1];
        const w = Number(tag.match(/\swidth="(\d+)"/i)?.[1]) || 0;
        const h = Number(tag.match(/\sheight="(\d+)"/i)?.[1]) || 0;
        return src && !src.startsWith('data:') ? { image: abs(src), ratio: w && h ? w / h : 0 } : null;
      })
      .filter(Boolean);
  }

  // Tabs: titles in .m-tab-header, bodies in each .m-tab-content--tab → .rte
  const titles = [...html.matchAll(/<div\s+class="m-tab-header[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)].map((m) => htmlToText(m[1]));
  const at = html.indexOf('m-tabs__content');
  let bodies = [];
  if (at > 0) {
    const end = html.indexOf('</m-product-details-tabs>', at);
    const zone = html.slice(at, end > 0 ? end : at + 40000);
    bodies = zone
      .split(/class="m-tab-content--tab/)
      .slice(1)
      .map((part) => {
        const i = part.indexOf('class="rte"');
        return i < 0 ? '' : htmlToText(part.slice(part.indexOf('>', i) + 1));
      });
  }
  const tabs = titles.map((title, i) => ({ title, body: bodies[i] ?? '' })).filter((t) => t.title && t.body);

  const productId = html.match(/judgeme_product_reviews'[^>]*data-product-id='(\d+)'/)?.[1] ?? html.match(/data-product-id=['"](\d+)['"]/)?.[1] ?? html.match(/_themeProducts\[(\d+)\]/)?.[1] ?? null;
  const avg = Number(html.match(/data-average-rating='([\d.]+)'/)?.[1] ?? 0);
  const count = Number(html.match(/data-number-of-reviews='(\d+)'/)?.[1] ?? 0);
  return { aplus, tabs, productId, rating: avg, reviewCount: count };
}

export function productExtras(handle) {
  const h = String(handle).replace(/[^\w-]/g, '');
  return cached(`p:${h}`, 30 * 60 * 1000, async () => ({ handle: h, ...parseProductPage(await getText(`${STORE_URL}/products/${h}`)) }));
}

/* ───────── Judge.me reviews ───────── */

const mapReview = (r) => ({
  id: r.uuid,
  rating: Number(r.rating) || 0,
  title: r.title || '',
  body: htmlToText(r.body_html),
  name: r.is_anonymous_reviewer ? 'Anonymous' : r.reviewer_name || 'Customer',
  initial: r.reviewer_initial || (r.reviewer_name || 'C')[0],
  verified: !!r.verified_buyer,
  at: r.created_at,
  variant: r.product_variant_title || '',
  photos: (r.pictures_urls ?? []).map((p) => ({ small: p.small || p.compact || p.original, large: p.huge || p.original })),
  reply: r.reply_content ? htmlToText(r.reply_content) : '',
});

export function reviews(productId, page = 1, perPage = 5) {
  const id = String(productId).replace(/\D/g, '');
  const p = Math.max(1, Math.min(500, Number(page) || 1));
  const n = Math.max(1, Math.min(20, Number(perPage) || 5));
  return cached(`r:${id}:${p}:${n}`, 10 * 60 * 1000, async () => {
    const q = new URLSearchParams({ url: JUDGEME_SHOP, shop_domain: JUDGEME_SHOP, platform: 'shopify', page: String(p), per_page: String(n), product_id: id });
    const j = JSON.parse(await getText(`${JUDGEME_WIDGET}?${q}`));
    return {
      average: Number(j.average_rating) || 0,
      count: Number(j.number_of_reviews) || 0,
      histogram: (j.histogram ?? []).map((x) => ({ rating: x.rating, count: x.frequency, percent: x.percentage })),
      summary: j.ai_summary_text || '',
      page: j.pagination?.current_page ?? p,
      pages: j.pagination?.total_pages ?? 1,
      reviews: (j.reviews ?? []).map(mapReview),
    };
  });
}

/** Sends a review to Judge.me exactly like the website's "Write a review" form. Shows after the shop approves it. */
export async function submitReview({ productId, name, email, rating, title, body, customerId }) {
  const id = String(productId ?? '').replace(/\D/g, '');
  const r = Math.round(Number(rating));
  if (!id) throw Object.assign(new Error('Unknown product'), { status: 400 });
  if (!(r >= 1 && r <= 5)) throw Object.assign(new Error('Pick 1 to 5 stars'), { status: 400 });
  if (!String(name || '').trim()) throw Object.assign(new Error('Add your name'), { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(String(email || ''))) throw Object.assign(new Error('Add a valid email'), { status: 400 });
  if (String(body || '').trim().length < 3) throw Object.assign(new Error('Write a few words about the product'), { status: 400 });
  const form = new FormData();
  const fields = {
    platform: 'shopify',
    shop_domain: JUDGEME_SHOP,
    url: JUDGEME_SHOP,
    id,
    name: String(name).trim().slice(0, 80),
    email: String(email).trim().slice(0, 120),
    rating: String(r),
    title: String(title || '').trim().slice(0, 120),
    body: String(body).trim().slice(0, 4000),
    reviewer_name_format: '',
    source: 'rosier_app',
  };
  if (customerId) fields.shopify_customer_id = String(customerId).split('/').pop();
  for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
  const res = await fetch(JUDGEME_API, { method: 'POST', body: form, headers: { 'User-Agent': UA, Origin: STORE_URL, Referer: `${STORE_URL}/` }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw Object.assign(new Error(j.error || (Array.isArray(j.errors) ? j.errors.join(', ') : '') || 'Your review couldn’t be sent. Please try again.'), { status: 502 });
  }
  for (const k of [...cache.keys()]) if (k.startsWith(`r:${id}:`)) cache.delete(k);
  return { ok: true };
}

/* ───────── Collection (category) banner ───────── */

export function parseCollectionBanner(html) {
  // The first hero / image banner section on the page; the theme puts the phone image in <source media="(max-width: 767px)">.
  const start = html.search(/class="shopify-section[^"]*shopify-section-hero|m-hero-section|class="m-section m-hero/i);
  if (start < 0) return null;
  const chunk = html.slice(start, start + 12000);
  const ratioMobile = Number(chunk.match(/--aspect-ratio-mobile:\s*([\d.]+)/)?.[1] ?? 0);
  const ratio = Number(chunk.match(/--aspect-ratio:\s*([\d.]+)/)?.[1] ?? 0);
  const source = [...chunk.matchAll(/<source\b[^>]*>/gi)].map((m) => m[0]).find((t) => /max-width/i.test(t));
  const mobile = source ? bestOfSrcset(decode(source.match(/srcset="([^"]+)"/i)?.[1] ?? '')) : null;
  const img = chunk.match(/<img\b[^>]*>/i)?.[0];
  const desktop = img ? bestOfSrcset(decode(img.match(/srcset="([^"]+)"/i)?.[1] ?? '')) || img.match(/src="([^"]+)"/i)?.[1] : null;
  const image = mobile || desktop;
  if (!image) return null;
  const link = chunk.slice(0, chunk.search(/<img\b/i)).match(/<a\b[^>]*href="([^"#]+)"/i)?.[1] ?? '';
  return { image: abs(image), ratio: mobile ? ratioMobile || 1.3 : ratio || 3, link };
}

export function collectionBanner(handle) {
  const h = String(handle).replace(/[^\w-]/g, '');
  return cached(`c:${h}`, 30 * 60 * 1000, async () => ({ handle: h, banner: parseCollectionBanner(await getText(`${STORE_URL}/collections/${h}`)) }));
}

/** A website product as /products.json-style JSON (for products only found on a website page, e.g. hampers). */
export function productJson(handle) {
  const h = String(handle).replace(/[^\w-]/g, '');
  return cached(`j:${h}`, 10 * 60 * 1000, async () => {
    const p = JSON.parse(await getText(`${STORE_URL}/products/${h}.js`));
    return {
      handle: p.handle,
      title: p.title,
      product_type: p.type || '',
      tags: p.tags || [],
      body_html: p.description || '',
      images: (p.images || []).map((src) => ({ src: abs(src) })),
      variants: (p.variants || []).map((v) => ({ id: v.id, title: v.title, price: String(v.price / 100), compare_at_price: v.compare_at_price ? String(v.compare_at_price / 100) : null, available: !!v.available })),
    };
  });
}
