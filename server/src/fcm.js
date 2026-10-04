/**
 * Direct Firebase Cloud Messaging (FCM HTTP v1) — sends notifications straight to
 * Android phones, so they show in the phone's notification bar even when the app is
 * closed. Needs only a Firebase service-account key (pasted in the admin panel →
 * Phone notifications → Firebase). No Expo account needed.
 *
 * The key is stored server-side and never shown again (only the project and
 * account email are displayed).
 */
import crypto from 'node:crypto';
import { query } from './db.js';

const TOKEN_URL = process.env.FCM_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const FCM_BASE = (process.env.FCM_BASE_URL || 'https://fcm.googleapis.com').replace(/\/$/, '');

let cached; // { project_id, client_email, private_key } | null
let access = null; // { token, exp }

async function account() {
  if (cached !== undefined) return cached;
  const { rows } = await query("select value from settings where key = 'firebase'");
  const v = rows[0]?.value;
  cached = v?.project_id && v?.client_email && v?.private_key ? v : null;
  return cached;
}

export async function configured() {
  return !!(await account());
}

/** What the admin panel sees (never the private key). */
export async function adminView() {
  const a = await account();
  return a ? { configured: true, projectId: a.project_id, clientEmail: a.client_email } : { configured: false };
}

/** Saves the service-account JSON downloaded from Firebase. */
export async function saveKey(raw, by) {
  let j;
  try {
    j = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw Object.assign(new Error('That isn’t the key file. Paste the whole contents of the .json file Firebase downloaded.'), { status: 400 });
  }
  if (j?.type !== 'service_account' || !j.project_id || !j.client_email || !String(j.private_key || '').includes('PRIVATE KEY'))
    throw Object.assign(new Error('This doesn’t look like a Firebase service-account key (Project settings → Service accounts → Generate new private key).'), { status: 400 });
  try {
    crypto.createPrivateKey(j.private_key);
  } catch {
    throw Object.assign(new Error('The private key in this file is damaged. Generate a new one in Firebase.'), { status: 400 });
  }
  const value = { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key, token_uri: j.token_uri || TOKEN_URL };
  await query(
    `insert into settings (key, value, updated_at, updated_by) values ('firebase', $1, now(), $2)
     on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
    [JSON.stringify(value), by],
  );
  cached = value;
  access = null;
  await accessToken(); // proves the key works
  return adminView();
}

export async function removeKey() {
  await query("delete from settings where key = 'firebase'");
  cached = null;
  access = null;
}

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function accessToken() {
  if (access && access.exp > Date.now() + 60_000) return access.token;
  const a = await account();
  if (!a) throw new Error('Firebase not set up');
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = b64url(crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claim}`), a.private_key));
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw Object.assign(new Error(`Firebase refused the key: ${j.error_description || j.error || res.status}`), { status: 400 });
  access = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return access.token;
}

/**
 * Sends one notification. Returns 'ok', 'gone' (app uninstalled / token dead) or 'error'.
 * `sound` is one of default/chime/bell/coin/soft; Android channels match the app's.
 */
export async function send(token, { title, body, data = {}, sound = 'default' }) {
  const a = await account();
  if (!a) return 'error';
  const s = sound && sound !== 'default' ? sound : null;
  const strData = {};
  for (const [k, v] of Object.entries(data ?? {})) if (v != null && v !== '') strData[k] = typeof v === 'string' ? v : JSON.stringify(v);
  const message = {
    token,
    notification: { title: String(title).slice(0, 120), body: String(body || '').slice(0, 400) },
    data: strData,
    android: {
      priority: 'HIGH',
      notification: { channel_id: s ? `rosier_${s}` : 'rosier_default', sound: s ? `rosier_${s}` : 'default', default_vibrate_timings: true },
    },
  };
  try {
    const res = await fetch(`${FCM_BASE}/v1/projects/${a.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return 'ok';
    const j = await res.json().catch(() => ({}));
    const code = j?.error?.details?.find?.((d) => d.errorCode)?.errorCode || j?.error?.status;
    if (res.status === 404 || code === 'UNREGISTERED' || (code === 'INVALID_ARGUMENT' && /token/i.test(j?.error?.message || ''))) return 'gone';
    if (res.status === 401 || res.status === 403) access = null;
    console.warn('FCM send failed:', res.status, code, j?.error?.message);
    return 'error';
  } catch (e) {
    console.warn('FCM send failed:', e.message);
    return 'error';
  }
}

/** Admin "Send test" — checks the key works with Google right now. */
export async function test() {
  access = null;
  await accessToken();
  return { message: 'Firebase key works. Phones with the new app version get notifications instantly.' };
}
