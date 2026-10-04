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
    `create table if not exists settings (
       key text primary key,
       value jsonb not null,
       updated_at timestamptz not null default now(),
       updated_by text
     )`,
    `create table if not exists oauth_states (
       state text primary key,
       data jsonb not null,
       created_at timestamptz not null default now()
     )`,
    `create table if not exists auth_tickets (
       ticket text primary key,
       data jsonb not null,
       created_at timestamptz not null default now()
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
    // Phones that can get notifications (Expo push tokens).
    `create table if not exists push_devices (
       token text primary key,
       device_id text not null,
       platform text not null default '',
       customer_id text,
       email text,
       phone text,
       name text,
       member boolean not null default false,
       enabled boolean not null default true,
       created_at timestamptz not null default now(),
       last_seen timestamptz not null default now()
     )`,
    `alter table push_devices add column if not exists push_ok boolean`,
    `create index if not exists push_devices_customer on push_devices (customer_id)`,
    // Expo tickets we still need a receipt for (tells us if Firebase/Apple really took it).
    `create table if not exists push_tickets (
       id text primary key,
       token text not null,
       device_id text,
       title text not null,
       body text not null default '',
       data jsonb not null default '{}',
       created_at timestamptz not null default now()
     )`,
    // Messages for phones without working push: the app picks them up in the background (every ~15 min) and on open.
    `create table if not exists push_outbox (
       id serial primary key,
       device_id text not null,
       title text not null,
       body text not null default '',
       data jsonb not null default '{}',
       created_at timestamptz not null default now()
     )`,
    `create index if not exists push_outbox_device on push_outbox (device_id, id)`,
    `create index if not exists push_devices_device on push_devices (device_id)`,
    // Every notification sent (admin campaigns + order updates), for history and de-duplication.
    `create table if not exists push_log (
       id serial primary key,
       kind text not null,
       ref text,
       title text not null,
       body text not null default '',
       audience text not null default '',
       sent int not null default 0,
       failed int not null default 0,
       created_at timestamptz not null default now(),
       created_by text
     )`,
    `create unique index if not exists push_log_ref on push_log (kind, ref) where ref is not null`,
    // App opens, for the app sales dashboard (sessions + live visitors).
    `create table if not exists app_sessions (
       id serial primary key,
       device_id text not null,
       customer_id text,
       platform text not null default '',
       started_at timestamptz not null default now(),
       last_seen timestamptz not null default now()
     )`,
    `create index if not exists app_sessions_started on app_sessions (started_at)`,
    `create index if not exists app_sessions_device on app_sessions (device_id, last_seen)`,
  ];
  for (const s of stmts) await db.query(s);
}
