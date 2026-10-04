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
  }),
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const baseUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

/* ───────── Public ───────── */

app.get('/healthz', (_req, res) => res.json({ ok: true, db: db.kind }));

app.get(
  '/api/app/config',
  wrap(async (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.set('Access-Control-Allow-Origin', '*');
    if (req.query.preview) {
      if (!auth.verifyPreview(String(req.query.preview))) return res.status(401).json({ error: 'Preview link expired' });
      return res.json(await content.draftConfig(baseUrl(req)));
    }
    const cfg = await content.publicConfig(baseUrl(req));
    const etag = `"v${cfg.version}"`;
    res.set('ETag', etag);
    if (req.get('If-None-Match') === etag) return res.status(304).end();
    res.json(cfg);
  }),
);

app.get('/img/:id', wrap(serveImage));

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
  if (err.code === 'LIMIT_FILE_SIZE') err.message = 'That file is too big (videos up to 50 MB, images up to 15 MB).';
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
  if (status >= 500 || !err.message) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => console.log(`Rosier backend on http://localhost:${PORT}  (database: ${db.kind})  admin: /admin`));
