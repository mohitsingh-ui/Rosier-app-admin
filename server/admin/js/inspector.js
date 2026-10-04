/*
 * Inspector: click something in the phone preview and its settings open here.
 * It can edit any section (not just the one open on the left), saves drafts on its own,
 * and handles the preview's toolbar actions (move, duplicate, delete, add) and drag-resize.
 */
import { api } from './api.js';
import { renderFields } from './fields.js';
import { confirmDialog, openModal } from './pickers.js';
import { sectionDef, setSection, state } from './store.js';
import { add, clear, clone, debounce, fill, h, icon, randomId, toast } from './util.js';

let hooks = { pageEditor: () => null, push: () => {}, highlight: () => {}, mode: () => 'light', show: () => {}, hide: () => {} };
export function initInspector(h0) {
  hooks = { ...hooks, ...h0 };
}

/* ───────── Drafts the inspector edits (sections not open on the left) ───────── */

const docs = {};
const timers = {};

export function inspectorDocs() {
  const ed = hooks.pageEditor();
  const out = {};
  for (const [k, v] of Object.entries(docs)) if (!ed || ed.key !== k) out[k] = v;
  return out;
}

function docFor(key) {
  const ed = hooks.pageEditor();
  if (ed && ed.key === key) return ed.doc;
  if (!docs[key]) docs[key] = clone(state.sections[key]?.draft ?? {});
  return docs[key];
}

const rerenderPage = debounce(() => hooks.pageEditor()?.rerender(), 500);

function touch(key) {
  const ed = hooks.pageEditor();
  if (ed && ed.key === key) {
    ed.changed();
    rerenderPage();
  } else {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => saveDoc(key), 700);
  }
  hooks.push();
}

async function saveDoc(key) {
  clearTimeout(timers[key]);
  if (!docs[key]) return;
  try {
    const { section } = await api.put(`/content/${key}`, { data: JSON.parse(JSON.stringify(docs[key])) });
    setSection(section);
  } catch (e) {
    toast(`Couldn't save: ${e.message}`, 'error');
  }
}

/** Save anything pending (before switching pages or publishing). */
export async function inspectorFlush() {
  await Promise.all(Object.keys(timers).map((k) => saveDoc(k)));
}

/** A section editor opened on the left: it owns that section's draft from now on. */
export function pageOpened(key) {
  if (docs[key]) {
    saveDoc(key);
    delete docs[key];
  }
}

/* ───────── What a selection edits ───────── */

function fieldsAt(key, path) {
  let fields = sectionDef(key)?.fields || [];
  let pendingList = null;
  for (const seg of path) {
    if (typeof seg === 'number') {
      fields = pendingList?.fields || [];
      pendingList = null;
      continue;
    }
    const f = fields.find((x) => x.key === seg);
    if (!f) return [];
    if (f.type === 'group') fields = f.fields;
    else if (f.type === 'list') pendingList = f;
    else return [f];
  }
  return pendingList ? [pendingList] : fields;
}

function objAt(obj, path) {
  let o = obj;
  for (const seg of path) {
    if (o == null) return null;
    if (o[seg] == null && typeof seg === 'string') o[seg] = {};
    o = o[seg];
  }
  return o;
}

const pick = (fields, keys) => keys.map((k) => fields.find((f) => f.key === k)).filter(Boolean);

const ROUTE_SECTION = {
  '/home': 'home',
  '/': 'home',
  '/onboarding': 'onboarding',
  '/shop': 'categories',
  '/coins': 'coins',
  '/cart': 'coins',
  '/profile': 'account',
  '/benefits-club': 'benefits',
  '/blog': 'blog',
  '/gifting': 'gifting',
  '/about': 'about',
  '/help': 'help',
  '/notifications': 'announcements',
  '/search': 'search',
  '/login': 'account',
  '/coupons': 'coupons',
  '/track': 'tracking',
  '/orders': 'tracking',
  '/product': 'productPage',
  '/page': 'webPages',
  '/collection': 'categories',
};

function partsFor(id) {
  const mode = hooks.mode();
  const themeColours = (keys) => ({ key: 'theme', path: [mode], title: `Colours (${mode} mode)`, fields: keys ? pick(fieldsAt('theme', [mode]), keys) : fieldsAt('theme', [mode]) });
  const layout = (keys, title = 'Size') => ({ key: 'theme', path: ['layout'], title, fields: pick(fieldsAt('theme', ['layout']), keys) });

  if (id.startsWith('page:')) {
    const route = id.slice(5).replace(/\/$/, '') || '/';
    const key = ROUTE_SECTION[route] ?? ROUTE_SECTION['/' + route.split('/')[1]];
    const parts = [];
    if (key) parts.push({ key, path: [], title: sectionDef(key)?.title || key, fields: fieldsAt(key, []) });
    parts.push(themeColours());
    // Seasonal effects (snow…) belong to whole screens, so offer them here too.
    if (sectionDef('effects')) parts.push({ key: 'effects', path: [], title: 'Seasonal effects (snow, sparkles…)', fields: fieldsAt('effects', []) });
    return { title: 'This screen', parts };
  }
  let m;
  if ((m = id.match(/^home\.sections\.(\d+)$/))) {
    const i = Number(m[1]);
    const sec = docFor('home').sections?.[i];
    if (!sec) return null;
    const typeLabel = (fieldsAt('home', ['sections', 0]).find((f) => f.key === 'type')?.options || []).find((o) => o.value === sec.type)?.label || sec.type;
    return { title: sec.title ? `${typeLabel.replace(/ \(.*\)$/, '')} · ${sec.title}` : typeLabel, section: i, parts: [{ key: 'home', path: ['sections', i], title: 'Content, style & animation', fields: fieldsAt('home', ['sections', 0]) }] };
  }
  if (id === 'home.hero')
    return {
      title: 'Top slider',
      parts: [
        { key: 'home', path: [], title: 'Slides', fields: pick(fieldsAt('home', []), ['heroSource', 'showCoinsBanner', 'coinsBanner', 'heroBanners']) },
        layout(['heroCardHeight', 'heroImageRatio', 'heroRadius', 'carouselSeconds'], 'Size & motion'),
      ],
    };
  if (id === 'home.tiles') return { title: 'Tiles under the slider', parts: [{ key: 'home', path: [], title: 'Tiles', fields: pick(fieldsAt('home', []), ['tilesSource', 'tiles']) }, layout(['tileRatio', 'tileRadius'])] };
  if (id === 'home.header') return { title: 'Header & search bar', parts: [{ key: 'home', path: [], title: 'Text', fields: pick(fieldsAt('home', []), ['searchPlaceholder']) }, themeColours(['header', 'cardStrong', 'text', 'textSoft', 'textMute'])] };
  if ((m = id.match(/^categories\.items\.(\d+)$/)))
    return { title: 'Category', parts: [{ key: 'categories', path: ['items', Number(m[1])], title: 'This category', fields: fieldsAt('categories', ['items', 0]) }, layout(['categoryTile', 'categoryIcon'], 'All category tiles')] };
  if ((m = id.match(/^home\.quickTabs\.(\d+)$/)))
    return {
      title: 'Tab above the banner',
      parts: [
        { key: 'home', path: ['quickTabs', Number(m[1])], title: 'This tab', fields: fieldsAt('home', ['quickTabs', 0]) },
        { key: 'home', path: [], title: 'All tabs', fields: pick(fieldsAt('home', []), ['quickTabsShow', 'quickTabWidth', 'quickTabHeight']) },
      ],
    };
  // A whole section, e.g. the coupon box in the cart.
  if (sectionDef(id)) return { title: sectionDef(id).title, parts: [{ key: id, path: [], title: sectionDef(id).title, fields: fieldsAt(id, []) }] };
  if (id === 'theme.cards')
    return { title: 'Product cards', parts: [layout(['gridColumns', 'productImageRatio', 'listImageScale', 'listImageFit', 'dealCardWidth', 'dealImageScale', 'cardRadius'], 'Size (all cards)'), themeColours(['imageBg', 'cardStrong', 'card', 'border', 'text', 'price', 'green', 'primary'])] };
  if ((m = id.match(/^onboarding\.slides\.(\d+)\.(video|art)$/))) {
    const keys = m[2] === 'video' ? ['videoWidth', 'videoRatio', 'videoRadius', 'videoFit', 'videoSound'] : ['artHeight', 'artScale', 'art'];
    return {
      title: m[2] === 'video' ? 'Intro video size' : 'Intro picture area',
      parts: [
        { key: 'onboarding', path: ['slides', Number(m[1])], title: 'Size', fields: pick(fieldsAt('onboarding', ['slides', 0]), keys) },
        { key: 'onboarding', path: ['slides', Number(m[1])], title: 'Text size & colour', fields: pick(fieldsAt('onboarding', ['slides', 0]), ['titleSize', 'titleColor', 'subSize', 'subColor']) },
      ],
    };
  }
  if ((m = id.match(/^categories\.banner\.(\d+)$/)))
    return { title: 'Category banner', parts: [{ key: 'categories', path: ['items', Number(m[1])], title: 'This category', fields: pick(fieldsAt('categories', ['items', 0]), ['showBanner', 'collection', 'bannerImage', 'bannerLink', 'bannerRadius']) }] };
  if ((m = id.match(/^onboarding\.slides\.(\d+)$/)))
    return {
      title: 'Intro slide',
      parts: [
        { key: 'onboarding', path: ['slides', Number(m[1])], title: 'This slide', fields: fieldsAt('onboarding', ['slides', 0]) },
        { key: 'onboarding', path: [], title: 'All intro slides', fields: pick(fieldsAt('onboarding', []), ['background', 'accent', 'skipLabel', 'buttonLabel']) },
      ],
    };
  return null;
}

/* ───────── Panel ───────── */

let panel = null;
let body = null;
let titleEl = null;
let actionsEl = null;
let currentId = null;

export function buildInspector() {
  titleEl = h('strong', { class: 'insp-title' });
  actionsEl = h('div', { class: 'insp-actions' });
  body = h('div', { class: 'insp-body' });
  panel = h(
    'section',
    { class: 'inspector', 'aria-label': 'Selected element' },
    h('div', { class: 'insp-head' }, h('span', { class: 'insp-icon' }, icon('cursor-default-click-outline')), titleEl, h('button', { type: 'button', class: 'icon-btn sm', title: 'Close', 'aria-label': 'Close', onclick: () => select(null) }, icon('close'))),
    actionsEl,
    body,
  );
  return panel;
}

function sectionActions(i) {
  const a = (ic, label, fn, cls = '') => h('button', { type: 'button', class: `btn btn-soft btn-sm ${cls}`, title: label, onclick: fn }, icon(ic), h('span', null, label));
  return [
    a('play-circle-outline', 'Play animation', () => hooks.replay?.(`home.sections.${i}`)),
    a('arrow-up', 'Up', () => doAction({ action: 'up', id: `home.sections.${i}` })),
    a('arrow-down', 'Down', () => doAction({ action: 'down', id: `home.sections.${i}` })),
    a('content-copy', 'Duplicate', () => doAction({ action: 'duplicate', id: `home.sections.${i}` })),
    a('plus', 'Add below', () => doAction({ action: 'add', id: `home.sections.${i}` })),
    a('trash-can-outline', 'Delete', () => doAction({ action: 'delete', id: `home.sections.${i}` }), 'danger'),
  ];
}

export function select(id) {
  currentId = id;
  if (!panel) return;
  if (!id) {
    hooks.hide();
    hooks.highlight(null);
    return;
  }
  const info = partsFor(id);
  if (!info) {
    hooks.hide();
    return;
  }
  titleEl.textContent = info.title;
  fill(actionsEl, info.section != null ? sectionActions(info.section) : null);
  actionsEl.hidden = info.section == null;
  clear(body);
  for (const part of info.parts) {
    const obj = objAt(docFor(part.key), part.path);
    if (!obj || !part.fields.length) continue;
    add(body, h('div', { class: 'insp-part' }, h('p', { class: 'insp-part-title' }, part.title), renderFields(part.fields, obj, () => touch(part.key))));
  }
  hooks.show();
  body.scrollTop = 0;
}

/* ───────── Toolbar actions & resize from the phone ───────── */

function homeSections() {
  const doc = docFor('home');
  if (!Array.isArray(doc.sections)) doc.sections = [];
  return doc.sections;
}

function sectionsField() {
  return fieldsAt('home', ['sections'])[0];
}

async function chooseSectionType() {
  const typeField = sectionsField().fields.find((f) => f.key === 'type');
  const m = openModal({ title: 'Add a section', subtitle: 'Pick what to add. You can change everything after.' });
  const grid = h('div', { class: 'type-grid' });
  const ICONS = { categories: 'shape-outline', deals: 'sale', benefits: 'crown-outline', grid: 'view-grid-outline', row: 'view-carousel-outline', promo: 'image-text', image: 'image-outline', reviews: 'star-outline', pillars: 'sprout-outline' };
  for (const o of typeField.options) add(grid, h('button', { type: 'button', class: 'type-tile', onclick: () => m.close(o.value) }, icon(ICONS[o.value] || 'shape-outline'), h('span', null, o.label)));
  add(m.body, grid);
  add(m.foot, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close(null) }, 'Cancel'));
  return m.result;
}

export async function doAction({ action, id, to }) {
  const m = String(id || '').match(/^home\.sections\.(\d+)$/);
  if (!m) return;
  const i = Number(m[1]);
  const list = homeSections();
  let next = i;
  if (action === 'up' && i > 0) {
    [list[i - 1], list[i]] = [list[i], list[i - 1]];
    next = i - 1;
  } else if (action === 'down' && i < list.length - 1) {
    [list[i + 1], list[i]] = [list[i], list[i + 1]];
    next = i + 1;
  } else if (action === 'move' && Number.isInteger(to)) {
    const [item] = list.splice(i, 1);
    next = to > i ? to - 1 : to;
    list.splice(next, 0, item);
  } else if (action === 'duplicate') {
    const copy = clone(list[i]);
    copy.id = `${list[i].id || list[i].type}-${randomId()}`;
    list.splice(i + 1, 0, copy);
    next = i + 1;
  } else if (action === 'delete') {
    if (!(await confirmDialog('This section is removed from the home screen (as a draft — publish to make it live).', { title: 'Delete this section?', ok: 'Delete', danger: true }))) return;
    list.splice(i, 1);
    touch('home');
    return select(null);
  } else if (action === 'add') {
    const type = await chooseSectionType();
    if (!type) return;
    const item = { ...clone(sectionsField().newItem || {}), id: `${type}-${randomId()}`, type, enabled: true, title: type === 'image' || type === 'benefits' || type === 'pillars' ? '' : 'New section' };
    list.splice(i + 1, 0, item);
    next = i + 1;
  } else return;
  touch('home');
  const nid = `home.sections.${next}`;
  select(nid);
  setTimeout(() => hooks.highlight(nid), 250);
}

/** Drag-resize in the phone: set the value at a content path like "theme.layout.heroCardHeight". */
export function applyResize(target, value, done) {
  const [key, ...path] = String(target).split('.');
  if (!state.sections[key]) return;
  const segs = path.map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  const leaf = segs.pop();
  const obj = objAt(docFor(key), segs);
  if (!obj) return;
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  obj[leaf] = Math.abs(v) < 10 ? Math.round(v * 100) / 100 : Math.round(v);
  touch(key);
  if (done && currentId) select(currentId);
}

export const currentSelection = () => currentId;
