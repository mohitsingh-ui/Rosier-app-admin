import crypto from 'node:crypto';
import sharp from 'sharp';
import { query } from './db.js';

const MAX = 2000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const VIDEO_TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime' };
const videoMime = (file) => {
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  if (file.mimetype?.startsWith('video/') || ext === 'webm') {
    // WebM and other formats don't play on iPhones.
    const mime = /^video\/(mp4|quicktime|x-m4v)$/.test(file.mimetype) ? (file.mimetype === 'video/x-m4v' ? 'video/mp4' : file.mimetype) : VIDEO_TYPES[ext];
    if (!mime) throw new Error('Please upload an MP4 video (it plays on both Android and iPhone).');
    return mime;
  }
  return VIDEO_TYPES[ext] || null;
};

/** Upload a video as-is (MP4 recommended — it plays on every phone). */
async function storeVideo(file, mime, by) {
  if (file.size > MAX_VIDEO_BYTES) throw new Error('Video is over 50 MB. Please export a shorter or smaller MP4.');
  const id = crypto.randomBytes(9).toString('base64url');
  await query('insert into images (id, name, mime, width, height, size, data, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8)', [
    id,
    file.originalname || '',
    mime,
    null,
    null,
    file.size,
    file.buffer,
    by,
  ]);
  return { id, url: `/img/${id}`, name: file.originalname, mime, size: file.size };
}

/** Optimise an upload: fix rotation, cap at 2000px, convert to WebP (GIFs keep their animation). */
export async function storeImage(file, by) {
  const vm = videoMime(file);
  if (vm) return storeVideo(file, vm, by);
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is over 15 MB');
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
  return { id, url: `/img/${id}`, name: file.originalname, mime, width: info.width, height: info.pageHeight || info.height, size: out.length };
}

export async function listImages() {
  const { rows } = await query('select id, name, mime, width, height, size, created_at from images order by created_at desc limit 500');
  return rows.map((r) => ({ ...r, url: `/img/${r.id}` }));
}

export async function deleteImage(id) {
  const v = videos.get(id);
  if (v) {
    videos.delete(id);
    videoBytes -= v.data.length;
  }
  await query('delete from images where id = $1', [id]);
}

/* Small in-memory cache of resized versions. */
const resized = new Map();
const CACHE_MAX = 300;

/* Videos are kept in memory once loaded (up to ~150 MB) so seeking doesn't hit the database every time. */
const videos = new Map();
let videoBytes = 0;
async function loadVideo(id) {
  let v = videos.get(id);
  if (v) {
    videos.delete(id);
    videos.set(id, v); // most recently used
    return v;
  }
  const { rows } = await query('select mime, data from images where id = $1', [id]);
  if (!rows[0] || !rows[0].mime.startsWith('video/')) return null;
  v = { mime: rows[0].mime, data: Buffer.from(rows[0].data) };
  videos.set(id, v);
  videoBytes += v.data.length;
  while (videoBytes > 150 * 1024 * 1024 && videos.size > 1) {
    const [k, old] = videos.entries().next().value;
    videos.delete(k);
    videoBytes -= old.data.length;
  }
  return v;
}

/** Videos support Range requests — iPhones won't play a video without them. */
function sendVideo(req, res, v) {
  const total = v.data.length;
  res.set('Content-Type', v.mime);
  res.set('Accept-Ranges', 'bytes');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.get('Range') || '');
  if (!m) {
    res.set('Content-Length', String(total));
    return res.send(v.data);
  }
  let start = m[1] === '' ? total - Number(m[2]) : Number(m[1]);
  let end = m[1] === '' || m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  if (Number.isNaN(start) || start < 0) start = 0;
  if (start >= total || start > end) {
    res.set('Content-Range', `bytes */${total}`);
    return res.status(416).end();
  }
  res.status(206);
  res.set('Content-Range', `bytes ${start}-${end}/${total}`);
  res.set('Content-Length', String(end - start + 1));
  res.end(v.data.subarray(start, end + 1));
}

export async function serveImage(req, res) {
  const id = req.params.id.replace(/\.\w+$/, '');
  const video = videos.get(id) ? await loadVideo(id) : null;
  if (video) return sendVideo(req, res, video);
  const w = Math.min(MAX, Math.max(0, parseInt(req.query.w, 10) || 0));
  const key = `${id}|${w}`;
  let hit = resized.get(key);
  if (!hit) {
    const { rows } = await query('select mime, (mime like $2) as is_video from images where id = $1', [id, 'video/%']);
    if (!rows[0]) return res.status(404).end();
    if (rows[0].is_video) return sendVideo(req, res, await loadVideo(id));
    const full = await query('select mime, data from images where id = $1', [id]);
    let { mime, data } = full.rows[0];
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
