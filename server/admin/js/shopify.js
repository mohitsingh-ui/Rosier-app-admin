/* Shopify pages: connection settings, live orders, customers and the API console. */
import { api } from './api.js';
import { renderFields } from './fields.js';
import { confirmDialog } from './pickers.js';
import { add, clear, copyText, debounce, fill, fullDate, h, icon, relTime, toast } from './util.js';

const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function pageHead(ic, title, desc, right) {
  return h(
    'header',
    { class: 'page-head' },
    h('div', { class: 'page-title' }, h('span', { class: 'page-icon' }, icon(ic)), h('div', null, h('h1', null, title), h('p', { class: 'page-desc' }, desc))),
    right || null,
  );
}

const notConnected = (msg) =>
  h('div', { class: 'empty-state' }, icon('connection'), h('p', null, msg), h('a', { class: 'btn btn-soft', href: '#/shopify' }, icon('cog-outline'), 'Open Shopify connection'));

/* ═════════ Connection settings ═════════ */

const SECTIONS = [
  {
    title: 'Your store',
    icon: 'storefront-outline',
    fields: [
      { key: 'shopDomain', type: 'text', label: 'Store domain', help: 'Your myshopify address, e.g. rosier-foods-store.myshopify.com (Shopify admin → Settings → Domains).' },
      { key: 'apiVersion', type: 'text', label: 'API version', help: 'Leave as is unless a developer asks you to change it. Shopify releases a new version every 3 months.' },
      { key: 'countryCode', type: 'text', label: 'Country code', help: 'IN for India — sets the currency and taxes at checkout.' },
    ],
  },
  {
    title: 'Checkout in the app (Storefront API)',
    icon: 'cart-outline',
    test: 'storefront',
    steps: [
      'Shopify admin → Sales channels → Headless (install it from the Shopify App Store if you don\'t see it — it\'s free).',
      'Click "Create storefront" (name it "Rosier app"), then open Storefront API → Manage.',
      'Copy the Public access token and paste it below.',
      'Under Permissions, make sure products, cart and checkout access are ticked.',
    ],
    fields: [
      { key: 'storefrontToken', type: 'text', label: 'Storefront API public access token', help: 'Stored safely on the server. Only the last 4 characters are shown after saving.' },
      { key: 'cartCheckout', type: 'boolean', label: 'Use Shopify cart checkout in the app', help: 'Checkout and payment (UPI, cards, wallets, COD) happen inside the app, with the cart, the coin voucher and (if logged in) the customer’s saved address already filled in.' },
    ],
  },
  {
    title: 'Customer login (Customer Account API)',
    icon: 'account-key-outline',
    test: 'customer',
    steps: [
      'Shopify admin → Settings → Customer accounts: choose "Customer accounts" (the new, passwordless one).',
      'Sales channels → Headless → your "Rosier app" storefront → Customer Account API → Manage.',
      'Set Client type to "Confidential".',
      'Under Application setup → Callback URI(s), add the callback link shown below. Under Javascript origin(s) and Logout URI, add the backend link.',
      'Copy the Client ID and Client secret and paste them below.',
    ],
    fields: [
      { key: 'customerClientId', type: 'text', label: 'Client ID' },
      { key: 'customerClientSecret', type: 'text', label: 'Client secret', help: 'Stored safely on the server, never sent to phones.' },
      { key: 'loginEnabled', type: 'boolean', label: 'Let customers log in with their Shopify account', help: 'The same account they use on rosierfoods.com. They get a one-time code by email — no password.' },
      { key: 'requireLogin', type: 'boolean', label: 'Ask people to log in before checkout', help: 'Off = guests can still check out (they enter their details at checkout).' },
    ],
  },
  {
    title: 'Orders & customers in this panel (Admin API)',
    icon: 'shield-key-outline',
    test: 'admin',
    steps: [
      'Easiest: an existing custom app token (starts with shpat_) — Shopify admin → Settings → Apps → Develop apps → your app → API credentials.',
      'New apps (since Jan 2026): create an app in the Shopify Dev Dashboard, give it read_orders and read_customers access, install it on your store, then paste its Client ID and Client secret instead.',
    ],
    fields: [
      { key: 'adminToken', type: 'text', label: 'Admin API access token (shpat_…)', help: 'Use this OR the client ID + secret below.' },
      { key: 'adminClientId', type: 'text', label: 'App client ID (Dev Dashboard app)' },
      { key: 'adminClientSecret', type: 'text', label: 'App client secret' },
    ],
  },
];

export function shopifyPage(root) {
  let data = null;
  let dirty = false;
  const body = h('div', { class: 'stack-lg' }, h('p', { class: 'muted' }, 'Loading…'));
  const saveBtn = h('button', { type: 'button', class: 'btn btn-primary', disabled: true, onclick: save }, icon('content-save-outline'), 'Save connection');

  const markDirty = () => {
    dirty = true;
    saveBtn.disabled = false;
  };

  async function save() {
    saveBtn.disabled = true;
    try {
      const r = await api.put('/shopify/settings', data.settings);
      data.settings = r.settings;
      dirty = false;
      toast('Saved. The app picks this up the next time it opens.');
      render();
    } catch (e) {
      saveBtn.disabled = false;
      toast(e.message, 'error');
    }
  }

  async function test(kind, out) {
    if (dirty) await save();
    fill(out, h('span', { class: 'test-result' }, icon('loading', 'spin'), ' Testing…'));
    try {
      const r = await api.post(`/shopify/test/${kind}`);
      fill(out, h('span', { class: 'test-result ok' }, icon('check-circle'), ` ${r.message}`));
    } catch (e) {
      fill(out, h('span', { class: 'test-result bad' }, icon('alert-circle'), ` ${e.message}`));
    }
  }

  function linkRow(label, value) {
    return h('div', { class: 'copy-row' }, h('span', { class: 'copy-label' }, label), h('code', null, value), h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => copyText(value) }, icon('content-copy'), 'Copy'));
  }

  function render() {
    const s = data.settings;
    clear(body);
    for (const sec of SECTIONS) {
      const out = h('div', { class: 'test-out' });
      add(
        body,
        h(
          'section',
          { class: 'card shopify-card' },
          h('h2', null, icon(sec.icon), ` ${sec.title}`),
          sec.steps ? h('details', { class: 'how-to' }, h('summary', null, 'How to get these keys'), h('ol', null, sec.steps.map((t) => h('li', null, t)))) : null,
          sec.test === 'customer' ? h('div', { class: 'copy-box' }, linkRow('Callback URI', data.callbackUrl), linkRow('Javascript origin / Logout URI', data.backendUrl)) : null,
          renderFields(sec.fields, s, markDirty),
          sec.test ? h('div', { class: 'btn-row test-row' }, h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => test(sec.test, out) }, icon('connection'), 'Test connection'), out) : null,
        ),
      );
    }
  }

  async function load() {
    try {
      data = await api.get('/shopify/settings');
      render();
    } catch (e) {
      fill(body, h('p', { class: 'field-error' }, e.message));
    }
  }

  const beforeUnload = (e) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener('beforeunload', beforeUnload);

  add(root, h('div', { class: 'page' }, pageHead('shopping-outline', 'Shopify connection', 'Connect your Shopify store so customers can log in, see their orders and check out from the app.', saveBtn), body));
  load();
  return () => window.removeEventListener('beforeunload', beforeUnload);
}

/* ═════════ Orders ═════════ */

function statusBadge(text, kind) {
  return h('span', { class: `badge badge-${kind}` }, String(text || '').replace(/_/g, ' ').toLowerCase());
}

function pager({ path, key, row, empty, searchPlaceholder, headers }) {
  return (root, ic, title, desc) => {
    const search = h('input', { class: 'input', type: 'search', placeholder: searchPlaceholder });
    const tbody = h('tbody');
    const more = h('button', { type: 'button', class: 'btn btn-soft', hidden: true }, 'Load more');
    const status = h('p', { class: 'muted' }, 'Loading…');
    let cursor = null;

    async function load(reset) {
      if (reset) {
        cursor = null;
        clear(tbody);
      }
      status.hidden = false;
      fill(status, 'Loading…');
      try {
        const q = new URLSearchParams({ search: search.value.trim() });
        if (cursor) q.set('after', cursor);
        const r = await api.get(`${path}?${q}`);
        cursor = r.cursor;
        more.hidden = !r.hasNext;
        for (const item of r[key]) add(tbody, row(item));
        status.hidden = tbody.children.length > 0;
        if (!tbody.children.length) fill(status, empty);
      } catch (e) {
        status.hidden = false;
        fill(status, e.message.includes('not set up') ? notConnected(e.message) : h('span', { class: 'field-error' }, e.message));
      }
    }
    search.addEventListener('input', debounce(() => load(true), 400));
    more.addEventListener('click', () => load(false));

    add(
      root,
      h(
        'div',
        { class: 'page page-wide' },
        pageHead(ic, title, desc, h('button', { type: 'button', class: 'btn btn-soft', onclick: () => load(true) }, icon('refresh'), 'Refresh')),
        h('div', { class: 'card' }, h('div', { class: 'table-tools' }, search), h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', null, h('tr', null, headers.map((x) => h('th', null, x)))), tbody)), status, h('div', { class: 'btn-row center' }, more)),
      ),
    );
    load(true);
    return () => {};
  };
}

export const ordersPage = (root) =>
  pager({
    path: '/shopify/orders',
    key: 'orders',
    searchPlaceholder: 'Search by order number, email or name…',
    empty: 'No orders found.',
    headers: ['Order', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Delivery'],
    row: (o) =>
      h(
        'tr',
        null,
        h('td', null, h('strong', null, o.name), o.fromApp ? h('span', { class: 'badge badge-live', title: 'Placed from the Rosier app' }, 'App') : null),
        h('td', { title: fullDate(o.date) }, relTime(o.date)),
        h('td', null, o.customer, o.email ? h('small', { class: 'muted block' }, o.email) : null),
        h('td', { class: 'td-items' }, o.items.join(', ')),
        h('td', null, rupee(o.total)),
        h('td', null, o.cancelled ? statusBadge('cancelled', 'off') : statusBadge(o.payment, o.payment === 'PAID' ? 'live' : 'draft')),
        h('td', null, statusBadge(o.fulfillment, o.fulfillment === 'FULFILLED' ? 'live' : 'sched')),
      ),
  })(root, 'package-variant-closed', 'Orders', 'Live from Shopify. Orders placed in the app are marked “App”.');

export const customersPage = (root) =>
  pager({
    path: '/shopify/customers',
    key: 'customers',
    searchPlaceholder: 'Search by name, email or phone…',
    empty: 'No customers found.',
    headers: ['Customer', 'Email', 'Phone', 'Orders', 'Spent', 'Customer since', 'Tags'],
    row: (c) =>
      h(
        'tr',
        null,
        h('td', null, h('strong', null, c.name || '—')),
        h('td', null, c.email || '—'),
        h('td', null, c.phone || '—'),
        h('td', null, String(c.orders)),
        h('td', null, rupee(c.spent)),
        h('td', { title: fullDate(c.since) }, relTime(c.since)),
        h('td', null, h('div', { class: 'chips' }, c.tags.map((t) => h('span', { class: 'chip' }, t)))),
      ),
  })(root, 'account-multiple-outline', 'Customers', 'Your Shopify customers. Anyone here can log in to the app with the same email.');

/* ═════════ API console ═════════ */

const SAMPLES = [
  { label: 'Shop details', api: 'admin', query: '{\n  shop {\n    name\n    email\n    myshopifyDomain\n    plan { displayName }\n  }\n}' },
  {
    label: 'Last 10 orders',
    api: 'admin',
    query: '{\n  orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {\n    nodes {\n      name\n      processedAt\n      displayFinancialStatus\n      totalPriceSet { shopMoney { amount } }\n      customer { displayName }\n    }\n  }\n}',
  },
  { label: 'Products low in stock', api: 'admin', query: '{\n  productVariants(first: 20, query: "inventory_quantity:<10") {\n    nodes {\n      displayName\n      sku\n      inventoryQuantity\n    }\n  }\n}' },
  { label: 'Discount codes', api: 'admin', query: '{\n  codeDiscountNodes(first: 20) {\n    nodes {\n      codeDiscount {\n        ... on DiscountCodeBasic {\n          title\n          status\n          codes(first: 3) { nodes { code } }\n        }\n      }\n    }\n  }\n}' },
  { label: 'Storefront: products', api: 'storefront', query: '{\n  products(first: 5) {\n    nodes {\n      title\n      handle\n      priceRange { minVariantPrice { amount } }\n    }\n  }\n}' },
];

export function consolePage(root) {
  const apiSel = h('select', { class: 'input' }, h('option', { value: 'admin' }, 'Admin API (your store’s data)'), h('option', { value: 'storefront' }, 'Storefront API (what shoppers see)'));
  const queryBox = h('textarea', { class: 'input code', rows: 14, spellcheck: 'false' });
  const varsBox = h('textarea', { class: 'input code', rows: 3, spellcheck: 'false', placeholder: '{ }' });
  const allow = h('input', { type: 'checkbox' });
  const out = h('pre', { class: 'console-out' }, 'Results show here.');
  const meta = h('span', { class: 'muted' });
  const runBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: run }, icon('play'), 'Run');
  queryBox.value = SAMPLES[0].query;

  async function run() {
    let variables;
    if (varsBox.value.trim()) {
      try {
        variables = JSON.parse(varsBox.value);
      } catch {
        return toast('Variables must be valid JSON.', 'error');
      }
    }
    const isMutation = /^\s*mutation\b/i.test(queryBox.value.replace(/#.*$/gm, ''));
    if (isMutation && allow.checked && !(await confirmDialog('This changes real data in your Shopify store. Run it?', { title: 'Run a change?', ok: 'Run it', danger: true }))) return;
    runBtn.disabled = true;
    fill(out, 'Running…');
    meta.textContent = '';
    try {
      const r = await api.post('/shopify/graphql', { api: apiSel.value, query: queryBox.value, variables, allowChanges: allow.checked });
      out.textContent = JSON.stringify(r.result, null, 2);
      meta.textContent = `${r.ms} ms`;
    } catch (e) {
      out.textContent = e.message;
    } finally {
      runBtn.disabled = false;
    }
  }
  queryBox.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
  });

  add(
    root,
    h(
      'div',
      { class: 'page page-wide' },
      pageHead('code-braces', 'API console', 'Ask Shopify anything with a GraphQL query. Read-only unless you tick “Allow changes”.'),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chips' }, SAMPLES.map((s) => h('button', { type: 'button', class: 'chip chip-btn', onclick: () => ((queryBox.value = s.query), (apiSel.value = s.api)) }, s.label))),
        h('div', { class: 'two-col console-grid' },
          h('div', { class: 'stack' },
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Which API'), apiSel),
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Query'), queryBox, h('p', { class: 'help' }, 'Press Ctrl/⌘ + Enter to run. Docs: shopify.dev/docs/api/admin-graphql')),
            h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Variables (optional, JSON)'), varsBox),
            h('label', { class: 'check-row' }, allow, h('span', null, 'Allow changes (mutations) — be careful, these edit your live store')),
            h('div', { class: 'btn-row' }, runBtn, meta),
          ),
          h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Result'), out),
        ),
      ),
    ),
  );
  return () => {};
}
