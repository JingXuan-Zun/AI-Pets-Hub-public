// Makes the key pair that signs the hot-update version list. The private key is written OUTSIDE
// the repositories and must never be committed or uploaded; the public key goes into
// electron/appUpdateKey.cjs. Running it again refuses to overwrite an existing private key
// (a new key would make every installed copy reject future updates).
//   node scripts/app-update-keygen.mjs --out <path outside the repositories>
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const outIndex = process.argv.indexOf('--out');
if (outIndex < 0 || !process.argv[outIndex + 1]) {
  console.error('Pass --out <path outside the repositories>.');
  process.exit(1);
}
const out = path.resolve(process.argv[outIndex + 1]);
if (fs.existsSync(out)) {
  console.error(`Already exists, not overwritten: ${out}`);
  process.exit(1);
}
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
fs.writeFileSync(out, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
console.log(`Private key written to ${out} (keep it; never commit or upload it).`);
console.log('Public key for electron/appUpdateKey.cjs:');
console.log(publicKey.export({ format: 'pem', type: 'spki' }));
