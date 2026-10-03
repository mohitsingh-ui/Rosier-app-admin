import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';
import { SECTION_KEYS } from './schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadDefaults() {
  // Prefer the app's own defaults (same repo), fall back to the committed copy.
  const candidates = [path.resolve(here, '../../src/config/defaults.json'), path.resolve(here, '../seed/defaults.json')];
  for (const f of candidates) if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  throw new Error('defaults.json not found');
}

/** Fill in any missing sections (first run, or a new section added to the app later). */
export async function seed() {
  const defaults = loadDefaults();
  const { rows } = await query('select key from content');
  const have = new Set(rows.map((r) => r.key));
  let added = 0;
  for (const key of SECTION_KEYS) {
    if (have.has(key) || !defaults[key]) continue;
    await query('insert into content (key, draft, published, published_at) values ($1, $2, $2, now())', [key, JSON.stringify(defaults[key])]);
    added++;
  }
  const rel = await query('select count(*)::int as n from releases');
  if (added || rel.rows[0].n === 0) await snapshot('Initial content from the app', added ? SECTION_KEYS : [], 'system');
  return added;
}

export async function allSections() {
  const { rows } = await query('select key, draft, published, updated_at, updated_by, published_at, published_by from content');
  return rows;
}

export async function getSection(key) {
  const { rows } = await query('select * from content where key = $1', [key]);
  return rows[0];
}

export async function saveDraft(key, data, by) {
  await query(
    `insert into content (key, draft, published, updated_at, updated_by) values ($1, $2, $2, now(), $3)
     on conflict (key) do update set draft = excluded.draft, updated_at = now(), updated_by = excluded.updated_by`,
    [key, JSON.stringify(data), by],
  );
}

export async function discardDraft(key) {
  await query('update content set draft = published where key = $1', [key]);
}

/** Publish the given sections (or every section with unpublished changes). */
export async function publish(keys, note, by) {
  const rows = await allSections();
  const changed = rows.filter((r) => JSON.stringify(r.draft) !== JSON.stringify(r.published)).map((r) => r.key);
  const target = (keys?.length ? keys : changed).filter((k) => changed.includes(k));
  if (!target.length) return null;
  for (const k of target) {
    await query('update content set published = draft, published_at = now(), published_by = $2 where key = $1', [k, by]);
  }
  const release = await snapshot(note || `Updated ${target.join(', ')}`, target, by);
  invalidate();
  return release;
}

async function snapshot(note, sections, by) {
  const rows = await allSections();
  const data = Object.fromEntries(rows.map((r) => [r.key, r.published]));
  const { rows: out } = await query('insert into releases (data, note, sections, created_by) values ($1, $2, $3, $4) returning id, created_at', [
    JSON.stringify(data),
    note,
    sections,
    by,
  ]);
  invalidate();
  return out[0];
}

export async function listReleases(limit = 50) {
  const { rows } = await query('select id, note, sections, created_at, created_by from releases order by id desc limit $1', [limit]);
  return rows;
}

export async function rollback(id, by) {
  const { rows } = await query('select data from releases where id = $1', [id]);
  if (!rows[0]) return null;
  const data = rows[0].data;
  for (const [k, v] of Object.entries(data)) {
    await query('update content set draft = $2, published = $2, published_at = now(), published_by = $3 where key = $1', [k, JSON.stringify(v), by]);
  }
  return snapshot(`Rolled back to version ${id}`, Object.keys(data), by);
}

/* ───────── Public config (what the app downloads) ───────── */

let cache = null;
function invalidate() {
  cache = null;
}

/** Turn "/img/abc" into an absolute URL so the app can load it directly. */
function absolutize(value, base) {
  if (typeof value === 'string') return value.startsWith('/img/') ? base + value : value;
  if (Array.isArray(value)) return value.map((v) => absolutize(v, base));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutize(v, base)]));
  return value;
}

export async function publicConfig(base) {
  if (!cache) {
    const { rows } = await query('select id, created_at from releases order by id desc limit 1');
    const sections = await allSections();
    cache = {
      version: rows[0]?.id ?? 0,
      publishedAt: rows[0]?.created_at ?? null,
      content: Object.fromEntries(sections.map((r) => [r.key, r.published])),
    };
  }
  return { ...cache, content: absolutize(cache.content, base) };
}

export async function draftConfig(base) {
  const sections = await allSections();
  return { version: -1, preview: true, content: absolutize(Object.fromEntries(sections.map((r) => [r.key, r.draft])), base) };
}
