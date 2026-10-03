/**
 * Database layer. Uses Postgres when DATABASE_URL is set (production on Render),
 * otherwise an embedded Postgres (PGlite) stored in ./data — zero setup for local use.
 */
import fs from 'node:fs';
import path from 'node:path';

let impl;

export async function connect() {
  if (impl) return impl;
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    const ssl = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) || process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false };
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl, max: 8 });
    impl = { kind: 'postgres', query: (text, params) => pool.query(text, params), close: () => pool.end() };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.DATA_DIR || path.resolve('data/pglite');
    fs.mkdirSync(dir, { recursive: true });
    const db = new PGlite(dir);
    await db.waitReady;
    impl = { kind: 'pglite', query: (text, params) => db.query(text, params), close: () => db.close() };
  }
  await migrate(impl);
  return impl;
}

export const query = (text, params) => impl.query(text, params);

async function migrate(db) {
  const stmts = [
    `create table if not exists admins (
       id serial primary key,
       email text unique not null,
       name text not null default '',
       password_hash text not null,
       created_at timestamptz not null default now(),
       last_login_at timestamptz
     )`,
    `create table if not exists content (
       key text primary key,
       draft jsonb not null,
       published jsonb not null,
       updated_at timestamptz not null default now(),
       updated_by text,
       published_at timestamptz,
       published_by text
     )`,
    `create table if not exists releases (
       id serial primary key,
       data jsonb not null,
       note text not null default '',
       sections text[] not null default '{}',
       created_at timestamptz not null default now(),
       created_by text
     )`,
    `create table if not exists images (
       id text primary key,
       name text not null default '',
       mime text not null,
       width int,
       height int,
       size int,
       data bytea not null,
       created_at timestamptz not null default now(),
       created_by text
     )`,
  ];
  for (const s of stmts) await db.query(s);
}
