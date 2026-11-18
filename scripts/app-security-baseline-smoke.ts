// Security baseline (2026-11-07): every window is sandboxed, and every app page carries a
// Content-Security-Policy that allows no inline script or eval in production.
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LIVE2D_CUBISM_CORE_ORIGIN,
  buildAppContentSecurityPolicy,
  injectContentSecurityPolicyMeta,
} from '../src/security/appContentSecurityPolicy';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
const check = (condition: unknown, label: string) => { assert.ok(condition, label); checks += 1; };

const directives = (policy: string) => new Map(policy.split(';').map((part) => {
  const [name, ...values] = part.trim().split(/\s+/);
  return [name, values] as const;
}));

const production = directives(buildAppContentSecurityPolicy({ dev: false }));
const dev = directives(buildAppContentSecurityPolicy({ dev: true }));

check(!buildAppContentSecurityPolicy({ dev: false }).includes("'unsafe-eval'"), 'production allows no eval');
check(!buildAppContentSecurityPolicy({ dev: true }).includes("'unsafe-eval'"), 'dev allows no eval either');
check(!production.get('script-src')!.includes("'unsafe-inline'"), 'production allows no inline script');
check(dev.get('script-src')!.includes("'unsafe-inline'"), 'dev keeps the React Fast Refresh inline script');
assert.deepEqual(production.get('script-src'), ["'self'", LIVE2D_CUBISM_CORE_ORIGIN]); checks += 1;
for (const [name, value] of [['object-src', "'none'"], ['base-uri', "'none'"], ['form-action', "'none'"]] as const) {
  assert.deepEqual(production.get(name), [value], name); checks += 1;
}
for (const name of ['img-src', 'media-src', 'connect-src']) {
  check(production.get(name)!.includes('desktop-pet-file:'), `${name} allows local files through the app protocol`);
}
check(production.get('connect-src')!.includes('http:'), 'model/voice APIs on the LAN or localhost stay reachable');

const injected = injectContentSecurityPolicyMeta('<head>\n<meta charset="UTF-8" />\n</head>', 'default-src \'self\'');
check(/<meta charset="UTF-8" \/>\n\s*<meta http-equiv="Content-Security-Policy" content="default-src 'self'" \/>/.test(injected), 'meta goes right after charset');
assert.throws(() => injectContentSecurityPolicyMeta('<head></head>', 'x')); checks += 1;

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
check(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(indexHtml), 'index.html has no inline script');

// Every BrowserWindow is sandboxed with context isolation and no Node integration.
const windowFiles = [
  'electron/areaPickerBorderWindow.cjs',
  'electron/areaPickerWindow.cjs',
  'electron/reportImageRenderer.cjs',
  'electron/windowManager/chatWindowOptions.cjs',
  'electron/windowManager/inputProxyWindowCreation.cjs',
  'electron/windowManager/mainWindowOptions.cjs',
  'electron/windowManager/settingsWindowOptions.cjs',
];
for (const file of windowFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  check(/sandbox:\s*true/.test(text) && !/sandbox:\s*false/.test(text), `${file} is sandboxed`);
  check(/contextIsolation:\s*true/.test(text) && /nodeIntegration:\s*false/.test(text), `${file} isolates the page`);
}
// The report window only shows a page the app built: no script at all, no preload.
const reportWindow = fs.readFileSync(path.join(root, 'electron/reportImageRenderer.cjs'), 'utf8');
check(/javascript:\s*false/.test(reportWindow) && !/preload:/.test(reportWindow), 'report window runs no script and has no preload');
const windowCreators = fs.readdirSync(path.join(root, 'electron'), { recursive: true })
  .map(String).filter((file) => file.endsWith('.cjs'))
  .filter((file) => fs.readFileSync(path.join(root, 'electron', file), 'utf8').includes('new BrowserWindow('));
assert.deepEqual(windowCreators.length, 7, `a new window type appeared (${windowCreators.join(', ')}); add its options file above`); checks += 1;

// Preloads may only use what a sandboxed preload has.
for (const file of ['electron/preload.cjs', 'electron/postDragInputProxyPreload.cjs']) {
  const requires = [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]);
  check(requires.every((name) => name === 'electron'), `${file} only requires electron (sandboxed preload)`);
}

// Pixi 6 needs its no-eval patch before any Application is created.
for (const file of ['src/components/pet/live2dSharedRenderer.ts', 'src/components/settings/modelLibraryThumbnails.ts']) {
  check(/import '(\.\.\/pet|\.)\/pixiNoEvalPatch';/.test(fs.readFileSync(path.join(root, file), 'utf8')), `${file} loads the pixi no-eval patch`);
}

console.log(`app security baseline smoke ok: ${checks} checks`);
