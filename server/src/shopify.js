/**
 * Shopify connection: customer login (Customer Account API), the customer's own
 * orders, logged-in checkout (Storefront API cart) and the Admin API tools used by
 * the admin panel (orders, customers, API console).
 *
 * All keys are entered in the admin panel and stored in the `settings` table.
 * Secrets never leave the server — the app only talks to this backend.
 */
import crypto from 'node:crypto';
import { query } from './db.js';

export const DEFAULT_SETTINGS = {
  shopDomain: '',
  apiVersion: '2026-10',
  countryCode: 'IN',
  storefrontToken: '',
  customerClientId: '',
  customerClientSecret: '',
  adminToken: '',
  adminClientId: '',
  adminClientSecret: '',
  loginEnabled: false,
  cartCheckout: false,
  requireLogin: false,
};
export const SECRET_FIELDS = ['storefrontToken', 'customerClientSecret', 'adminToken', 'adminClientSecret'];

/* ───────── Settings ───────── */

let cached = null;
export async function getSettings() {
  if (cached) return cached;
  const { rows } = await query("select value from settings where key = 'shopify'");
  cached = { ...DEFAULT_SETTINGS, ...(rows[0]?.value ?? {}) };
  return cached;
}

const mask = (v) => (v ? `••••${String(v).slice(-4)}` : '');

/** What the admin panel sees: secrets masked. */
export async function getSettingsForAdmin() {
  const s = await getSettings();
  const out = { ...s };
  for (const k of SECRET_FIELDS) out[k] = mask(s[k]);
  return out;
}

export async function saveSettings(input, by) {
  const cur = await getSettings();
  const next = { ...cur };
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (!(k in input)) continue;
    let v = input[k];
    if (SECRET_FIELDS.includes(k)) {
      // Unchanged masked value or empty box → keep what we have. `clear` removes it.
      if (v === mask(cur[k]) || v === '' || v == null) continue;
      v = String(v).trim();
    } else if (typeof DEFAULT_SETTINGS[k] === 'boolean') v = !!v;
    else v = String(v ?? '').trim();
    next[k] = v;
  }
  for (const k of input.clear ?? []) if (SECRET_FIELDS.includes(k)) next[k] = '';
  let d = next.shopDomain.replace(/\/+$/, '');
  // Keep http:// only for a local test server; real stores are always https.
  if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(d)) d = d.replace(/^https?:\/\//, '');
  next.shopDomain = d;
  await query(
    `insert into settings (key, value, updated_at, updated_by) values ('shopify', $1, now(), $2)
     on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
    [JSON.stringify(next), by],
  );
  cached = next;
  discovery = null;
  adminTokenCache = null;
  return getSettingsForAdmin();
}

/** The non-secret switches the app needs (merged into /api/app/config). */
export async function publicShopify() {
  const s = await getSettings();
  const loginReady = !!(s.shopDomain && s.customerClientId && s.customerClientSecret);
  const cartReady = !!(s.shopDomain && s.storefrontToken);
  return {
    loginEnabled: s.loginEnabled && loginReady,
    cartCheckout: s.cartCheckout && cartReady,
    requireLogin: s.requireLogin && s.loginEnabled && loginReady,
  };
}

/* ───────── Helpers ───────── */

export class ShopifyError extends Error {
  constructor(message, status = 502, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

const base = (s) => (/^https?:\/\//.test(s.shopDomain) ? s.shopDomain : `https://${s.shopDomain}`);
const UA = 'RosierAppBackend/1.0';

async function http(url, opts = {}, what = 'Shopify') {
  let res;
  try {
    res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(15000) });
  } catch (e) {
    throw new ShopifyError(`Couldn't reach ${what}. Check the store domain.`, 502, String(e.message || e));
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const msg = json?.error_description || json?.errors?.[0]?.message || json?.errors || json?.error || text.slice(0, 200) || res.statusText;
    throw new ShopifyError(`${what} said: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`, res.status === 401 || res.status === 403 ? res.status : 502, json ?? text);
  }
  return json;
}

function gqlErrors(json, what) {
  if (json?.errors?.length) {
    const m = json.errors.map((e) => e.message).join('; ');
    throw new ShopifyError(`${what} said: ${m}`, 502, json.errors);
  }
}

/* ───────── Customer Account API: discovery & OAuth ───────── */

let discovery = null;
async function discover() {
  const s = await getSettings();
  if (!s.shopDomain) throw new ShopifyError('Shopify store domain is not set in the admin panel.', 503);
  if (discovery && Date.now() - discovery.at < 3600_000) return discovery;
  const oidc = await http(`${base(s)}/.well-known/openid-configuration`, {}, 'Shopify login');
  const api = await http(`${base(s)}/.well-known/customer-account-api`, {}, 'Shopify customer API');
  discovery = {
    at: Date.now(),
    authorize: oidc.authorization_endpoint,
    token: oidc.token_endpoint,
    logout: oidc.end_session_endpoint,
    graphql: api.graphql_api,
  };
  return discovery;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const rand = (n = 32) => b64url(crypto.randomBytes(n));

/** Where the app may ask us to send people back to after logging in. */
export function allowedAppRedirect(u) {
  return /^(rosier|exp|exps):\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u);
}

export async function startLogin(appRedirect, callbackUrl) {
  const s = await getSettings();
  if (!s.customerClientId || !s.customerClientSecret) throw new ShopifyError('Customer login is not set up yet.', 503);
  const d = await discover();
  const state = rand(24);
  const verifier = rand(32);
  const nonce = rand(16);
  await query('insert into oauth_states (state, data) values ($1, $2)', [state, JSON.stringify({ verifier, nonce, appRedirect })]);
  await query("delete from oauth_states where created_at < now() - interval '30 minutes'");
  const url = new URL(d.authorize);
  url.search = new URLSearchParams({
    scope: 'openid email customer-account-api:full',
    client_id: s.customerClientId,
    response_type: 'code',
    redirect_uri: callbackUrl,
    state,
    nonce,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

async function tokenRequest(params) {
  const s = await getSettings();
  const d = await discover();
  const json = await http(
    d.token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${s.customerClientId}:${s.customerClientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ client_id: s.customerClientId, ...params }).toString(),
    },
    'Shopify login',
  );
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? params.refresh_token ?? null,
    idToken: json.id_token ?? null,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  };
}

/** Shopify sends people back here. Swap the code for tokens and hand the app a one-time ticket. */
export async function finishLogin({ code, state }, callbackUrl) {
  const { rows } = await query('delete from oauth_states where state = $1 returning data', [state || '']);
  const saved = rows[0]?.data;
  if (!saved) throw new ShopifyError('This login link has expired. Please try again.', 400);
  if (!code) return { appRedirect: saved.appRedirect, error: 'Login was cancelled' };
  const tokens = await tokenRequest({ grant_type: 'authorization_code', redirect_uri: callbackUrl, code, code_verifier: saved.verifier });
  const ticket = rand(24);
  await query('insert into auth_tickets (ticket, data) values ($1, $2)', [ticket, JSON.stringify(tokens)]);
  await query("delete from auth_tickets where created_at < now() - interval '10 minutes'");
  return { appRedirect: saved.appRedirect, ticket };
}

export async function redeemTicket(ticket) {
  const { rows } = await query("delete from auth_tickets where ticket = $1 and created_at > now() - interval '10 minutes' returning data", [ticket || '']);
  if (!rows[0]) throw new ShopifyError('Login expired. Please try again.', 400);
  return rows[0].data;
}

export const refreshLogin = (refreshToken) => {
  if (!refreshToken) throw new ShopifyError('Please log in again.', 401);
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
};

export async function logoutUrl(idToken) {
  const d = await discover().catch(() => null);
  if (!d?.logout || !idToken) return null;
  return `${d.logout}?${new URLSearchParams({ id_token_hint: idToken })}`;
}

/* ───────── Tracking (shared by logged-in orders and guest lookup) ───────── */

const addressLine = (a) => (a ? [a.address1, a.address2, a.city, a.province, a.zip].filter(Boolean).join(', ') : '');

/** One shipment, in the same shape whichever Shopify API it came from. */
function shipment({ status, latest, createdAt, eta, tracking, events }) {
  const t = (tracking ?? []).find((x) => x?.number || x?.url) ?? (tracking ?? [])[0] ?? {};
  return {
    status: status ?? '',
    latest: latest ?? null,
    createdAt: createdAt ?? null,
    eta: eta ?? null,
    company: t.company ?? '',
    number: t.number ?? '',
    url: t.url ?? '',
    events: (events ?? [])
      .filter((e) => e?.happenedAt && e?.status)
      .map((e) => ({ at: e.happenedAt, status: e.status }))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  };
}

/* ───────── Customer Account API: the logged-in customer ───────── */

const CUSTOMER_QUERY = `query RosierAppCustomer {
  customer {
    id
    firstName
    lastName
    displayName
    imageUrl
    emailAddress { emailAddress }
    phoneNumber { phoneNumber }
    defaultAddress { address1 city zip }
    orders(first: 30, sortKey: PROCESSED_AT, reverse: true) {
      nodes {
        id
        name
        number
        processedAt
        cancelledAt
        financialStatus
        fulfillmentStatus
        statusPageUrl
        totalPrice { amount currencyCode }
        subtotal { amount currencyCode }
        totalShipping { amount }
        shippingAddress { name address1 address2 city province zip }
        fulfillments(first: 10) {
          nodes {
            status
            createdAt
            updatedAt
            estimatedDeliveryAt
            latestShipmentStatus
            trackingInformation { company number url }
            events(first: 30) { nodes { happenedAt status } }
          }
        }
        lineItems(first: 30) {
          nodes { title variantTitle quantity productId variantId image { url } price { amount } totalPrice { amount } }
        }
      }
    }
  }
}`;

export async function customerProfile(accessToken) {
  if (!accessToken) throw new ShopifyError('Please log in again.', 401);
  const d = await discover();
  const json = await http(d.graphql, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: accessToken }, body: JSON.stringify({ query: CUSTOMER_QUERY }) }, 'Shopify customer API');
  gqlErrors(json, 'Shopify customer API');
  const c = json?.data?.customer;
  if (!c) throw new ShopifyError('Please log in again.', 401);
  const num = (m) => Math.round(Number(m?.amount ?? 0));
  const tail = (gid) => (gid ? String(gid).split('/').pop() : null);
  return {
    id: c.id,
    firstName: c.firstName ?? '',
    lastName: c.lastName ?? '',
    name: c.displayName || [c.firstName, c.lastName].filter(Boolean).join(' '),
    email: c.emailAddress?.emailAddress ?? '',
    phone: c.phoneNumber?.phoneNumber ?? '',
    imageUrl: c.imageUrl ?? '',
    address: c.defaultAddress ? [c.defaultAddress.address1, c.defaultAddress.city, c.defaultAddress.zip].filter(Boolean).join(', ') : '',
    orders: (c.orders?.nodes ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      number: o.number,
      processedAt: o.processedAt,
      cancelled: !!o.cancelledAt,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      statusPageUrl: o.statusPageUrl,
      total: num(o.totalPrice),
      subtotal: num(o.subtotal ?? o.totalPrice),
      shipping: num(o.totalShipping),
      address: addressLine(o.shippingAddress),
      shipments: (o.fulfillments?.nodes ?? []).map((f) =>
        shipment({
          status: f.status,
          latest: f.latestShipmentStatus,
          createdAt: f.createdAt,
          eta: f.estimatedDeliveryAt,
          tracking: f.trackingInformation,
          events: f.events?.nodes,
        }),
      ),
      items: (o.lineItems?.nodes ?? []).map((li) => ({
        title: li.title,
        variant: li.variantTitle ?? '',
        qty: li.quantity,
        price: num(li.price),
        total: num(li.totalPrice),
        image: li.image?.url ?? '',
        productId: tail(li.productId),
        variantId: tail(li.variantId),
      })),
    })),
  };
}

/* ───────── Storefront API: logged-in checkout ───────── */

const CART_CREATE = `mutation RosierAppCart($input: CartInput!) {
  cartCreate(input: $input) {
    cart { id checkoutUrl }
    userErrors { field message }
    warnings { code message }
  }
}`;

export async function storefront(queryText, variables) {
  const s = await getSettings();
  if (!s.shopDomain || !s.storefrontToken) throw new ShopifyError('Storefront API is not set up yet.', 503);
  const json = await http(
    `${base(s)}/api/${s.apiVersion}/graphql.json`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': s.storefrontToken }, body: JSON.stringify({ query: queryText, variables }) },
    'Shopify Storefront API',
  );
  gqlErrors(json, 'Shopify Storefront API');
  return json.data;
}

export async function createCheckout({ lines, discountCode, discountCodes, customerAccessToken, note }) {
  const s = await getSettings();
  const clean = (lines ?? [])
    .filter((l) => l && /^\d+$/.test(String(l.variantId)) && Number(l.qty) > 0)
    .map((l) => ({ merchandiseId: `gid://shopify/ProductVariant/${l.variantId}`, quantity: Math.min(50, Number(l.qty)) }));
  if (!clean.length) throw new ShopifyError('Your cart is empty.', 400);
  const codes = [...new Set([...(Array.isArray(discountCodes) ? discountCodes : []), discountCode].filter(Boolean).map((c) => String(c).trim().slice(0, 60)))].slice(0, 5);
  const input = {
    lines: clean,
    attributes: [{ key: 'source', value: 'rosier_app' }],
    buyerIdentity: { countryCode: s.countryCode || 'IN', ...(customerAccessToken ? { customerAccessToken } : {}) },
    ...(codes.length ? { discountCodes: codes } : {}),
    ...(note ? { note: String(note).slice(0, 500) } : {}),
  };
  const data = await storefront(CART_CREATE, { input });
  const r = data?.cartCreate;
  if (r?.userErrors?.length) throw new ShopifyError(r.userErrors.map((e) => e.message).join('; '), 400);
  if (!r?.cart?.checkoutUrl) throw new ShopifyError('Shopify did not return a checkout link.', 502);
  const url = new URL(r.cart.checkoutUrl);
  url.searchParams.set('utm_source', 'rosier_app');
  url.searchParams.set('utm_medium', 'app');
  return { checkoutUrl: url.toString(), cartId: r.cart.id, warnings: r.warnings ?? [] };
}

/* ───────── Coupons: check a code against the customer's real cart ───────── */

const CART_COST = `id discountCodes { code applicable } cost { subtotalAmount { amount } totalAmount { amount } }`;

function cartLines(lines) {
  return (lines ?? [])
    .filter((l) => l && /^\d+$/.test(String(l.variantId)) && Number(l.qty) > 0)
    .slice(0, 50)
    .map((l) => ({ merchandiseId: `gid://shopify/ProductVariant/${l.variantId}`, quantity: Math.min(50, Number(l.qty)) }));
}

/**
 * Builds a throwaway Shopify cart with the customer's items, then adds the code, and
 * reports whether Shopify accepts it and how much it takes off. Nothing is ordered.
 */
export async function checkCoupon({ lines, code }) {
  const s = await getSettings();
  const clean = cartLines(lines);
  const c = String(code ?? '').trim().slice(0, 60);
  if (!c) throw new ShopifyError('Enter a coupon code.', 400);
  if (!clean.length) throw new ShopifyError('Your cart is empty.', 400);
  const created = await storefront(
    `mutation($input: CartInput!) { cartCreate(input: $input) { cart { ${CART_COST} } userErrors { message } } }`,
    { input: { lines: clean, buyerIdentity: { countryCode: s.countryCode || 'IN' } } },
  );
  const cart0 = created?.cartCreate?.cart;
  if (!cart0) throw new ShopifyError(created?.cartCreate?.userErrors?.[0]?.message || 'Could not check this code right now.', 502);
  const updated = await storefront(
    `mutation($id: ID!, $codes: [String!]!) { cartDiscountCodesUpdate(cartId: $id, discountCodes: $codes) { cart { ${CART_COST} } userErrors { message } } }`,
    { id: cart0.id, codes: [c] },
  );
  const cart1 = updated?.cartDiscountCodesUpdate?.cart;
  if (!cart1) throw new ShopifyError(updated?.cartDiscountCodesUpdate?.userErrors?.[0]?.message || 'Could not check this code right now.', 502);
  const hit = (cart1.discountCodes ?? []).find((d) => d.code.toLowerCase() === c.toLowerCase());
  const before = Number(cart0.cost?.totalAmount?.amount ?? 0);
  const after = Number(cart1.cost?.totalAmount?.amount ?? 0);
  return {
    code: hit?.code ?? c,
    applicable: !!hit?.applicable,
    before: Math.round(before),
    after: Math.round(after),
    saving: Math.max(0, Math.round(before - after)),
  };
}

/* ───────── Guest order tracking (order number + email or phone) ───────── */

const digits = (v) => String(v ?? '').replace(/\D/g, '');
const samePhone = (a, b) => {
  const x = digits(a);
  const y = digits(b);
  return x.length >= 10 && y.length >= 10 && x.slice(-10) === y.slice(-10);
};

/**
 * Looks an order up with the Admin API, but only answers if the email or phone
 * matches the order — the same check the website's order-status lookup does.
 */
export async function trackOrder({ order, contact }) {
  const num = digits(order);
  const who = String(contact ?? '').trim().toLowerCase();
  if (!num || !who) throw new ShopifyError('Enter your order number and the email or phone you ordered with.', 400);
  const data = await adminData(
    `query($q: String) {
      orders(first: 3, query: $q) {
        nodes {
          name processedAt cancelledAt displayFulfillmentStatus displayFinancialStatus statusPageUrl email phone
          customer { defaultEmailAddress { emailAddress } defaultPhoneNumber { phoneNumber } }
          shippingAddress { address1 address2 city province zip phone }
          totalPriceSet { shopMoney { amount } }
          lineItems(first: 30) { nodes { title variantTitle quantity image { url } } }
          fulfillments(first: 10) {
            createdAt estimatedDeliveryAt displayStatus status
            trackingInfo(first: 3) { company number url }
            events(first: 30) { nodes { happenedAt status } }
          }
        }
      }
    }`,
    { q: `name:#${num} OR name:${num}` },
  );
  const o = (data?.orders?.nodes ?? []).find((x) => digits(x.name) === num);
  const emails = [o?.email, o?.customer?.defaultEmailAddress?.emailAddress].filter(Boolean).map((e) => e.toLowerCase());
  const phones = [o?.phone, o?.customer?.defaultPhoneNumber?.phoneNumber, o?.shippingAddress?.phone].filter(Boolean);
  const ok = o && (who.includes('@') ? emails.includes(who) : phones.some((p) => samePhone(p, who)));
  // Same answer whether the order doesn't exist or the contact doesn't match.
  if (!ok) throw new ShopifyError('We couldn’t find an order with those details. Check the order number and use the email or phone you ordered with.', 404);
  return {
    name: o.name,
    processedAt: o.processedAt,
    cancelled: !!o.cancelledAt,
    fulfillmentStatus: o.displayFulfillmentStatus,
    financialStatus: o.displayFinancialStatus,
    statusPageUrl: o.statusPageUrl ?? '',
    total: money(o.totalPriceSet),
    address: addressLine(o.shippingAddress),
    items: (o.lineItems?.nodes ?? []).map((l) => ({ title: l.title, variant: l.variantTitle ?? '', qty: l.quantity, image: l.image?.url ?? '' })),
    shipments: (o.fulfillments ?? []).map((f) =>
      shipment({
        status: f.status,
        latest: f.displayStatus,
        createdAt: f.createdAt,
        eta: f.estimatedDeliveryAt,
        tracking: f.trackingInfo,
        events: f.events?.nodes,
      }),
    ),
  };
}

/* ───────── Admin API (admin panel only) ───────── */

let adminTokenCache = null;
async function adminToken() {
  const s = await getSettings();
  if (s.adminToken) return s.adminToken;
  if (!s.adminClientId || !s.adminClientSecret) throw new ShopifyError('Admin API is not set up yet. Add an Admin API token or app client ID + secret.', 503);
  if (adminTokenCache && adminTokenCache.expiresAt > Date.now() + 60_000) return adminTokenCache.token;
  // Dev Dashboard apps: client credentials grant, tokens last ~24h.
  const json = await http(
    `${base(s)}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: s.adminClientId, client_secret: s.adminClientSecret }).toString(),
    },
    'Shopify Admin API',
  );
  adminTokenCache = { token: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 86399) * 1000 };
  return adminTokenCache.token;
}

export async function adminGraphql(queryText, variables) {
  const s = await getSettings();
  if (!s.shopDomain) throw new ShopifyError('Shopify store domain is not set.', 503);
  const token = await adminToken();
  const json = await http(
    `${base(s)}/admin/api/${s.apiVersion}/graphql.json`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query: queryText, variables }) },
    'Shopify Admin API',
  );
  return json;
}

async function adminData(q, v) {
  const json = await adminGraphql(q, v);
  gqlErrors(json, 'Shopify Admin API');
  return json.data;
}

const money = (m) => Math.round(Number(m?.shopMoney?.amount ?? m?.amount ?? 0));

export async function adminOrders({ search = '', after = null } = {}) {
  const q = search;
  const data = await adminData(
    `query($q: String, $after: String) {
      orders(first: 25, after: $after, sortKey: PROCESSED_AT, reverse: true, query: $q) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id name processedAt displayFinancialStatus displayFulfillmentStatus cancelledAt
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { id displayName }
          email
          customAttributes { key value }
          lineItems(first: 10) { nodes { title quantity variantTitle } }
        }
      }
    }`,
    { q: q || null, after },
  );
  const c = data.orders;
  return {
    hasNext: c.pageInfo.hasNextPage,
    cursor: c.pageInfo.endCursor,
    orders: c.nodes.map((o) => ({
      id: o.id,
      name: o.name,
      date: o.processedAt,
      customer: o.customer?.displayName || o.email || 'Guest',
      email: o.email ?? '',
      total: money(o.totalPriceSet),
      payment: o.displayFinancialStatus,
      fulfillment: o.displayFulfillmentStatus,
      cancelled: !!o.cancelledAt,
      fromApp: (o.customAttributes ?? []).some((a) => a.key === 'source' && a.value === 'rosier_app'),
      items: o.lineItems.nodes.map((l) => `${l.title}${l.variantTitle ? ` (${l.variantTitle})` : ''} × ${l.quantity}`),
    })),
  };
}

export async function adminCustomers({ search = '', after = null } = {}) {
  const data = await adminData(
    `query($q: String, $after: String) {
      customers(first: 25, after: $after, sortKey: UPDATED_AT, reverse: true, query: $q) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id displayName createdAt state tags
          defaultEmailAddress { emailAddress }
          defaultPhoneNumber { phoneNumber }
          numberOfOrders
          amountSpent { amount currencyCode }
        }
      }
    }`,
    { q: search || null, after },
  );
  const c = data.customers;
  return {
    hasNext: c.pageInfo.hasNextPage,
    cursor: c.pageInfo.endCursor,
    customers: c.nodes.map((x) => ({
      id: x.id,
      name: x.displayName,
      email: x.defaultEmailAddress?.emailAddress ?? '',
      phone: x.defaultPhoneNumber?.phoneNumber ?? '',
      orders: Number(x.numberOfOrders ?? 0),
      spent: Math.round(Number(x.amountSpent?.amount ?? 0)),
      since: x.createdAt,
      state: x.state,
      tags: x.tags ?? [],
    })),
  };
}

/** Active discount codes from Shopify, for the admin panel's "Import from Shopify" button. */
export async function adminDiscountCodes() {
  const min = `minimumRequirement { __typename ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } } }`;
  const common = `title status startsAt endsAt codes(first: 1) { nodes { code } }`;
  let data;
  try {
    data = await adminData(`{
      codeDiscountNodes(first: 50, query: "status:active") {
        nodes {
          id
          codeDiscount {
            __typename
            ... on DiscountCodeBasic { ${common} ${min} customerGets { value { __typename ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } } }
            ... on DiscountCodeFreeShipping { ${common} ${min} }
            ... on DiscountCodeBxgy { ${common} }
          }
        }
      }
    }`);
  } catch (e) {
    if (/access|scope|denied/i.test(e.message)) throw new ShopifyError('Your Shopify app needs the read_discounts permission. Add it in the app’s Admin API scopes, then try again.', 403);
    throw e;
  }
  return (data?.codeDiscountNodes?.nodes ?? [])
    .map((n) => {
      const d = n.codeDiscount ?? {};
      const code = d.codes?.nodes?.[0]?.code;
      if (!code) return null;
      const v = d.customerGets?.value;
      const minOrder = Math.round(Number(d.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount ?? 0));
      let kind = 'other';
      let value = 0;
      if (d.__typename === 'DiscountCodeFreeShipping') kind = 'freeship';
      else if (v?.__typename === 'DiscountPercentage') (kind = 'percent'), (value = Math.round(Number(v.percentage) * 100));
      else if (v?.__typename === 'DiscountAmount') (kind = 'flat'), (value = Math.round(Number(v.amount?.amount ?? 0)));
      return { code, title: d.title || code, kind, value, minOrder, startAt: d.startsAt ?? '', endAt: d.endsAt ?? '' };
    })
    .filter(Boolean);
}

/* ───────── "Test connection" buttons ───────── */

export async function testConnection(kind) {
  const s = await getSettings();
  if (!s.shopDomain) throw new ShopifyError('Enter your store domain first.', 400);
  if (kind === 'storefront') {
    const d = await storefront('{ shop { name primaryDomain { url } } }');
    return `Connected to ${d.shop.name} (${d.shop.primaryDomain?.url ?? s.shopDomain}).`;
  }
  if (kind === 'customer') {
    if (!s.customerClientId || !s.customerClientSecret) throw new ShopifyError('Enter the Customer Account API client ID and secret first.', 400);
    discovery = null;
    const d = await discover();
    return `Login is reachable. Customers will sign in at ${new URL(d.authorize).host}.`;
  }
  if (kind === 'admin') {
    const d = await adminData('{ shop { name myshopifyDomain } }');
    return `Admin API connected to ${d.shop.name} (${d.shop.myshopifyDomain}).`;
  }
  throw new ShopifyError('Unknown test', 400);
}
