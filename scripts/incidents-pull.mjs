// The developer's side of incidents ("病例", 2026-11-18): fetch every problem users sent, so a
// character or the dev assistant can read them next to the source code and propose a fix — the
// decision to change anything stays with the developer.
//
//   node scripts/incidents-pull.mjs [--open] [--out <folder>]   save the list (default release/incidents, not committed)
//   node scripts/incidents-pull.mjs --fixed <fingerprint> <version> [note]   mark one fixed (version "none" clears it)
//
// Needs the service's admin key in INCIDENTS_ADMIN_TOKEN (never printed, never stored in a repo).
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.DESKTOP_PET_INCIDENT_API_URL || 'https://ai-desktop-pet-plugin-api.qianxuanlian.workers.dev';
const token = process.env.INCIDENTS_ADMIN_TOKEN || '';
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : fallback; };

if (token.length < 16) {
  console.error('Set INCIDENTS_ADMIN_TOKEN to the plugin-market ADMIN_TOKEN first.');
  process.exit(1);
}
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

if (args.includes('--fixed')) {
  const [fingerprint, version, ...note] = args.slice(args.indexOf('--fixed') + 1);
  const response = await fetch(`${API}/review/incidents/${fingerprint}/fixed`, { body: JSON.stringify({ note: note.join(' '), version: version === 'none' ? null : version }), headers, method: 'POST' });
  console.log(response.ok ? `marked ${fingerprint} → ${version}` : `failed: HTTP ${response.status}`);
  process.exit(response.ok ? 0 : 1);
}

const response = await fetch(`${API}/review/incidents${args.includes('--open') ? '?open=1' : ''}`, { headers });
if (!response.ok) {
  console.error(`failed: HTTP ${response.status}`);
  process.exit(1);
}
const { items } = await response.json();
const folder = option('out', path.join(process.cwd(), 'release', 'incidents'));
fs.mkdirSync(folder, { recursive: true });
const file = path.join(folder, `incidents-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(file, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
console.log(`${items.length} problems (${items.filter((item) => !item.fixed_in).length} open) → ${file}`);
for (const item of items.filter((entry) => !entry.fixed_in).slice(0, 15)) {
  console.log(`  [${item.fingerprint.slice(0, 8)}] ${item.total}x on ${item.reporters} PCs, ${item.versions.join('/')}: ${item.title}`);
}
