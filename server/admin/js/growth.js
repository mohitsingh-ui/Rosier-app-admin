/* App sales dashboard, phone notifications (push) and the app product list. */
import { api } from './api.js';
import { add, clear, debounce, fill, fullDate, h, icon, relTime, toast } from './util.js';
import { pageHead } from './shopify.js';

const rupee = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const short = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
};

/* ═════════ App sales dashboard ═════════ */

function change(now, prev) {
  if (!prev && !now) return h('span', { class: 'kpi-chg flat' }, '—');
  if (!prev) return h('span', { class: 'kpi-chg up' }, icon('arrow-top-right'), 'new');
  const p = ((now - prev) / prev) * 100;
  const cls = Math.abs(p) < 0.5 ? 'flat' : p > 0 ? 'up' : 'down';
  return h('span', { class: `kpi-chg ${cls}`, title: `Previous period: ${prev}` }, icon(cls === 'up' ? 'arrow-top-right' : cls === 'down' ? 'arrow-bottom-right' : 'minus'), `${p > 0 ? '+' : ''}${p.toFixed(1)}%`);
}

function kpi(label, value, ch, sub) {
  return h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, label), h('div', { class: 'kpi-row' }, h('strong', { class: 'kpi-value' }, value), ch), sub ? h('small', { class: 'muted' }, sub) : null);
}

/** Daily bars for one measure, with a hover tooltip. */
function barChart(series, metric) {
  const W = 760;
  const H = 220;
  const pad = { l: 46, r: 8, t: 12, b: 26 };
  const vals = series.map((d) => d[metric]);
  const max = Math.max(1, ...vals);
  const nice = (() => {
    const p = 10 ** Math.floor(Math.log10(max));
    const m = max / p;
    return Math.max(4, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p);
  })();
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = iw / series.length;
  const fmt = (v) => (metric === 'sales' ? `₹${short(v)}` : short(v));
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${metric} per day` });
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih - (ih * i) / 4;
    svg.appendChild(el('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'grid' }));
    const t = el('text', { x: pad.l - 8, y: y + 4, class: 'axis', 'text-anchor': 'end' });
    t.textContent = fmt((nice * i) / 4);
    svg.appendChild(t);
  }
  const tip = h('div', { class: 'chart-tip', hidden: true });
  series.forEach((d, i) => {
    const v = d[metric];
    const bh = (v / nice) * ih;
    const x = pad.l + i * bw + Math.min(2, bw * 0.1);
    const w = Math.max(1, bw - Math.min(4, bw * 0.2));
    const y = pad.t + ih - bh;
    const r = Math.min(4, w / 2, bh);
    // Rounded top only, square at the baseline.
    const path = bh > 0 ? `M${x},${pad.t + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${pad.t + ih} Z` : '';
    if (path) svg.appendChild(el('path', { d: path, class: 'bar' }));
    const hit = el('rect', { x: pad.l + i * bw, y: pad.t, width: bw, height: ih, class: 'hit' });
    const label = new Date(d.d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    hit.addEventListener('mouseenter', () => {
      fill(tip, h('strong', null, label), h('div', null, `Sales ${rupee(d.sales)}`), h('div', null, `Orders ${d.orders}`), h('div', null, `Sessions ${d.sessions}`));
      tip.hidden = false;
      tip.style.left = `${((pad.l + (i + 0.5) * bw) / W) * 100}%`;
    });
    hit.addEventListener('mouseleave', () => (tip.hidden = true));
    svg.appendChild(hit);
    const every = Math.ceil(series.length / 8);
    if (i % every === 0) {
      const t = el('text', { x: pad.l + (i + 0.5) * bw, y: H - 8, class: 'axis', 'text-anchor': 'middle' });
      t.textContent = series.length === 1 ? 'Today' : label;
      svg.appendChild(t);
    }
  });
  return h('div', { class: 'chart-wrap' }, svg, tip);
}

export function dashboardPage(root) {
  let days = 7;
  let metric = 'sales';
  let data = null;
  const body = h('div', { class: 'stack-lg' }, h('p', { class: 'muted' }, 'Loading…'));
  const rangeBtns = [
    [1, 'Today'],
    [7, '7 days'],
    [30, '30 days'],
    [90, '90 days'],
  ].map(([d, l]) => h('button', { type: 'button', class: 'seg-btn', dataset: { d }, onclick: () => ((days = d), load()) }, l));
  const liveEl = h('span', { class: 'live-pill' }, h('span', { class: 'live-dot' }), 'Live: —');

  async function load() {
    rangeBtns.forEach((b) => b.classList.toggle('on', Number(b.dataset.d) === days));
    try {
      data = await api.get(`/analytics?days=${days}`);
      render();
    } catch (e) {
      fill(body, h('p', { class: 'field-error' }, e.message));
    }
  }

  function render() {
    const d = data;
    fill(liveEl, h('span', { class: 'live-dot' }), `Live in app: ${d.live.n}`);
    liveEl.title = `Android ${d.live.android} · iPhone ${d.live.ios} · active in the last 5 minutes`;
    const metricBtns = [
      ['sales', 'Sales'],
      ['orders', 'Orders'],
      ['sessions', 'Sessions'],
    ].map(([m, l]) => h('button', { type: 'button', class: `seg-btn ${metric === m ? 'on' : ''}`, onclick: () => ((metric = m), render()) }, l));
    fill(
      body,
      d.ordersError ? h('div', { class: 'notice' }, icon('alert-outline'), ` Sales couldn’t be loaded from Shopify: ${d.ordersError}. Sessions still show.`) : null,
      h(
        'div',
        { class: 'kpis' },
        kpi('Sessions', short(d.sessions.now), change(d.sessions.now, d.sessions.prev), `${short(d.users.now)} people · ${short(d.newUsers.now)} new`),
        kpi('Total sales (app)', rupee(d.sales.now), change(d.sales.now, d.sales.prev), d.storeSales ? `${d.share.toFixed(1)}% of all store sales` : null),
        kpi('Orders (app)', short(d.orders.now), change(d.orders.now, d.orders.prev)),
        kpi('Avg. order value', rupee(d.aov.now), change(d.aov.now, d.aov.prev)),
        kpi('Conversion rate', `${d.conversion.now.toFixed(2)}%`, change(d.conversion.now, d.conversion.prev), 'orders ÷ sessions'),
        kpi('Discounts given', rupee(d.discounts), null, 'coupons, coins, member'),
      ),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, { sales: 'App sales per day', orders: 'App orders per day', sessions: 'App sessions per day' }[metric]), h('div', { class: 'seg' }, metricBtns)), barChart(d.series, metric)),
      h(
        'div',
        { class: 'grid-2' },
        h(
          'section',
          { class: 'card' },
          h('h2', null, 'Top products in the app'),
          d.top.length
            ? h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Product'), h('th', null, 'Units'), h('th', null, 'Sales'))), h('tbody', null, d.top.map((p) => h('tr', null, h('td', null, p.title), h('td', null, String(p.qty)), h('td', null, rupee(p.sales))))))
            : h('p', { class: 'muted' }, 'No app orders in this period yet.'),
        ),
        h(
          'section',
          { class: 'card' },
          h('h2', null, 'Latest app orders'),
          d.recent.length
            ? h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Order'), h('th', null, 'Customer'), h('th', null, 'Total'), h('th', null, 'When'))), h('tbody', null, d.recent.map((o) => h('tr', null, h('td', null, h('strong', null, o.name)), h('td', null, o.customer), h('td', null, rupee(o.total)), h('td', { title: fullDate(o.at) }, relTime(o.at))))))
            : h('p', { class: 'muted' }, 'No app orders in this period yet.'),
        ),
      ),
      h('p', { class: 'muted small' }, 'Sales & orders: Shopify orders placed through the app (marked source = rosier_app). Sessions: app opens (a new session after 30 minutes away). Compared with the previous period of the same length.'),
    );
  }

  add(root, h('div', { class: 'page page-wide' }, pageHead('chart-box-outline', 'App sales', 'How the app is doing — only what happens in the app.', h('div', { class: 'btn-row' }, liveEl, h('div', { class: 'seg' }, rangeBtns))), body));
  load();
  const timer = setInterval(async () => {
    try {
      const l = (await api.get(`/analytics?days=${days}`)).live;
      fill(liveEl, h('span', { class: 'live-dot' }), `Live in app: ${l.n}`);
    } catch {
      /* ignore */
    }
  }, 30_000);
  return () => clearInterval(timer);
}

/* ═════════ Phone notifications ═════════ */

const AUDIENCE = {
  all: 'Everyone with the app',
  members: 'Members only',
  non_members: 'Everyone except members',
  logged_in: 'Logged-in customers',
  guests: 'People not logged in',
};

export function pushPage(root) {
  const body = h('div', { class: 'stack-lg' }, h('p', { class: 'muted' }, 'Loading…'));
  const title = h('input', { class: 'input', maxlength: 80, placeholder: 'e.g. Diwali sale is live 🪔' });
  const msg = h('textarea', { class: 'input', rows: 3, maxlength: 300, placeholder: 'e.g. Flat 20% off on ghee till Sunday. Tap to shop.' });
  const link = h('input', { class: 'input', placeholder: 'app:/coins, /collections/ghee, /products/… (optional)' });
  const aud = h('select', { class: 'input' }, Object.entries(AUDIENCE).map(([v, l]) => h('option', { value: v }, l)));
  const send = h('button', { type: 'button', class: 'btn btn-primary' }, icon('send-outline'), 'Send now');
  const prevTitle = h('strong');
  const prevBody = h('span');
  const paintPrev = () => {
    prevTitle.textContent = title.value || 'Your title';
    prevBody.textContent = msg.value || 'Your message';
  };
  title.addEventListener('input', paintPrev);
  msg.addEventListener('input', paintPrev);
  paintPrev();

  send.addEventListener('click', async () => {
    if (!title.value.trim()) return toast('Add a title', 'error');
    if (!confirm(`Send “${title.value}” to: ${AUDIENCE[aud.value]}?`)) return;
    send.disabled = true;
    try {
      const r = await api.post('/push/send', { title: title.value.trim(), body: msg.value.trim(), link: link.value.trim(), audience: aud.value });
      toast(`Sent to ${r.sent} phone${r.sent === 1 ? '' : 's'}${r.failed ? ` (${r.failed} couldn’t be reached)` : ''}.`);
      title.value = msg.value = link.value = '';
      paintPrev();
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      send.disabled = false;
    }
  });

  async function load() {
    try {
      const r = await api.get('/push');
      const s = r.stats;
      fill(
        body,
        h(
          'div',
          { class: 'kpis' },
          kpi('Phones with notifications on', String(s.devices), null, `Android ${s.android} · iPhone ${s.ios}`),
          kpi('Getting instant push', String(s.push_ok ?? 0), null, s.background ? `${s.background} on the 15-minute background check (finish the Firebase setup for instant)` : 'confirmed by Firebase / Apple'),
          kpi('Logged-in customers', String(s.logged_in)),
          kpi('Members', String(s.members)),
        ),
        h(
          'div',
          { class: 'grid-2' },
          h(
            'section',
            { class: 'card stack' },
            h('h2', null, 'Send a notification now'),
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Title'), title),
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Message'), msg),
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Opens when tapped'), link),
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Send to'), aud),
            h('div', { class: 'btn-row' }, send, h('a', { class: 'btn btn-ghost', href: '#/section/push' }, icon('music-note-outline'), 'Sound & order messages')),
          ),
          h('section', { class: 'card' }, h('h2', null, 'How it looks'), h('div', { class: 'push-mock' }, h('div', { class: 'push-mock-app' }, h('img', { src: 'favicon.png', alt: '' }), 'ROSIER · now'), prevTitle, prevBody)),
        ),
        h(
          'section',
          { class: 'card' },
          h('h2', null, 'Sent'),
          r.history.length
            ? h(
                'table',
                { class: 'table' },
                h('thead', null, h('tr', null, h('th', null, 'Notification'), h('th', null, 'To'), h('th', null, 'Delivered'), h('th', null, 'When'))),
                h(
                  'tbody',
                  null,
                  r.history.map((x) =>
                    h(
                      'tr',
                      null,
                      h('td', null, h('strong', null, x.title), h('small', { class: 'muted block' }, x.body)),
                      h('td', null, x.kind === 'order' ? x.audience : AUDIENCE[x.audience] || x.audience),
                      h('td', null, `${x.sent}${x.failed ? ` · ${x.failed} failed` : ''}`),
                      h('td', { title: fullDate(x.created_at) }, relTime(x.created_at)),
                    ),
                  ),
                ),
              )
            : h('p', { class: 'muted' }, 'Nothing sent yet.'),
        ),
      );
    } catch (e) {
      fill(body, h('p', { class: 'field-error' }, e.message));
    }
  }

  add(root, h('div', { class: 'page page-wide' }, pageHead('cellphone-message', 'Push notifications', 'Pop-up notifications on customers’ phones — even when the app is closed. Order updates are sent automatically.'), body));
  load();
  return () => {};
}

/* ═════════ Products in the app ═════════ */

export function appProductsPage(root) {
  let data = null;
  let filter = 'all';
  let q = '';
  const body = h('div', { class: 'stack-lg' }, h('p', { class: 'muted' }, 'Loading products from Shopify…'));
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search products…' });
  search.addEventListener(
    'input',
    debounce(() => ((q = search.value.trim().toLowerCase()), render()), 200),
  );
  const saveBtn = h('button', { type: 'button', class: 'btn btn-primary', disabled: true }, icon('content-save-outline'), 'Save');
  let changed = false;

  async function load() {
    try {
      data = await api.get('/app-products');
      render();
    } catch (e) {
      fill(body, h('p', { class: 'field-error' }, e.message));
    }
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      const pick = data.mode === 'pick';
      await api.put('/app-products', {
        mode: data.mode,
        show: data.products.filter((p) => p.inApp && (pick || !p.onWebsite)).map((p) => p.handle),
        hide: pick ? [] : data.products.filter((p) => !p.inApp && p.onWebsite).map((p) => p.handle),
      });
      load();
      changed = false;
      toast('Saved. Phones get the new product list within a few minutes (no publish needed).');
    } catch (e) {
      saveBtn.disabled = false;
      toast(e.message, 'error');
    }
  });
  const mark = () => {
    changed = true;
    saveBtn.disabled = false;
  };

  function render() {
    const list = data.products.filter((p) => {
      if (q && !`${p.title} ${p.handle}`.toLowerCase().includes(q)) return false;
      if (filter === 'app_only') return !p.onWebsite;
      if (filter === 'shown') return p.inApp;
      if (filter === 'hidden') return !p.inApp;
      return true;
    });
    const modeSel = h(
      'select',
      { class: 'input', onchange: (e) => ((data.mode = e.target.value), mark(), render()) },
      h('option', { value: 'website', selected: data.mode === 'website' }, 'Same as the website (plus the ones I tick below)'),
      h('option', { value: 'pick', selected: data.mode === 'pick' }, 'Only the products I tick below'),
    );
    const tabs = [
      ['all', `All (${data.products.length})`],
      ['shown', `In the app (${data.products.filter((p) => p.inApp).length})`],
      ['hidden', 'Not in the app'],
      ['app_only', `Not on the website (${data.products.filter((p) => !p.onWebsite).length})`],
    ].map(([k, l]) => h('button', { type: 'button', class: `seg-btn ${filter === k ? 'on' : ''}`, onclick: () => ((filter = k), render()) }, l));
    fill(
      body,
      data.notice ? h('div', { class: 'notice' }, icon('information-outline'), ' ', data.notice) : null,
      h('section', { class: 'card stack' }, h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Which products show in the app'), modeSel), h('div', { class: 'table-tools' }, search, h('div', { class: 'seg' }, tabs))),
      h(
        'section',
        { class: 'card' },
        h(
          'table',
          { class: 'table' },
          h('thead', null, h('tr', null, h('th', null, 'In app'), h('th', null, 'Product'), h('th', null, 'Website'), h('th', null, 'Status'), h('th', null, 'Price'))),
          h(
            'tbody',
            null,
            list.map((p) => {
              const cb = h('input', { type: 'checkbox', checked: p.inApp, 'aria-label': `Show ${p.title} in the app` });
              cb.addEventListener('change', () => {
                p.inApp = cb.checked;
                mark();
              });
              return h(
                'tr',
                null,
                h('td', null, h('label', { class: 'switch-row compact' }, cb, h('span', { class: 'switch', 'aria-hidden': 'true' }))),
                h('td', null, h('div', { class: 'prod-cell' }, p.image ? h('img', { src: p.image, alt: '', loading: 'lazy' }) : icon('image-off-outline'), h('div', null, h('strong', null, p.title), h('small', { class: 'muted block' }, p.handle)))),
                h('td', null, p.onWebsite ? h('span', { class: 'badge badge-live' }, 'On website') : h('span', { class: 'badge badge-sched' }, 'App only')),
                h('td', null, h('span', { class: `badge ${p.status === 'ACTIVE' ? 'badge-live' : 'badge-draft'}` }, (p.status || '').toLowerCase())),
                h('td', null, p.price ? rupee(p.price) : '—'),
              );
            }),
          ),
        ),
        list.length ? null : h('p', { class: 'muted' }, 'Nothing here.'),
      ),
    );
  }

  add(
    root,
    h(
      'div',
      { class: 'page page-wide' },
      pageHead(
        'package-variant',
        'Products in the app',
        'Pick what customers can buy in the app — including Shopify products that aren’t on the website.',
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn btn-soft', onclick: load }, icon('refresh'), 'Refresh'), saveBtn),
      ),
      body,
    ),
  );
  load();
  return () => {
    if (changed) toast('Your product changes weren’t saved.', 'info');
  };
}
