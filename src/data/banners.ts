import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../store/storage';
import { STORE_URL } from './catalog';

export type LiveBanner = { id: string; image: string; href: string };

type BannerState = {
  slides: LiveBanner[];
  tiles: LiveBanner[];
  /** width ÷ height of the website's hero banners, learnt when the first one loads */
  aspect: number;
  updatedAt: number;
  refresh: () => Promise<void>;
};

const abs = (u: string) => {
  let s = u.replace(/&amp;/g, '&').trim();
  if (s.startsWith('//')) s = 'https:' + s;
  if (s.startsWith('/')) s = STORE_URL + s;
  return s;
};

/** Pick the best URL from an <img> tag: largest srcset entry, else src / data-src. */
function imgUrl(tag: string): string | null {
  const srcset = tag.match(/\s(?:data-)?srcset="([^"]+)"/i)?.[1];
  if (srcset) {
    const best = srcset
      .split(',')
      .map((p) => p.trim().split(/\s+/))
      .map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 }))
      .filter((c) => c.u)
      .sort((a, b) => b.w - a.w)[0];
    if (best) return abs(best.u);
  }
  const src = tag.match(/\s(?:data-src|src)="([^"]+)"/i)?.[1];
  if (!src || src.startsWith('data:')) return null;
  return abs(src);
}

/** Resize via Shopify's image CDN so phones don't download 3000px banners. */
const sized = (u: string, w = 1000) => {
  const clean = u.replace(/([?&])width=\d+&?/g, '$1').replace(/[?&]$/, '');
  return `${clean}${clean.includes('?') ? '&' : '?'}width=${w}`;
};

function nearestHref(html: string, at: number): string {
  const before = html.slice(Math.max(0, at - 2500), at);
  const links = [...before.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>/gi)];
  const last = links[links.length - 1];
  // Ignore the link if it was already closed before the image.
  if (!last) return '';
  const after = before.slice((last.index ?? 0) + last[0].length);
  if (/<\/a>/i.test(after)) return '';
  return last[1];
}

/** Reads the hero slider (+ the club tiles under it) from rosierfoods.com's homepage. */
export function parseHomepage(html: string) {
  const slides: LiveBanner[] = [];
  const seen = new Set<string>();
  const altRe = /<img\b[^>]*alt="slider image ([^"]*)"[^>]*>/gi;
  const byBlock = new Map<string, { image: string; href: string; mobile: boolean }[]>();
  for (const m of html.matchAll(altRe)) {
    const tag = m[0];
    const block = m[1].trim();
    const url = imgUrl(tag);
    if (!url) continue;
    const ctx = html.slice(Math.max(0, (m.index ?? 0) - 400), m.index ?? 0).toLowerCase();
    const mobile = /mobile/.test(tag.toLowerCase()) || /mobile/.test(ctx.slice(-200));
    const list = byBlock.get(block) ?? [];
    list.push({ image: url, href: nearestHref(html, m.index ?? 0), mobile });
    byBlock.set(block, list);
  }
  for (const [block, imgs] of byBlock) {
    const pick = imgs.find((i) => i.mobile) ?? imgs[0];
    const key = pick.image.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    slides.push({ id: block, image: sized(pick.image), href: pick.href });
  }

  // The two promo tiles (Benefit Club, Breakfast Club) sit right after the slider.
  const tiles: LiveBanner[] = [];
  for (const path of ['/products/membership', '/collections/oats']) {
    // The same link can appear in the menu first, so use the first one that wraps an image.
    let from = 0;
    while (true) {
      const i = html.indexOf(`href="${path}"`, from);
      if (i < 0) break;
      from = i + 1;
      const chunk = html.slice(i, i + 3000);
      const end = chunk.search(/<\/a>/i);
      const img = (end > 0 ? chunk.slice(0, end) : chunk).match(/<img\b[^>]*>/i)?.[0];
      const url = img && imgUrl(img);
      if (url) {
        tiles.push({ id: path, image: sized(url, 700), href: path });
        break;
      }
    }
  }
  return { slides, tiles };
}

export const useBanners = create<BannerState>()(
  persist(
    (set) => ({
      slides: [],
      tiles: [],
      aspect: 1.25,
      updatedAt: 0,
      refresh: async () => {
        try {
          const res = await fetch(`${STORE_URL}/`, { headers: { Accept: 'text/html' } });
          const html = await res.text();
          const { slides, tiles } = parseHomepage(html);
          if (slides.length || tiles.length) set({ slides, tiles, updatedAt: Date.now() });
        } catch {
          // Offline — keep the last banners we saw.
        }
      },
    }),
    { name: 'rosier-banners', storage, partialize: ({ slides, tiles, aspect, updatedAt }) => ({ slides, tiles, aspect, updatedAt }) },
  ),
);

/** Turn a website link into an in-app destination. */
export function routeForHref(href: string): { pathname: string; params?: Record<string, string> } | { web: string } {
  const path = href.replace(/^https?:\/\/(www\.)?rosierfoods\.com/i, '');
  const product = path.match(/^\/products\/([^/?#]+)/)?.[1];
  if (product === 'membership') return { pathname: '/benefits-club' };
  if (product) return { pathname: '/product/[handle]', params: { handle: product } };
  const col = path.match(/^\/collections\/([^/?#]+)/)?.[1];
  const map: Record<string, string> = {
    ghee: 'ghee',
    atta: 'atta',
    'stone-press-oil': 'oils',
    honey: 'immunity',
    'immunity-booster': 'immunity',
    oats: 'breakfast',
    'healthy-snacking': 'breakfast',
    pickles: 'pickles',
    combo: 'combos',
  };
  if (col && map[col]) return { pathname: '/collection/[id]', params: { id: map[col] } };
  if (col === 'all' || col === 'all-products') return { pathname: '/shop' };
  return { web: path || '/' };
}
