/**
 * App-only numbers for the admin dashboard: sessions & live visitors (from app pings)
 * and sales / orders placed through the app (Shopify orders tagged source=rosier_app).
 */
import { query } from './db.js';
import * as shopify from './shopify.js';

const clip = (s, n) => String(s ?? '').slice(0, n);
const tail = (gid) => (gid ? String(gid).split('/').pop() : null);

/** Called by the app on open / every minute while it's in front. */
export async function ping({ deviceId, platform, customerId }) {
  const d = clip(deviceId, 80);
  if (!d) return { ok: false };
  const { rows } = await query("select id from app_sessions where device_id = $1 and last_seen > now() - interval '30 minutes' order by id desc limit 1", [d]);
  if (rows[0]) await query('update app_sessions set last_seen = now(), customer_id = coalesce($2, customer_id) where id = $1', [rows[0].id, tail(customerId)]);
  else await query('insert into app_sessions (device_id, customer_id, platform) values ($1, $2, $3)', [d, tail(customerId), clip(platform, 20)]);
  return { ok: true };
}

export async function live() {
  const { rows } = await query(
    `select count(distinct device_id)::int as n,
            count(distinct device_id) filter (where platform = 'android')::int as android,
            count(distinct device_id) filter (where platform = 'ios')::int as ios
       from app_sessions where last_seen > now() - interval '5 minutes'`,
  );
  return rows[0];
}

const day = (d) => new Date(d).toISOString().slice(0, 10);

async function sessionStats(from, to) {
  const { rows } = await query(
    `select count(*)::int as sessions, count(distinct device_id)::int as users
       from app_sessions where started_at >= $1 and started_at < $2`,
    [from, to],
  );
  const daily = await query(
    `select to_char(started_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d, count(*)::int as n
       from app_sessions where started_at >= $1 and started_at < $2 group by 1`,
    [from, to],
  );
  const fresh = await query(
    `select count(*)::int as n from (select device_id, min(started_at) as first from app_sessions group by device_id) x where first >= $1 and first < $2`,
    [from, to],
  );
  return { ...rows[0], newUsers: fresh.rows[0].n, daily: Object.fromEntries(daily.rows.map((r) => [r.d, r.n])) };
}

const money = (m) => Number(m?.shopMoney?.amount ?? 0);
const isApp = (o) => (o.customAttributes ?? []).some((a) => a.key === 'source' && a.value === 'rosier_app');
const istDay = (iso) => new Date(Date.parse(iso) + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** All orders in the range (light fields), then line items for the app ones. */
async function orderStats(from, to) {
  const all = [];
  let after = null;
  for (let page = 0; page < 12; page++) {
    const json = await shopify.adminGraphql(
      `query($q: String, $after: String) {
        orders(first: 250, after: $after, sortKey: CREATED_AT, reverse: true, query: $q) {
          pageInfo { hasNextPage endCursor }
          nodes { id name createdAt cancelledAt displayFinancialStatus totalPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } } customAttributes { key value } customer { displayName } }
        }
      }`,
      { q: `created_at:>='${from.toISOString()}' created_at:<'${to.toISOString()}'`, after },
    );
    if (json?.errors?.length) throw new shopify.ShopifyError(json.errors[0].message, 502);
    const c = json?.data?.orders;
    if (!c) break;
    all.push(...c.nodes);
    if (!c.pageInfo.hasNextPage) break;
    after = c.pageInfo.endCursor;
  }
  const valid = all.filter((o) => !o.cancelledAt);
  const app = valid.filter(isApp);
  const sum = (list) => list.reduce((n, o) => n + money(o.totalPriceSet), 0);
  const daily = {};
  for (const o of app) {
    const d = istDay(o.createdAt);
    daily[d] = daily[d] || { sales: 0, orders: 0 };
    daily[d].sales += money(o.totalPriceSet);
    daily[d].orders += 1;
  }
  return {
    sales: sum(app),
    orders: app.length,
    discounts: app.reduce((n, o) => n + money(o.totalDiscountsSet), 0),
    storeSales: sum(valid),
    storeOrders: valid.length,
    daily,
    appOrders: app,
  };
}

async function topProducts(orders) {
  const ids = orders.slice(0, 150).map((o) => o.id);
  const counts = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const json = await shopify.adminGraphql(
      `query($ids: [ID!]!) { nodes(ids: $ids) { ... on Order { lineItems(first: 20) { nodes { title quantity originalTotalSet { shopMoney { amount } } } } } } }`,
      { ids: ids.slice(i, i + 50) },
    );
    for (const n of json?.data?.nodes ?? []) {
      for (const li of n?.lineItems?.nodes ?? []) {
        const c = counts.get(li.title) || { title: li.title, qty: 0, sales: 0 };
        c.qty += li.quantity;
        c.sales += money(li.originalTotalSet);
        counts.set(li.title, c);
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.sales - a.sales).slice(0, 8);
}

const cache = new Map();

/** Dashboard for the last `days` days (1 = today), compared with the period before. */
export async function dashboard(days = 7) {
  const n = [1, 7, 30, 90].includes(Number(days)) ? Number(days) : 7;
  const hit = cache.get(n);
  if (hit && Date.now() - hit.at < 120_000) return hit.data;
  // Days in India time.
  const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
  const startIst = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - (n - 1) * 86400000;
  const from = new Date(startIst - 5.5 * 3600 * 1000);
  const to = new Date();
  const prevFrom = new Date(from.getTime() - n * 86400000);
  const prevTo = from;

  const [sess, prevSess, liveNow] = await Promise.all([sessionStats(from, to), sessionStats(prevFrom, prevTo), live()]);
  let orders = null;
  let prev = null;
  let top = [];
  let ordersError = null;
  try {
    [orders, prev] = await Promise.all([orderStats(from, to), orderStats(prevFrom, prevTo)]);
    top = await topProducts(orders.appOrders).catch(() => []);
  } catch (e) {
    ordersError = e.message;
  }
  const series = [];
  for (let i = 0; i < n; i++) {
    const d = day(startIst + i * 86400000);
    series.push({ d, sessions: sess.daily[d] || 0, sales: Math.round(orders?.daily[d]?.sales || 0), orders: orders?.daily[d]?.orders || 0 });
  }
  const conv = (o, s) => (s ? (o / s) * 100 : 0);
  const data = {
    days: n,
    live: liveNow,
    sessions: { now: sess.sessions, prev: prevSess.sessions },
    users: { now: sess.users, prev: prevSess.users },
    newUsers: { now: sess.newUsers, prev: prevSess.newUsers },
    sales: { now: Math.round(orders?.sales ?? 0), prev: Math.round(prev?.sales ?? 0) },
    orders: { now: orders?.orders ?? 0, prev: prev?.orders ?? 0 },
    aov: { now: orders?.orders ? Math.round(orders.sales / orders.orders) : 0, prev: prev?.orders ? Math.round(prev.sales / prev.orders) : 0 },
    conversion: { now: conv(orders?.orders ?? 0, sess.sessions), prev: conv(prev?.orders ?? 0, prevSess.sessions) },
    discounts: Math.round(orders?.discounts ?? 0),
    share: orders?.storeSales ? (orders.sales / orders.storeSales) * 100 : 0,
    storeSales: Math.round(orders?.storeSales ?? 0),
    series,
    top,
    recent: (orders?.appOrders ?? []).slice(0, 12).map((o) => ({ name: o.name, at: o.createdAt, total: Math.round(money(o.totalPriceSet)), customer: o.customer?.displayName || 'Guest', status: o.displayFinancialStatus })),
    ordersError,
  };
  cache.set(n, { at: Date.now(), data });
  return data;
}
