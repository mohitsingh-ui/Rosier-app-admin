/**
 * A rosierfoods.com page shown inside the app exactly as on the phone website
 * (e.g. Gift Hampers → /pages/hampers). The site's header, footer and chat
 * buttons are hidden; "Add to cart / Pre-Book" buttons put the item in the
 * app's cart, and product / category links open the app screens.
 * Pages are set in the admin panel → Website pages in the app.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '../../components/Toast';
import { ScreenHeader } from '../../components/ui';
import { useContent } from '../../config/remote';
import { routeForHref } from '../../data/banners';
import { ensureProduct, STORE_URL, useCatalog } from '../../data/catalog';
import { success } from '../../lib/haptics';
import { fetchProductJson } from '../../lib/website';
import { cartAdded } from '../../lib/cartFx';
import { coinsForAmount } from '../../config/coins';
import { useCart } from '../../store/shop';
import { fonts, useTheme } from '../../theme';

type PageCfg = { id: string; enabled?: boolean; handle: string; title: string; hideSiteChrome?: boolean; extraCss?: string };

const HIDE_CSS = `
.shopify-section-group-header-group, .shopify-section-group-footer-group,
#scroll-to-top-button, .WhatsAppButton__root, [class*="whatsapp" i], [id*="gokwik" i], [class*="gokwik" i],
#shopify-chat, .m-cart-drawer, #CartDrawer, .announcement-bar { display: none !important; }
body { padding-top: 0 !important; margin-top: 0 !important; }
`;

function script(css: string) {
  return `(function(){
  if (window.__rosierApp) return; window.__rosierApp = true;
  var post = function(m){ try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch(e){} };
  var css = ${JSON.stringify(css)};
  var addCss = function(){ if (document.getElementById('rosier-app-css')) return; var s=document.createElement('style'); s.id='rosier-app-css'; s.textContent=css; (document.head||document.documentElement).appendChild(s); };
  addCss(); document.addEventListener('DOMContentLoaded', addCss);
  var handles = function(){ var o={}; document.querySelectorAll('a[href*="/products/"]').forEach(function(a){ var m=(a.getAttribute('href')||'').match(/\\/products\\/([^/?#]+)/); if(m) o[m[1]]=1; }); return Object.keys(o); };
  var near = function(el){ var d=0; while(el && d<6){ var a=el.querySelector && el.querySelector('a[href*="/products/"]'); if(a){ var m=a.getAttribute('href').match(/\\/products\\/([^/?#]+)/); if(m) return m[1]; } el=el.parentElement; d++; } return null; };
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var atc = t.closest('[data-hp-atc], [data-variant-id][class*="cart" i], button[name="add"]');
    if (atc) {
      var v = atc.getAttribute('data-hp-atc') || atc.getAttribute('data-variant-id');
      var form = atc.closest('form');
      if (!v && form) { var inp = form.querySelector('[name="id"]'); v = inp && inp.value; }
      if (v) { e.preventDefault(); e.stopImmediatePropagation(); post({ type:'add', variantId: Number(v), near: near(atc), handles: handles(), qty: 1 }); return; }
    }
    var a = t.closest('a[href]'); if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0)==='#' || /^(tel|mailto|javascript):/i.test(href)) return;
    var url; try { url = new URL(href, location.href); } catch(_) { return; }
    var same = /(^|\\.)rosierfoods\\.com$/i.test(url.hostname) || /myshopify\\.com$/i.test(url.hostname);
    if (same && url.pathname === location.pathname) return;
    e.preventDefault(); e.stopImmediatePropagation();
    post({ type:'link', href: same ? url.pathname + url.search : url.href, external: !same });
  }, true);
  document.addEventListener('submit', function(e){
    var f = e.target; if (!f || !/\\/cart\\/add/.test(f.getAttribute('action')||'')) return;
    var inp = f.querySelector('[name="id"]'); if (!inp) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var q = f.querySelector('[name="quantity"]');
    post({ type:'add', variantId: Number(inp.value), near: near(f), handles: handles(), qty: Number(q && q.value) || 1 });
  }, true);
  post({ type:'ready', title: document.title });
})(); true;`;
}

/** Finds the app product for a website variant (loading website products when needed). */
async function productForVariant(variantId: number, near: string | null, handles: string[]) {
  const has = (p: any) => p?.variants?.some((v: any) => v.id === variantId);
  const inCatalog = useCatalog.getState().products.find(has);
  if (inCatalog) return inCatalog;
  const order = [...new Set([near, ...handles].filter(Boolean) as string[])];
  for (const h of order) {
    try {
      const p = await ensureProduct(h, fetchProductJson);
      if (has(p)) return p;
    } catch {}
  }
  return null;
}

export default function WebPage() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const items = ((useContent('webPages' as any) as any)?.items ?? []) as PageCfg[];
  const cfg = items.find((p) => p && p.enabled !== false && (p.id === handle || p.handle === handle));
  const pageHandle = cfg?.handle || handle;
  const url = `${STORE_URL}/pages/${pageHandle}`;
  const css = (cfg?.hideSiteChrome === false ? '' : HIDE_CSS) + (cfg?.extraCss || '');
  const js = useMemo(() => script(css), [css]);
  const add = useCart((s) => s.add);
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const web = useRef<any>(null);

  const onMessage = async (raw: string) => {
    let m: any;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m.type === 'add' && m.variantId) {
      const p = await productForVariant(m.variantId, m.near, m.handles ?? []);
      if (!p) {
        toast('Couldn’t add this right now. Please try again.', 'info');
        return;
      }
      const v = p.variants.find((x) => x.id === m.variantId);
      if (v && !v.available) {
        toast('Sorry, this is sold out right now', 'info');
        return;
      }
      add(p.handle, m.variantId, m.qty || 1);
      cartAdded({ coins: coinsForAmount(v?.price ?? 0), title: p.title });
    } else if (m.type === 'link') {
      const href = String(m.href || '');
      if (m.external) {
        WebBrowser.openBrowserAsync(href, { toolbarColor: '#3E2415', controlsColor: '#F3D48B' });
        return;
      }
      const other = href.match(/^\/pages\/([^/?#]+)/)?.[1];
      if (other) {
        router.push({ pathname: '/page/[handle]', params: { handle: other } });
        return;
      }
      const r = routeForHref(href);
      if ('web' in r) WebBrowser.openBrowserAsync(`${STORE_URL}${r.web}`, { toolbarColor: '#3E2415', controlsColor: '#F3D48B' });
      else router.push(r as any);
    }
  };

  const cartButton = (
    <Pressable onPress={() => router.navigate('/cart')} hitSlop={8} accessibilityLabel="Cart" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="bag-handle-outline" size={24} color={t.text} />
      {count > 0 && (
        <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: '#fff' }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );

  let body: React.ReactNode;
  if (Platform.OS === 'web') {
    // Admin preview in a browser: show the page itself (buttons work in the real app).
    body = React.createElement('iframe', { src: url, style: { border: 0, width: '100%', height: '100%' }, onLoad: () => setLoading(false), title: cfg?.title || 'Page' });
  } else {
    const { WebView } = require('react-native-webview');
    body = (
      <WebView
        ref={web}
        source={{ uri: url }}
        injectedJavaScriptBeforeContentLoaded={js}
        injectedJavaScript={js}
        onMessage={(e: any) => onMessage(e.nativeEvent.data)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setFailed(true);
          setLoading(false);
        }}
        onShouldStartLoadWithRequest={(req: any) => {
          // Stay on this page; send everything else to the app (or the browser).
          if (req.url === 'about:blank' || req.isTopFrame === false) return true;
          const same = /^https?:\/\/(www\.)?rosierfoods\.com/i.test(req.url);
          if (same && req.url.replace(/^https?:\/\/(www\.)?rosierfoods\.com/i, '').split(/[?#]/)[0].replace(/\/$/, '') === `/pages/${pageHandle}`) return true;
          if (same && /\/(contact|challenge)/.test(req.url)) return true;
          onMessage(JSON.stringify({ type: 'link', href: same ? req.url.replace(/^https?:\/\/(www\.)?rosierfoods\.com/i, '') : req.url, external: !same }));
          return false;
        }}
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        pullToRefreshEnabled
        decelerationRate="normal"
        style={{ flex: 1, backgroundColor: t.bg }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title={cfg?.title || 'Rosier Foods'} right={cartButton} />
      <View style={{ flex: 1 }}>
        {failed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 }}>
            <Ionicons name="cloud-offline-outline" size={44} color={t.textMute} />
            <Text style={{ fontFamily: fonts.sans, color: t.textSoft, textAlign: 'center' }}>This page couldn’t load. Check your internet and try again.</Text>
            <Pressable
              onPress={() => {
                setFailed(false);
                setLoading(true);
                web.current?.reload?.();
              }}
              style={{ paddingHorizontal: 22, height: 42, borderRadius: 21, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: fonts.sansSemi, color: '#fff' }}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          body
        )}
        {loading && !failed && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: insets.bottom, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
            <ActivityIndicator color={t.primary} size="large" />
          </View>
        )}
      </View>
    </View>
  );
}
