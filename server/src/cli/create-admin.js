import { connect, query } from '../db.js';
import { hash } from '../auth.js';

const [email, password, name = 'Admin'] = process.argv.slice(2);
if (!email || !password) {
  console.log('Usage: npm run create-admin -- you@example.com "a-strong-password" "Your Name"');
  process.exit(1);
}
await connect();
await query(
  'insert into admins (email, name, password_hash) values ($1, $2, $3) on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name',
  [email.toLowerCase().trim(), name, await hash(password)],
);
console.log(`Admin ${email} is ready.`);
process.exit(0);
