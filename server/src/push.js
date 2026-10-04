/**
 * Phone notifications (Expo push service → Firebase on Android, Apple on iOS).
 *
 *  - Phones register their push token (+ the Shopify customer, if logged in).
 *  - The admin panel sends campaigns (now, or by publishing a notification with
 *    "Also send to phones" ticked), to everyone / members / logged-in customers.
 *  - Order updates (placed → shipped → out for delivery → delivered / cancelled)
 *    go to the customer's phones. Shopify webhooks make it instant; a poller every
 *    few minutes is the safety net. Every send is logged so nothing goes twice.
 */
import crypto from 'node:crypto';
import { query } from './db.js';
import * as shopify from './shopify.js';
import * as fcm from './fcm.js';

const EXPO_URL = process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = process.env.EXPO_RECEIPTS_URL || EXPO_URL.replace(/\/send$/, '/getReceipts');
const isExpoToken = (t) => /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(t);
export const SOUNDS = ['default', 'chime', 'bell', 'coin', 'soft'];

const tail = (gid) => (gid ? String(gid).split('/').pop() : null);
const clip = (s, n) => String(s ?? '').slice(0, n);

/* ───────── Devices ───────── */

/**
 * A phone with notifications allowed. `token` is its Expo push token; phones that
 * couldn't get one (no Firebase yet) register with only `deviceId` and get their
 * notifications through the background check instead.
 */
export async function register({ token, fcmToken, deviceId, platform, customerId, email, phone, name, member }) {
  const dev = clip(deviceId, 80);
  let t = clip(token, 300);
  const f = String(fcmToken || '').trim();
  if (!isExpoToken(t)) {
    if (/^[\w:-]{20,400}$/.test(f)) t = `fcm:${f}`; // Android Firebase token — we send to it directly
    else {
      if (!/^[\w-]{6,80}$/.test(dev)) throw Object.assign(new Error('Not a push token'), { status: 400 });
      t = `device:${dev}`;
    }
  }
  if (dev && !t.startsWith('device:')) {
    // Real push works for this phone now: retire its other rows (fallback / old tokens).
    await query('update push_devices set enabled = false where device_id = $1 and token <> $2', [dev, t]);
  }
  await query(
    `insert into push_devices (token, device_id, platform, customer_id, email, phone, name, member, enabled, last_seen)
     values ($1, $2, $3, $4, $5, $6, $7, $8, true, now())
     on conflict (token) do update set device_id = $2, platform = $3, customer_id = $4, email = $5, phone = $6, name = $7, member = $8, enabled = true, last_seen = now(),
       push_ok = case when push_devices.token like 'fcm:%' then push_devices.push_ok else null end`,
    [t, dev, clip(platform, 20), tail(customerId), clip(email, 200) || null, clip(phone, 40) || null, clip(name, 80) || null, !!member],
  );
  return { ok: true, mode: t.startsWith('device:') ? 'background' : t.startsWith('fcm:') && !(await fcm.configured()) ? 'waiting' : 'push' };
}

export async function unregister(token) {
  await query('update push_devices set enabled = false where token = $1', [clip(token, 300)]);
}

export async function stats() {
  const { rows } = await query(
    `select count(*) filter (where enabled)::int as devices,
            count(*) filter (where enabled and customer_id is not null)::int as logged_in,
            count(*) filter (where enabled and member)::int as members,
            count(*) filter (where enabled and platform = 'android')::int as android,
            count(*) filter (where enabled and platform = 'ios')::int as ios,
            count(*) filter (where enabled and (token like 'device:%' or push_ok = false))::int as background,
            count(*) filter (where enabled and token like 'fcm:%')::int as fcm,
            count(*) filter (where enabled and push_ok)::int as push_ok
       from push_devices`,
  );
  return rows[0];
}

async function tokensFor(audience) {
  const where =
    {
      all: 'true',
      members: 'member',
      logged_in: 'customer_id is not null',
      guests: 'customer_id is null',
      non_members: 'not member',
    }[audience] ?? 'true';
  const { rows } = await query(`select token, device_id, push_ok from push_devices where enabled and ${where}`);
  return rows;
}

/* ───────── Sending ───────── */

function soundFields(sound) {
  const s = SOUNDS.includes(sound) ? sound : 'default';
  return s === 'default' ? { sound: 'default', channelId: 'rosier_default' } : { sound: `rosier_${s}.wav`, channelId: `rosier_${s}` };
}

const outbox = (deviceId, title, body, data) =>
  deviceId ? query('insert into push_outbox (device_id, title, body, data) values ($1, $2, $3, $4)', [deviceId, clip(title, 120), clip(body, 400), JSON.stringify(data)]) : null;

/**
 * Sends one message to many phones ({token, device_id, push_ok} rows).
 * Real push via Expo; phones without working push get it in their outbox instead.
 */
export async function sendTo(targets, { title, body, data = {}, sound = 'default' }) {
  data = { ...data, sound };
  const seen = new Set();
  const list = targets.filter((x) => x?.token && !seen.has(x.token) && seen.add(x.token));
  let sent = 0;
  let failed = 0;
  const viaPush = [];
  const viaFcm = [];
  const fcmOn = await fcm.configured();
  for (const x of list) {
    if (x.token.startsWith('fcm:') && fcmOn) viaFcm.push(x);
    else if (!isExpoToken(x.token) || x.push_ok === false) {
      await outbox(x.device_id, title, body, data);
      sent++;
    } else viaPush.push(x);
  }
  // Android phones straight through Firebase (a few at a time).
  for (let i = 0; i < viaFcm.length; i += 20) {
    const batch = viaFcm.slice(i, i + 20);
    const results = await Promise.all(batch.map((x) => fcm.send(x.token.slice(4), { title, body, data, sound })));
    for (let k = 0; k < batch.length; k++) {
      const x = batch[k];
      if (results[k] === 'ok') {
        sent++;
        if (x.push_ok !== true) await query('update push_devices set push_ok = true where token = $1', [x.token]);
      } else if (results[k] === 'gone') {
        failed++;
        await unregister(x.token);
      } else {
        await query('update push_devices set push_ok = false where token = $1', [x.token]);
        await outbox(x.device_id, title, body, data);
        sent++;
      }
    }
  }
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  for (let i = 0; i < viaPush.length; i += 100) {
    const batch = viaPush.slice(i, i + 100);
    const messages = batch.map((x) => ({ to: x.token, title: clip(title, 120), body: clip(body, 400), data, priority: 'high', ...soundFields(sound) }));
    let tickets = [];
    try {
      const res = await fetch(EXPO_URL, { method: 'POST', headers, body: JSON.stringify(messages) });
      const json = await res.json().catch(() => ({}));
      tickets = Array.isArray(json.data) ? json.data : [];
    } catch {
      tickets = [];
    }
    for (let k = 0; k < batch.length; k++) {
      const x = batch[k];
      const t = tickets[k];
      if (t?.status === 'ok') {
        sent++;
        if (t.id) await query('insert into push_tickets (id, token, device_id, title, body, data) values ($1, $2, $3, $4, $5, $6) on conflict do nothing', [t.id, x.token, x.device_id, clip(title, 120), clip(body, 400), JSON.stringify(data)]);
      } else if (t?.details?.error === 'DeviceNotRegistered') {
        failed++;
        await unregister(x.token);
      } else {
        // Push isn't working for this phone (e.g. Firebase not set up) — use the background check.
        await query('update push_devices set push_ok = false where token = $1', [x.token]);
        await outbox(x.device_id, title, body, data);
        sent++;
      }
    }
  }
  return { sent, failed };
}

/** Expo receipts say whether Firebase/Apple really accepted each push; failed ones go to the outbox. */
export async function checkReceipts() {
  const { rows } = await query("select * from push_tickets where created_at < now() - interval '30 seconds' order by created_at limit 300");
  if (!rows.length) return;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  let receipts = {};
  try {
    const res = await fetch(RECEIPTS_URL, { method: 'POST', headers, body: JSON.stringify({ ids: rows.map((r) => r.id) }) });
    receipts = (await res.json())?.data ?? {};
  } catch {
    return;
  }
  for (const r of rows) {
    const rc = receipts[r.id];
    const old = Date.now() - new Date(r.created_at).getTime() > 24 * 3600 * 1000;
    if (!rc && !old) continue; // not ready yet
    if (rc?.status === 'ok') await query('update push_devices set push_ok = true where token = $1', [r.token]);
    else if (rc?.details?.error === 'DeviceNotRegistered') await unregister(r.token);
    else if (rc) {
      await query('update push_devices set push_ok = false where token = $1', [r.token]);
      await outbox(r.device_id, r.title, r.body, r.data);
    }
    await query('delete from push_tickets where id = $1', [r.id]);
  }
}

/** The app asks for messages it hasn't shown yet (background check / app open). */
export async function pending(deviceId, after = 0) {
  const { rows } = await query(
    "select id, title, body, data from push_outbox where device_id = $1 and id > $2 and created_at > now() - interval '3 days' order by id limit 20",
    [clip(deviceId, 80), Number(after) || 0],
  );
  await query("delete from push_outbox where created_at < now() - interval '4 days'");
  return rows;
}

async function soundSetting() {
  const { rows } = await query("select published from content where key = 'push'");
  return rows[0]?.published ?? {};
}

/** Admin "Send now" (and publish-triggered campaigns). */
export async function campaign({ title, body, link = '', audience = 'all', kind = 'campaign', ref = null, by = null }) {
  if (!String(title || '').trim()) throw Object.assign(new Error('Add a title'), { status: 400 });
  const cfg = await soundSetting();
  if (cfg.enabled === false) throw Object.assign(new Error('Phone notifications are switched off (Phone notifications → main switch).'), { status: 400 });
  if (ref) {
    const done = await query('select 1 from push_log where kind = $1 and ref = $2', [kind, ref]);
    if (done.rows.length) return { skipped: true };
  }
  const tokens = await tokensFor(audience);
  const id = ref || `c-${Date.now().toString(36)}`;
  if (!tokens.length) throw Object.assign(new Error('No phones have notifications turned on yet. People need the new app version and to tap “Turn on notifications”.'), { status: 400 });
  const r = await sendTo(tokens, { title, body, sound: cfg.sound, data: { id, link, kind } });
  await query('insert into push_log (kind, ref, title, body, audience, sent, failed, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict do nothing', [
    kind,
    ref,
    clip(title, 200),
    clip(body, 1000),
    audience,
    r.sent,
    r.failed,
    by,
  ]);
  return { ...r, devices: tokens.length };
}

export async function history(limit = 50) {
  const { rows } = await query("select id, kind, ref, title, body, audience, sent, failed, created_at, created_by from push_log where audience <> 'not sent' order by id desc limit $1", [limit]);
  return rows;
}

/** After publishing: send any notification / member update marked "also send to phones" (once each). */
export async function afterPublish() {
  const { rows } = await query("select key, published from content where key in ('announcements', 'benefits')");
  const by = Object.fromEntries(rows.map((r) => [r.key, r.published]));
  const now = Date.now();
  const live = (x) => x && x.enabled !== false && (!x.startAt || Date.parse(x.startAt) <= now) && (!x.endAt || Date.parse(x.endAt) >= now);
  const out = [];
  for (const a of by.announcements?.items ?? []) {
    if (!a?.push || !a.id || !a.title || !live(a)) continue;
    out.push(await campaign({ title: a.title, body: a.body, link: a.link, audience: a.audience || 'all', kind: 'announcement', ref: a.id, by: 'publish' }).catch((e) => ({ error: e.message })));
  }
  for (const u of by.benefits?.updates ?? []) {
    if (!u?.push || !u.id || !u.title || !live(u)) continue;
    out.push(await campaign({ title: u.title, body: u.body, link: u.link || 'app:/benefits-club', audience: 'members', kind: 'member_update', ref: u.id, by: 'publish' }).catch((e) => ({ error: e.message })));
  }
  return out;
}

/* ───────── Order updates ───────── */

const ORDER_FIELDS = `id name createdAt cancelledAt displayFulfillmentStatus email
  customer { id firstName }
  customAttributes { key value }
  fulfillments(first: 5) { displayStatus trackingInfo(first: 1) { company number } }`;

/** placed / shipped / out / delivered / cancelled */
function statusOf(o) {
  if (o.cancelledAt) return 'cancelled';
  const ds = (o.fulfillments ?? []).map((f) => f.displayStatus);
  if (ds.includes('DELIVERED') || ds.includes('PICKED_UP')) return 'delivered';
  if (ds.includes('OUT_FOR_DELIVERY') || ds.includes('READY_FOR_PICKUP')) return 'out';
  if ((o.fulfillments ?? []).length || o.displayFulfillmentStatus === 'FULFILLED') return 'shipped';
  return 'placed';
}

const DEFAULT_TEXT = {
  placed: ['Order {order} confirmed 🎉', 'Thanks {name}! We’re packing it with love.'],
  shipped: ['Order {order} is on its way 🚚', 'Shipped with {courier}. Tap to track it live.'],
  out: ['Arriving today 🛵', 'Order {order} is out for delivery. Keep your phone handy!'],
  delivered: ['Delivered ✅', 'Order {order} has reached you. Enjoy, and tell us how you liked it!'],
  cancelled: ['Order {order} cancelled', 'Your order was cancelled. Any payment will be refunded to the original method.'],
};

async function devicesForOrder(o) {
  const cust = tail(o.customer?.id);
  const dev = (o.customAttributes ?? []).find((a) => a.key === 'app_device')?.value;
  const { rows } = await query('select token, device_id, push_ok from push_devices where enabled and ((customer_id is not null and customer_id = $1) or (device_id is not null and device_id = $2))', [cust ?? '', dev ?? '']);
  return rows;
}

/** Looks at one order and notifies the customer if its status moved on. */
export async function checkOrder(o, { quietIfNew = false } = {}) {
  if (!o?.id) return null;
  const status = statusOf(o);
  const seen = await query("select ref from push_log where kind = 'order' and ref like $1", [`${o.id}:%`]);
  const already = new Set(seen.rows.map((r) => r.ref.split(':').pop()));
  if (already.has(status)) return null;
  const cfg = await soundSetting();
  const on = cfg.enabled !== false && cfg.orders?.[status]?.enabled !== false;
  // First time we see an older order: just remember where it is, don't message.
  const old = Date.now() - Date.parse(o.createdAt) > 2 * 3600 * 1000;
  const silent = !on || (quietIfNew && already.size === 0 && old);
  const tokens = silent ? [] : await devicesForOrder(o);
  const t = cfg.orders?.[status] ?? {};
  const fill = (s) =>
    String(s || '')
      .replaceAll('{order}', o.name || '')
      .replaceAll('{name}', o.customer?.firstName || 'there')
      .replaceAll('{courier}', o.fulfillments?.[0]?.trackingInfo?.[0]?.company || 'our courier');
  const title = fill(t.title || DEFAULT_TEXT[status][0]);
  const body = fill(t.body || DEFAULT_TEXT[status][1]);
  const r = tokens.length ? await sendTo(tokens, { title, body, sound: cfg.sound, data: { id: `o-${tail(o.id)}-${status}`, kind: 'order', link: `app:/track?order=${encodeURIComponent(o.name)}`, order: o.name, status } }) : { sent: 0, failed: 0 };
  await query("insert into push_log (kind, ref, title, body, audience, sent, failed) values ('order', $1, $2, $3, $4, $5, $6) on conflict do nothing", [
    `${o.id}:${status}`,
    title,
    body,
    silent ? 'not sent' : `order ${o.name}`,
    r.sent,
    r.failed,
  ]);
  return { status, ...r };
}

export async function checkOrderById(id) {
  const gid = String(id).startsWith('gid://') ? String(id) : `gid://shopify/Order/${id}`;
  const json = await shopify.adminGraphql(`query($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id: gid });
  return checkOrder(json?.data?.order);
}

let lastPoll = 0;
let polling = false;
/** Safety net: look at recently updated orders every few minutes. */
export async function poll() {
  if (polling || Date.now() - lastPoll < 4 * 60 * 1000) return;
  polling = true;
  lastPoll = Date.now();
  try {
    const s = await shopify.getSettings();
    if (!s.shopDomain || !(s.adminToken || (s.adminClientId && s.adminClientSecret))) return;
    await checkReceipts().catch(() => {});
    const { rows } = await query('select count(*)::int as n from push_devices where enabled');
    if (!rows[0].n) return;
    const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const json = await shopify.adminGraphql(`query($q: String) { orders(first: 60, sortKey: UPDATED_AT, reverse: true, query: $q) { nodes { ${ORDER_FIELDS} } } }`, { q: `updated_at:>'${since}'` });
    for (const o of json?.data?.orders?.nodes ?? []) await checkOrder(o, { quietIfNew: true }).catch(() => {});
  } catch {
    /* Admin API not reachable — try next time */
  } finally {
    polling = false;
  }
}

/* ───────── Shopify webhooks ───────── */

export function verifyWebhook(raw, hmac, secret) {
  if (!secret || !hmac || !raw) return false;
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(String(hmac));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const WEBHOOK_TOPICS = ['ORDERS_CREATE', 'ORDERS_CANCELLED', 'ORDERS_FULFILLED', 'FULFILLMENTS_CREATE', 'FULFILLMENTS_UPDATE'];

export async function registerWebhooks(uri) {
  const out = [];
  const existing = await shopify.adminGraphql('{ webhookSubscriptions(first: 50) { nodes { id topic uri } } }');
  const have = new Set((existing?.data?.webhookSubscriptions?.nodes ?? []).filter((w) => w.uri === uri).map((w) => w.topic));
  for (const topic of WEBHOOK_TOPICS) {
    if (have.has(topic)) {
      out.push({ topic, ok: true, note: 'already on' });
      continue;
    }
    const r = await shopify.adminGraphql(
      `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { webhookSubscription { id } userErrors { message } }
      }`,
      { topic, sub: { uri, format: 'JSON' } },
    );
    const err = r?.errors?.[0]?.message || r?.data?.webhookSubscriptionCreate?.userErrors?.[0]?.message;
    out.push({ topic, ok: !err, note: err || 'turned on' });
  }
  return out;
}
