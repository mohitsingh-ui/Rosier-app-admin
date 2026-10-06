/* Live phone preview: the real app (web build) in a phone frame, fed the draft content as you type. */
import { state } from './store.js';
import { applyResize, buildInspector, doAction, initInspector, inspectorDocs, select } from './inspector.js';
import { debounce, h, icon } from './util.js';

const SCREENS = [
  ['/home', 'Home'],
  ['/onboarding', 'Intro slides'],
  ['/shop', 'Shop'],
  ['/coins', 'Rosier Coins'],
  ['/cart', 'Cart'],
  ['/coupons', 'Coupons'],
  ['/track', 'Track order'],
  ['/orders', 'My orders'],
  ['/profile', 'Profile'],
  ['/benefits-club', 'Benefits Club'],
  ['/blog', 'Blog'],
  ['/gifting', 'Gifting'],
  ['/page/hampers', 'Gift Hampers (website page)'],
  ['/product/a2-desi-cow-ghee-hand-churned-from-curd', 'A product page'],
  ['/collection/ghee', 'A category page'],
  ['/about', 'Our Story'],
  ['/help', 'Help & Support'],
  ['/notifications', 'Notifications'],
  ['/search', 'Search'],
  ['/login', 'Login'],
];

/** Which screen to show when editing each section. */
const ROUTE_FOR = {
  onboarding: '/onboarding',
  popup: '/home',
  home: '/home',
  categories: '/home',
  products: '/shop',
  coins: '/coins',
  benefits: '/benefits-club',
  reviews: '/home',
  pillars: '/about',
  account: '/login',
  announcements: '/notifications',
  about: '/about',
  blog: '/blog',
  gifting: '/gifting',
  help: '/help',
  search: '/search',
  theme: '/home',
  festival: '/home',
  effects: '/home',
  coupons: '/coupons',
  rewards: '/cart',
  cartFx: '/shop',
  push: '/home',
  tracking: '/track',
  productPage: '/product/a2-desi-cow-ghee-hand-churned-from-curd',
  webPages: '/page/hampers',
  general: '/home',
};

const PHONE_W = 390;
const PHONE_H = 844;

let pane = null;
let iframe = null;
let ready = false;
let live = { key: null, doc: null };
let mode = 'light';
let screenSel = null;
let routeLabel = null;

function contentNow() {
  const out = {};
  for (const [k, row] of Object.entries(state.sections)) out[k] = row?.draft;
  Object.assign(out, inspectorDocs());
  if (live.key && live.doc) out[live.key] = live.doc;
  return JSON.parse(JSON.stringify(out));
}

function post(msg) {
  if (ready && iframe?.contentWindow) iframe.contentWindow.postMessage(msg, location.origin);
}

let lastRoute = '/home';

/** Match the fake status bar to the top of the current screen. */
function paintStatusBar(content) {
  if (!pane) return;
  const th = content?.theme?.[mode] || {};
  const bg = lastRoute === '/onboarding' ? content?.onboarding?.background || '#F1DCC3' : th.header || (mode === 'dark' ? '#241E1A' : '#FBE6CF');
  pane.style.setProperty('--status-bg', bg);
  pane.style.setProperty('--status-fg', mode === 'dark' && lastRoute !== '/onboarding' ? '#F6EDE3' : '#2B1A10');
}

const pushNow = () => {
  const content = contentNow();
  paintStatusBar(content);
  post({ type: 'rosier:content', content });
};
const pushSoon = debounce(pushNow, 120);

function navigate(path) {
  post({ type: 'rosier:navigate', path });
  if (screenSel) screenSel.value = SCREENS.some(([p]) => p === path) ? path : '';
}

function fit() {
  if (!pane) return;
  const stage = pane.querySelector('.phone-stage');
  const avail = Math.max(320, stage.clientHeight - 8);
  const scale = Math.min(1, avail / (PHONE_H + 24), (stage.clientWidth - 8) / (PHONE_W + 24));
  pane.style.setProperty('--phone-scale', String(Math.max(0.45, scale)));
}

function setMode(m) {
  mode = m;
  pane.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  post({ type: 'rosier:mode', mode: m });
  paintStatusBar(contentNow());
}

function build() {
  iframe = h('iframe', { class: 'phone-screen', title: 'Rosier app preview', src: '/preview-app/?editor=1', allow: 'autoplay' });
  screenSel = h(
    'select',
    { class: 'input input-sm', 'aria-label': 'Screen', onchange: (e) => e.target.value && navigate(e.target.value) },
    h('option', { value: '' }, 'Other screen'),
    SCREENS.map(([p, l]) => h('option', { value: p }, l)),
  );
  routeLabel = h('span', { class: 'phone-route' });
  pane = h(
    'aside',
    { class: 'preview-pane', 'aria-label': 'Phone preview' },
    h(
      'div',
      { class: 'preview-head' },
      h('div', { class: 'preview-title' }, icon('cellphone'), h('strong', null, 'Live preview'), h('span', { class: 'badge badge-draft' }, 'Draft')),
      h('button', { type: 'button', class: 'icon-btn sm preview-close', title: 'Hide preview', 'aria-label': 'Hide preview', onclick: () => togglePane(false) }, icon('close')),
    ),
    h(
      'div',
      { class: 'preview-tools' },
      screenSel,
      h(
        'div',
        { class: 'seg', role: 'group', 'aria-label': 'Light or dark' },
        h('button', { type: 'button', class: 'seg-btn on', dataset: { mode: 'light' }, onclick: () => setMode('light') }, icon('white-balance-sunny'), 'Light'),
        h('button', { type: 'button', class: 'seg-btn', dataset: { mode: 'dark' }, onclick: () => setMode('dark') }, icon('weather-night'), 'Dark'),
      ),
      h('button', { type: 'button', class: 'icon-btn sm', title: 'Reload app', 'aria-label': 'Reload app', onclick: () => ((ready = false), (iframe.src = '/preview-app/?editor=1')) }, icon('refresh')),
    ),
    h(
      'div',
      { class: 'seg seg-edit', role: 'group', 'aria-label': 'Edit or use the app' },
      h('button', { type: 'button', class: 'seg-btn on', dataset: { edit: '1' }, onclick: () => setEditing(true) }, icon('cursor-default-click-outline'), 'Click to edit'),
      h('button', { type: 'button', class: 'seg-btn', dataset: { edit: '0' }, onclick: () => setEditing(false) }, icon('gesture-tap'), 'Use the app'),
    ),
    h('div', { class: 'phone-stage' }, h('div', { class: 'phone' }, h('div', { class: 'phone-status' }, h('span', null, '9:41'), h('div', { class: 'phone-notch' }), h('span', { class: 'phone-icons' }, icon('signal-cellular-3'), icon('wifi'), icon('battery-80'))), iframe)),
    h('p', { class: 'preview-foot' }, 'Changes show here instantly. Customers see them only after you publish. ', routeLabel),
  );
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== iframe.contentWindow) return;
    if (e.data?.type === 'rosier:select') select(e.data.id);
    if (e.data?.type === 'rosier:action') doAction(e.data);
    if (e.data?.type === 'rosier:resize') applyResize(e.data.target, e.data.value, e.data.done);
    if (e.data?.type === 'rosier:ready') {
      ready = true;
      pushNow();
      post({ type: 'rosier:mode', mode });
      post({ type: 'rosier:editMode', on: editing });
      if (live.key) navigate(ROUTE_FOR[live.key] || '/home');
    }
    if (e.data?.type === 'rosier:route') {
      routeLabel.textContent = `Showing ${e.data.path}`;
      lastRoute = e.data.path;
      paintStatusBar(contentNow());
      if (screenSel) screenSel.value = SCREENS.some(([p]) => p === e.data.path) ? e.data.path : '';
    }
  });
  window.addEventListener('resize', fit);
  return pane;
}

let editing = true;
function setEditing(on) {
  editing = on;
  pane.querySelectorAll('.seg-edit .seg-btn').forEach((b) => b.classList.toggle('on', (b.dataset.edit === '1') === on));
  post({ type: 'rosier:editMode', on });
  if (!on) select(null);
}

let wanted = true;
function togglePane(on) {
  wanted = on;
  document.body.classList.toggle('preview-open', on && !!live.key);
  document.body.classList.toggle('preview-collapsed', !on && !!live.key);
  requestAnimationFrame(fit);
}

/** Put the preview pane into the page once (it stays loaded while you move between sections). */
export function mountPreview(container, pageEditor) {
  if (!pane) {
    const p = build();
    p.prepend(h('div', { class: 'insp-col' }, buildInspector()));
    container.appendChild(p);
    initInspector({
      pageEditor,
      push: pushSoon,
      mode: () => mode,
      highlight: (id) => post({ type: 'rosier:highlight', id }),
      replay: (id) => post({ type: 'rosier:replay', id }),
      show: () => (document.body.classList.add('inspecting'), requestAnimationFrame(fit)),
      hide: () => (document.body.classList.remove('inspecting'), requestAnimationFrame(fit)),
    });
  }
  const fab = h('button', { type: 'button', class: 'preview-fab', onclick: () => togglePane(true) }, icon('cellphone'), h('span', null, 'Show phone'));
  container.appendChild(fab);
}

/** A section editor opened: show its screen in the phone. */
export function previewSection(key, doc) {
  const changedKey = live.key !== key;
  live = { key, doc };
  document.body.classList.toggle('has-preview', true);
  togglePane(wanted && window.innerWidth >= 1200);
  pushSoon();
  if (changedKey) navigate(ROUTE_FOR[key] || '/home');
}

/** The section being edited changed (every keystroke). */
export function previewUpdate(doc) {
  live.doc = doc;
  pushSoon();
}

/** Leaving the section editors (image library, versions…): hide the phone. */
export function previewHide() {
  live = { key: null, doc: null };
  document.body.classList.remove('has-preview', 'preview-open', 'preview-collapsed');
}

/** Content changed elsewhere (publish, restore, discard): refresh the phone. */
export function previewRefresh() {
  pushSoon();
}

/** Show an effect in the phone for a few seconds, even if it's switched off. */
export function previewTryCartFx() {
  post({ type: 'rosier:tryCartFx' });
}

export function previewTryEffect(effect) {
  post({ type: 'rosier:tryEffect', effect: JSON.parse(JSON.stringify(effect)) });
}
