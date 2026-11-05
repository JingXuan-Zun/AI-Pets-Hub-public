import assert from 'node:assert/strict';
import { connectsToHerBrowser, herBrowserPort, herBrowserUrl, pointAtHerBrowser } from '../src/plugins/herBrowser';

// Her browser: the browser plugin works in the app's own Chrome window instead of opening a second one.

assert.equal(herBrowserPort({ browserSearchDebugPort: 9223 }), 9223, 'the configured port');
assert.equal(herBrowserUrl({ browserSearchDebugPort: Number.NaN }), 'http://127.0.0.1:9223', 'default port');

const readme = ['-y', 'chrome-devtools-mcp@latest', '--isolated', '--no-usage-statistics'];
const pointed = pointAtHerBrowser(readme, 'http://127.0.0.1:9223');
assert.deepEqual(pointed, { args: ['-y', 'chrome-devtools-mcp@latest', '--no-usage-statistics', '--browserUrl=http://127.0.0.1:9223'], changed: true }, 'README setup → her browser, no throwaway profile');
assert.deepEqual(pointAtHerBrowser(['-y', 'chrome-devtools-mcp', '--browserUrl', 'http://127.0.0.1:9555'], 'http://127.0.0.1:9223').changed, false, 'a browser the user chose is kept');
assert.deepEqual(pointAtHerBrowser(['-y', '@playwright/mcp'], 'http://127.0.0.1:9223').changed, false, 'other servers are left alone');

assert.equal(connectsToHerBrowser(pointed.args, 9223), true, '--browserUrl=… form');
assert.equal(connectsToHerBrowser(['--browser-url', 'http://localhost:9223'], 9223), true, 'separate value, localhost');
assert.equal(connectsToHerBrowser(['--browserUrl=http://127.0.0.1:9555'], 9223), false, 'another browser');
assert.equal(connectsToHerBrowser(['--browserUrl=http://example.com:9223'], 9223), false, 'not this computer');
assert.equal(connectsToHerBrowser(null, 9223), false, 'no args');

console.log('her browser smoke ok: 10 checks');
