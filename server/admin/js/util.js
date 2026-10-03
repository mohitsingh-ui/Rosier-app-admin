/* Small helpers shared by every part of the panel. No innerHTML with user content anywhere: build DOM with h(). */

/**
 * h('div', {class: 'x', onclick: fn}, 'text', childEl, [more])
 * Strings become text nodes, so user content is always escaped.
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'open') el[k] = !!v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** Material Design icon element. */
export const icon = (name, cls = '') => h('span', { class: `mdi mdi-${name} ${cls}`.trim(), 'aria-hidden': 'true' });

/** A small product-style thumbnail that turns into a neat placeholder if the photo can't load. */
export function thumbImg(src, fallbackIcon = 'image-off-outline') {
  if (!src) return h('span', { class: 'thumb-ph' }, icon(fallbackIcon));
  const img = h('img', { src, alt: '', loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: 'thumb-ph', title: "Photo couldn't load" }, icon(fallbackIcon))), { once: true });
  return img;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Like el.append() but flattens arrays and skips null/false (native append would print "null"). */
export function add(el, ...children) {
  append(el, children);
  return el;
}

/** Empty el, then add children. */
export const fill = (el, ...children) => add(clear(el), ...children);

export const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function debounce(fn, ms) {
  let t;
  const d = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function randomId() {
  const a = new Uint8Array(5);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ───────── Time ───────── */

export function relTime(when) {
  if (!when) return '';
  const d = new Date(when);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  const days = Math.round(hr / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return fullDate(d);
}

export const fullDate = (when) =>
  new Date(when).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ───────── Toasts ───────── */

let toastWrap;
export function toast(message, kind = 'ok', ms = 3800) {
  if (!toastWrap) {
    toastWrap = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastWrap);
  }
  const t = h(
    'div',
    { class: `toast toast-${kind}` },
    icon(kind === 'error' ? 'alert-circle-outline' : kind === 'info' ? 'information-outline' : 'check-circle-outline'),
    h('span', null, message),
  );
  toastWrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, kind === 'error' ? ms + 2500 : ms);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Copied');
}

/* ───────── Content helpers ───────── */

/** Should a field be visible, given its sibling values? */
export function isShown(field, obj) {
  if (!field.showIf) return true;
  return Object.entries(field.showIf).every(([k, vals]) => vals.includes(obj?.[k]));
}

export function isEmpty(v) {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Moves arr[from] to position `to` in place. */
export function move(arr, from, to) {
  if (to < 0 || to >= arr.length || from === to) return;
  const [x] = arr.splice(from, 1);
  arr.splice(to, 0, x);
}
