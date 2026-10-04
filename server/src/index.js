import compression from 'compression';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as auth from './auth.js';
import * as content from './content.js';
import { connect } from './db.js';
import { deleteImage, listImages, MAX_VIDEO_BYTES, serveImage, storeImage } from './images.js';
import { listProducts } from './products.js';
import { SCHEMA, SECTION_KEYS } from './schema.js';
import * as shopify from './shopify.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const db = await connect();
await content.seed();
await auth.bootstrapAdmin();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", 'blob:', 'https:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Login opens Shopify in a popup/auth window that must be able to hand back to the app.
    crossOriginOpenerPolicy: false,
  }),
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const baseUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

/* ───────── Public ───────── */

app.get('/healthz', (_req, res) => res.json({ ok: true, db: db.kind }));

// The app (and the web preview) call these from anywhere; no cookies are involved.
app.use(['/api/app', '/api/auth', '/api/customer', '/api/checkout', '/api/store'], (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Customer-Token, If-None-Match');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get(
  '/api/app/config',
  wrap(async (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.set('Access-Control-Allow-Origin', '*');
    if (req.query.preview) {
      if (!auth.verifyPreview(String(req.query.preview))) return res.status(401).json({ error: 'Preview link expired' });
      return res.json({ ...(await content.draftConfig(baseUrl(req))), shopify: await shopify.publicShopify() });
    }
    const cfg = await content.publicConfig(baseUrl(req));
    const shop = await shopify.publicShopify();
    const flags = `${+shop.loginEnabled}${+shop.cartCheckout}${+shop.requireLogin}`;
    const etag = `"v${cfg.version}-${flags}"`;
    res.set('ETag', etag);
    if (req.get('If-None-Match') === etag) return res.status(304).end();
    res.json({ ...cfg, shopify: shop });
  }),
);

app.get('/img/:id', wrap(serveImage));

/* The web preview of the app can't read rosierfoods.com directly (browser CORS), so it reads it through here. */
const STORE_URL = (process.env.STORE_URL || 'https://www.rosierfoods.com').replace(/\/$/, '');
const storeCache = new Map();
async function storeProxy(res, path, type) {
  const hit = storeCache.get(path);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return res.type(type).send(hit.body);
  try {
    const r = await fetch(STORE_URL + path, { headers: { 'User-Agent': 'RosierAppPreview/1.0', Accept: type === 'json' ? 'application/json' : 'text/html' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(String(r.status));
    const body = await r.text();
    storeCache.set(path, { at: Date.now(), body });
    res.type(type).send(body);
  } catch {
    if (hit) return res.type(type).send(hit.body);
    res.status(502).json({ error: 'Store unreachable' });
  }
}
app.get('/api/store/products.json', wrap((req, res) => storeProxy(res, `/products.json?limit=${Math.min(250, Number(req.query.limit) || 250)}`, 'json')));
app.get('/api/store/home', wrap((_req, res) => storeProxy(res, '/', 'html')));

/* The app itself (web build) for the admin panel's live phone preview. */
const previewDir = path.resolve(here, '../app-preview');
const previewCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https:",
  "img-src * data: blob:",
  "media-src * data: blob:",
  "connect-src 'self' https:",
  "frame-ancestors 'self'",
].join('; ');
app.use(
  '/preview-app',
  (_req, res, next) => {
    res.set('Content-Security-Policy', previewCsp);
    next();
  },
  express.static(previewDir, { index: false, maxAge: '1h' }),
  (req, res, next) => {
    // Any app screen (e.g. /preview-app/coins) loads the app; it routes itself.
    if (req.method !== 'GET' || /\.\w+$/.test(req.path)) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(previewDir, 'index.html'), (err) => err && res.status(404).send('Preview not built'));
  },
);

/* ───────── Shopify customer login, orders & checkout (used by the app) ───────── */

const callbackUrl = (req) => `${baseUrl(req)}/auth/shopify/callback`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** A tiny page that sends people back into the app (with a button in case the jump is blocked). */
function backToApp(res, target, ok) {
  res.set('Cache-Control', 'no-store');
  res.set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rosier</title><meta http-equiv="refresh" content="0;url=${esc(target)}">
<style>body{font-family:system-ui,sans-serif;background:#FBEBD8;color:#3E2415;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}
a{display:inline-block;margin-top:18px;background:#3E2415;color:#FBE6CF;padding:14px 26px;border-radius:28px;text-decoration:none;font-weight:600}</style></head>
<body><div><h2>${ok ? 'You’re logged in 🎉' : 'Login didn’t finish'}</h2><p>Taking you back to the Rosier app…</p><a href="${esc(target)}">Open the Rosier app</a></div>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`);
}

app.get(
  '/auth/shopify/start',
  wrap(async (req, res) => {
    const appRedirect = String(req.query.redirect || 'rosier://auth');
    if (!shopify.allowedAppRedirect(appRedirect)) return res.status(400).send('Bad redirect');
    try {
      res.redirect(await shopify.startLogin(appRedirect, callbackUrl(req)));
    } catch (e) {
      backToApp(res, `${appRedirect}${appRedirect.includes('?') ? '&' : '?'}error=${encodeURIComponent(e.message)}`, false);
    }
  }),
);

app.get(
  '/auth/shopify/callback',
  wrap(async (req, res) => {
    try {
      const r = await shopify.finishLogin({ code: req.query.code, state: req.query.state }, callbackUrl(req));
      const sep = r.appRedirect.includes('?') ? '&' : '?';
      const err = req.query.error_description || req.query.error || r.error;
      if (err || !r.ticket) return backToApp(res, `${r.appRedirect}${sep}error=${encodeURIComponent(String(err || 'Login failed'))}`, false);
      backToApp(res, `${r.appRedirect}${sep}ticket=${encodeURIComponent(r.ticket)}`, true);
    } catch (e) {
      res.status(400).type('html').send(`<p style="font-family:sans-serif;padding:24px">${esc(e.message)} Please go back to the app and try again.</p>`);
    }
  }),
);

app.post('/api/auth/ticket', wrap(async (req, res) => res.json(await shopify.redeemTicket(String(req.body?.ticket || '')))));
app.post('/api/auth/refresh', wrap(async (req, res) => res.json(await shopify.refreshLogin(String(req.body?.refreshToken || '')))));
app.post('/api/auth/logout', wrap(async (req, res) => res.json({ url: await shopify.logoutUrl(String(req.body?.idToken || '')) })));
app.get('/api/customer/me', wrap(async (req, res) => res.json(await shopify.customerProfile(req.get('X-Customer-Token')))));
app.post(
  '/api/checkout',
  wrap(async (req, res) => {
    const { lines, discountCode, note } = req.body || {};
    const settings = await shopify.publicShopify();
    if (!settings.cartCheckout) return res.status(503).json({ error: 'In-app checkout is switched off' });
    res.json(await shopify.createCheckout({ lines, discountCode, note, customerAccessToken: req.get('X-Customer-Token') || undefined }));
  }),
);

/* ───────── Admin API ───────── */

const admin = express.Router();
admin.post('/login', wrap(auth.login));
admin.post('/logout', auth.logout);
admin.use(auth.requireAdmin);

admin.get('/me', (req, res) => res.json({ user: { id: req.admin.sub, email: req.admin.email, name: req.admin.name } }));
admin.get('/schema', (_req, res) => res.json({ schema: SCHEMA }));

admin.get(
  '/content',
  wrap(async (_req, res) => {
    const rows = await content.allSections();
    res.json({
      sections: rows.map((r) => ({ ...r, changed: JSON.stringify(r.draft) !== JSON.stringify(r.published) })),
    });
  }),
);

/** Give list items that need one a stable id (notifications, blog articles…). */
function fillIds(fields, value) {
  if (!value || typeof value !== 'object') return value;
  for (const f of fields) {
    const v = value[f.key];
    if (f.type === 'group') fillIds(f.fields, v);
    if (f.type === 'list' && Array.isArray(v)) {
      for (const item of v) {
        if (f.autoId && item && !item.id) item.id = crypto.randomBytes(5).toString('hex');
        fillIds(f.fields, item);
      }
    }
  }
  return value;
}

admin.put(
  '/content/:key',
  wrap(async (req, res) => {
    const { key } = req.params;
    if (!SECTION_KEYS.includes(key)) return res.status(404).json({ error: 'Unknown section' });
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Invalid data' });
    const section = SCHEMA.find((s) => s.key === key);
    await content.saveDraft(key, fillIds(section.fields, data), req.admin.email);
    const row = await content.getSection(key);
    res.json({ section: { ...row, changed: JSON.stringify(row.draft) !== JSON.stringify(row.published) } });
  }),
);

admin.post(
  '/content/:key/discard',
  wrap(async (req, res) => {
    await content.discardDraft(req.params.key);
    res.json({ section: await content.getSection(req.params.key) });
  }),
);

admin.get('/defaults/:key', (req, res) => {
  const d = content.loadDefaults()[req.params.key];
  if (!d) return res.status(404).json({ error: 'No default' });
  res.json({ data: d });
});

admin.post(
  '/publish',
  wrap(async (req, res) => {
    const release = await content.publish(req.body?.keys, req.body?.note, req.admin.email);
    if (!release) return res.status(400).json({ error: 'Nothing to publish' });
    res.json({ release });
  }),
);

admin.get('/releases', wrap(async (_req, res) => res.json({ releases: await content.listReleases() })));
admin.post(
  '/releases/:id/rollback',
  wrap(async (req, res) => {
    const r = await content.rollback(Number(req.params.id), req.admin.email);
    if (!r) return res.status(404).json({ error: 'Version not found' });
    res.json({ release: r });
  }),
);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_VIDEO_BYTES, files: 20 } });
admin.get('/images', wrap(async (_req, res) => res.json({ images: await listImages() })));
admin.post(
  '/images',
  upload.array('files', 20),
  wrap(async (req, res) => {
    const out = [];
    const errors = [];
    for (const f of req.files || []) {
      try {
        out.push(await storeImage(f, req.admin.email));
      } catch (e) {
        errors.push(`${f.originalname}: ${e.message}`);
      }
    }
    res.json({ images: out, errors });
  }),
);
admin.delete(
  '/images/:id',
  wrap(async (req, res) => {
    await deleteImage(req.params.id);
    res.json({ ok: true });
  }),
);

admin.get('/products', wrap(async (_req, res) => res.json({ products: await listProducts() })));

admin.get('/preview-link', (req, res) => {
  const token = auth.signPreview(req.admin.email);
  const api = baseUrl(req);
  res.json({ token, link: `rosier://preview?token=${encodeURIComponent(token)}&api=${encodeURIComponent(api)}` });
});

/* Shopify connection (admin panel) */
admin.get(
  '/shopify/settings',
  wrap(async (req, res) => res.json({ settings: await shopify.getSettingsForAdmin(), callbackUrl: callbackUrl(req), backendUrl: baseUrl(req) })),
);
admin.put('/shopify/settings', wrap(async (req, res) => res.json({ settings: await shopify.saveSettings(req.body || {}, req.admin.email) })));
admin.post('/shopify/test/:kind', wrap(async (req, res) => res.json({ message: await shopify.testConnection(req.params.kind) })));
admin.get('/shopify/orders', wrap(async (req, res) => res.json(await shopify.adminOrders({ search: String(req.query.search || ''), after: req.query.after || null }))));
admin.get('/shopify/customers', wrap(async (req, res) => res.json(await shopify.adminCustomers({ search: String(req.query.search || ''), after: req.query.after || null }))));
admin.post(
  '/shopify/graphql',
  wrap(async (req, res) => {
    const { query: q, variables, api = 'admin', allowChanges = false } = req.body || {};
    if (!q || typeof q !== 'string') return res.status(400).json({ error: 'Write a query first' });
    if (/^\s*mutation\b/i.test(q.replace(/#.*$/gm, '')) && !allowChanges) {
      return res.status(400).json({ error: 'This query changes data in Shopify. Tick "Allow changes" if you really mean it.' });
    }
    const started = Date.now();
    const result = api === 'storefront' ? { data: await shopify.storefront(q, variables) } : await shopify.adminGraphql(q, variables);
    res.json({ result, ms: Date.now() - started });
  }),
);

admin.get('/admins', wrap(async (_req, res) => res.json({ admins: await auth.listAdmins() })));
admin.post(
  '/admins',
  wrap(async (req, res) => {
    await auth.addAdmin(req.body || {});
    res.json({ admins: await auth.listAdmins() });
  }),
);
admin.delete(
  '/admins/:id',
  wrap(async (req, res) => {
    await auth.removeAdmin(req.params.id, req.admin.sub);
    res.json({ admins: await auth.listAdmins() });
  }),
);
admin.post(
  '/password',
  wrap(async (req, res) => {
    await auth.changePassword(req.admin.sub, req.body?.current, req.body?.next);
    res.json({ ok: true });
  }),
);

app.use('/api/admin', admin);

/* ───────── Admin panel (static) ───────── */

app.use('/admin', express.static(path.resolve(here, '../admin'), { index: 'index.html', maxAge: '5m' }));
app.get('/', (_req, res) => res.redirect('/admin/'));

app.use((err, _req, res, _next) => {
  if (err instanceof shopify.ShopifyError) return res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({ error: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') err.message = 'That file is too big (videos up to 50 MB, images up to 15 MB).';
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
  if (status >= 500 || !err.message) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => console.log(`Rosier backend on http://localhost:${PORT}  (database: ${db.kind})  admin: /admin`));
