// Applies supabase/migrations/*.sql to the project and (optionally) closes sign-ups,
// using the Supabase Management API. Needs in .env:
//   VITE_SUPABASE_URL        https://<project-ref>.supabase.co
//   SUPABASE_ACCESS_TOKEN    a personal access token (supabase.com/dashboard/account/tokens)
//
//   npm run db:migrate                     apply all migrations (they're idempotent)
//   npm run db:migrate -- --close-signups  also stop new accounts being created

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const url = process.env.VITE_SUPABASE_URL?.trim();
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!url || !token) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_ACCESS_TOKEN in .env first.');
  process.exit(1);
}
const ref = new URL(url).hostname.split('.')[0];

async function api(method, endpoint, body) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${endpoint}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${endpoint}: ${res.status} ${await res.text()}`);
  return res.json().catch(() => null);
}

const dir = path.join(ROOT, 'supabase', 'migrations');
for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
  await api('POST', '/database/query', { query: await fs.readFile(path.join(dir, file), 'utf8') });
  console.log(`applied ${file}`);
}

if (process.argv.includes('--close-signups')) {
  await api('PATCH', '/config/auth', { disable_signup: true });
  console.log('sign-ups closed: only existing accounts can sign in');
}
