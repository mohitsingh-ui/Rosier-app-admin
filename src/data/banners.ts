import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../store/storage';
import { STORE_URL, storeFetchUrl } from './catalog';

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

/** Best URL from a srcset list (largest width). */
function bestOf(srcset: string): string | null {
  const best = srcset
    .split(',')
    .map((p) => p.trim().split(/\s+/))
    .map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 }))
    .filter((c) => c.u)
    .sort((a, b) => b.w - a.w)[0];
  return best ? abs(best.u) : null;
}

/**
 * The website's phone banner for a slide. The theme puts it in
 * <picture><source media="(max-width: 767px)" srcset="…mobile…"><img …desktop…></picture>,
 * so look for a max-width <source> inside the same <picture> as the image.
 */
function mobileUrl(before: string): string | null {
  const pic = before.lastIndexOf('<picture');
  if (pic < 0 || before.lastIndexOf('</picture>') > pic) return null;
  for (const m of before.slice(pic).matchAll(/<source\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/media="[^"]*max-width/i.test(tag)) continue;
    const set = tag.match(/\s(?:data-)?srcset="([^"]+)"/i)?.[1];
    const url = set && bestOf(set);
    if (url) return url;
  }
  return null;
}

/** The link of a slide: the first <a href> between the start of the slide and its image. */
function slideHref(html: string, at: number): string {
  const from = html.lastIndexOf('data-slide=', at);
  const chunk = from >= 0 && at - from < 6000 ? html.slice(from, at) : html.slice(Math.max(0, at - 2500), at);
  return chunk.match(/<a\b[^>]*href="([^"#]+)"/i)?.[1] ?? nearestHref(html, at);
}

/** Reads the hero slider (+ the club tiles under it) from rosierfoods.com's homepage. */
export function parseHomepage(html: string) {
  const slides: LiveBanner[] = [];
  const seen = new Set<string>();
  const altRe = /<img\b[^>]*alt="slider image ([^"]*)"[^>]*>/gi;
  const byBlock = new Map<string, { image: string; href: string; mobile: boolean }[]>();
  let mobileAspect = 0;
  for (const m of html.matchAll(altRe)) {
    const tag = m[0];
    const at = m.index ?? 0;
    const block = m[1].trim();
    const before = html.slice(Math.max(0, at - 4000), at);
    // Phone-size banner uploaded on the website wins over the desktop one.
    const phone = mobileUrl(before);
    const url = phone ?? imgUrl(tag);
    if (!url) continue;
    if (phone && !mobileAspect) {
      const r = Number(before.match(/--aspect-ratio-mobile:\s*([\d.]+)/g)?.pop()?.split(':')[1]);
      if (r > 0.3 && r < 4) mobileAspect = r;
    }
    const mobile = !!phone || /mobile/.test(tag.toLowerCase());
    const list = byBlock.get(block) ?? [];
    list.push({ image: url, href: slideHref(html, at), mobile });
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
  return { slides, tiles, mobileAspect };
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
          const res = await fetch(storeFetchUrl('/'), { headers: { Accept: 'text/html' } });
          const html = await res.text();
          const { slides, tiles, mobileAspect } = parseHomepage(html);
          if (slides.length || tiles.length) set({ slides, tiles, updatedAt: Date.now(), ...(mobileAspect ? { aspect: mobileAspect } : {}) });
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
  if (col === 'all' || col === 'all-products' || col === 'best-sellers') return { pathname: '/shop' };
  return { web: path || '/' };
}
