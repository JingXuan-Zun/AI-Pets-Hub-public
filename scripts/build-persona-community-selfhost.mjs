import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'services/persona-community-selfhost');
const output = resolve(root, 'release/persona-community-selfhost');
await mkdir(output, { recursive: true });
await build({ entryPoints: [join(source, 'server.mjs')], outfile: join(output, 'server.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node24',
  banner: { js: '// Persona sharing selfhost bundle. Contains no user data or credentials.' },
});
const files = ['server.mjs', 'README.md'];
await copyFile(join(source, 'README.md'), join(output, 'README.md'));
for (const name of await readdir(join(source, 'windows'))) {
  await copyFile(join(source, 'windows', name), join(output, name)); files.push(name);
}
const zipFiles = {};
for (const name of files) zipFiles[`persona-community-selfhost/${name}`] = new Uint8Array(await readFile(join(output, name)));
// A fresh ZIP always has only this explicit code list, never server data, certificates or config.
zipFiles['persona-community-selfhost/runtime/README.txt'] = strToU8('Optional: put the official Node.js 24 Windows portable node.exe here.');
const archive = resolve(root, 'release/persona-community-selfhost.zip');
await writeFile(archive, zipSync(zipFiles));
console.log(`Prepared ${archive}. Node.js 24 required; no runtime or user data bundled.`);
