// Module hooks so smoke scripts can import UI modules that rely on Vite-only features
// (2026-11-06): asset imports (`import x from './a.png'`) become their URL string, and
// `import.meta.glob(...)` becomes an empty map, and `?raw` imports become the file's text. Without this, any smoke that touched
// src/constants.ts or the pet animation tables failed before running a single check.
//
// Use: npx tsx --import ./scripts/harness/register-vite-asset-hooks.mjs scripts/<name>-smoke.ts


const ASSET = /\.(?:png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm|css|woff2?)(?:\?.*)?$/iu;
const SOURCE = /\.(?:[cm]?[jt]sx?)(?:\?.*)?$/iu;

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function load(url, context, next) {
  // `import text from './notes.md?raw'` gives the file's text, as in Vite.
  if (/\?raw$/u.test(url)) {
    const text = readFileSync(fileURLToPath(url.replace(/\?raw$/u, '')), 'utf8');
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(text)};` };
  }
  if (ASSET.test(url)) {
    return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(url)};` };
  }
  const result = await next(url, context);
  if (!SOURCE.test(url) || url.includes('/node_modules/') || result.source == null) return result;
  const text = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
  if (!text.includes('import.meta.glob')) return result;
  return { ...result, source: text.replace(/import\.meta\.glob\s*(?:<[^>]*>)?\s*\(/gu, '((..._args) => ({}))(') };
}
