import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query } from './db.js';

const COOKIE = 'rosier_admin';
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
  SECRET = 'dev-secret-' + crypto.createHash('sha256').update(process.cwd()).digest('hex').slice(0, 16);
}

export const hash = (pw) => bcrypt.hash(pw, 10);

/** Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if there is none yet. */
export async function bootstrapAdmin() {
  const { rows } = await query('select count(*)::int as n from admins');
  if (rows[0].n > 0) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('⚠️  No admin yet. Set ADMIN_EMAIL and ADMIN_PASSWORD, or run: npm run create-admin -- you@example.com password');
    return;
  }
  await query('insert into admins (email, name, password_hash) values ($1, $2, $3)', [email.toLowerCase().trim(), 'Admin', await hash(password)]);
  console.log(`Created admin ${email}`);
}

const attempts = new Map();
function throttled(key) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(key, a);
  return a.length >= 10;
}

export async function login(req, res) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  const key = `${req.ip}|${email}`;
  if (throttled(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const { rows } = await query('select * from admins where email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    attempts.get(key).push(Date.now());
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  attempts.delete(key);
  await query('update admins set last_login_at = now() where id = $1', [user.id]);
  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
}

export function logout(_req, res) {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}

/** Guards /api/admin. Mutations also need the X-Requested-With header (blocks cross-site form posts). */
export function requireAdmin(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies?.[COOKIE] || '', SECRET);
    if (req.method !== 'GET' && req.get('X-Requested-With') !== 'rosier-admin') return res.status(403).json({ error: 'Bad request origin' });
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in' });
  }
}

export const signPreview = (by) => jwt.sign({ kind: 'preview', by }, SECRET, { expiresIn: '7d' });
export function verifyPreview(token) {
  try {
    return jwt.verify(token, SECRET).kind === 'preview';
  } catch {
    return false;
  }
}

export async function listAdmins() {
  const { rows } = await query('select id, email, name, created_at, last_login_at from admins order by id');
  return rows;
}

export async function addAdmin({ email, name, password }) {
  email = String(email || '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email');
  if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters');
  await query('insert into admins (email, name, password_hash) values ($1, $2, $3)', [email, name || '', await hash(password)]);
}

export async function removeAdmin(id, selfId) {
  if (Number(id) === Number(selfId)) throw new Error("You can't remove yourself");
  await query('delete from admins where id = $1', [id]);
}

export async function changePassword(id, current, next) {
  const { rows } = await query('select password_hash from admins where id = $1', [id]);
  if (!rows[0] || !(await bcrypt.compare(String(current || ''), rows[0].password_hash))) throw new Error('Current password is wrong');
  if (String(next || '').length < 8) throw new Error('New password must be at least 8 characters');
  await query('update admins set password_hash = $2 where id = $1', [id, await hash(next)]);
}
