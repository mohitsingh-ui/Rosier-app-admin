import crypto from 'node:crypto';
import sharp from 'sharp';
import { query } from './db.js';

const MAX = 2000;

/** Optimise an upload: fix rotation, cap at 2000px, convert to WebP (GIFs keep their animation). */
export async function storeImage(file, by) {
  const meta = await sharp(file.buffer, { animated: true }).metadata();
  if (!meta.format || !['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff'].includes(meta.format)) throw new Error('Unsupported image type');
  let out;
  let mime = 'image/webp';
  if (meta.format === 'gif' && (meta.pages || 1) > 1) {
    out = file.buffer;
    mime = 'image/gif';
  } else {
    out = await sharp(file.buffer).rotate().resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90 }).toBuffer();
  }
  const info = await sharp(out).metadata();
  const id = crypto.randomBytes(9).toString('base64url');
  await query('insert into images (id, name, mime, width, height, size, data, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8)', [
    id,
    file.originalname || '',
    mime,
    info.width,
    info.pageHeight || info.height,
    out.length,
    out,
    by,
  ]);
  return { id, url: `/img/${id}`, name: file.originalname, width: info.width, height: info.pageHeight || info.height, size: out.length };
}

export async function listImages() {
  const { rows } = await query('select id, name, mime, width, height, size, created_at from images order by created_at desc limit 500');
  return rows.map((r) => ({ ...r, url: `/img/${r.id}` }));
}

export async function deleteImage(id) {
  await query('delete from images where id = $1', [id]);
}

/* Small in-memory cache of resized versions. */
const resized = new Map();
const CACHE_MAX = 300;

export async function serveImage(req, res) {
  const id = req.params.id.replace(/\.\w+$/, '');
  const w = Math.min(MAX, Math.max(0, parseInt(req.query.w, 10) || 0));
  const key = `${id}|${w}`;
  let hit = resized.get(key);
  if (!hit) {
    const { rows } = await query('select mime, data from images where id = $1', [id]);
    if (!rows[0]) return res.status(404).end();
    let { mime, data } = rows[0];
    data = Buffer.from(data);
    if (w && mime === 'image/webp') data = await sharp(data).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    hit = { mime, data };
    resized.set(key, hit);
    if (resized.size > CACHE_MAX) resized.delete(resized.keys().next().value);
  }
  res.set('Content-Type', hit.mime);
  // Image IDs never change content, so phones can cache them forever.
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(hit.data);
}
