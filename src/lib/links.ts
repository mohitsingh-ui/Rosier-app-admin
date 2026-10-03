import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { routeForHref } from '../data/banners';
import { openStorePage } from './cart';

/**
 * Opens any link set in the admin panel:
 *  app:/coins            → an app screen
 *  /products/ghee        → product page in the app
 *  /collections/oats     → category in the app (or the website if unknown)
 *  https://…             → rosierfoods.com pages in-app, anything else in the browser
 */
export function openLink(href?: string | null) {
  const h = String(href ?? '').trim();
  if (!h) return;
  if (h.startsWith('app:')) {
    const path = h.slice(4) || '/home';
    const tabs = ['/home', '/shop', '/coins', '/cart', '/profile'];
    if (tabs.includes(path)) router.navigate(path as any);
    else router.push(path as any);
    return;
  }
  if (/^https?:\/\//i.test(h) && !/^https?:\/\/(www\.)?rosierfoods\.com/i.test(h)) {
    WebBrowser.openBrowserAsync(h, { toolbarColor: '#3E2415', controlsColor: '#F3D48B' });
    return;
  }
  const r = routeForHref(h);
  if ('web' in r) openStorePage(r.web);
  else router.push(r as any);
}
