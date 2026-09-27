import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const dashboardSource = readProjectFile('src/components/settings/SettingsOverviewDashboard.tsx');
const viteConfigSource = readProjectFile('vite.config.ts');

assert.match(dashboardSource, /__APP_VERSION__/u);
assert.match(viteConfigSource, /__APP_VERSION__:\s*JSON\.stringify\(appVersion\)/u);
assert.match(viteConfigSource, /resolveAppVersion\(\)/u);

console.log('settings overview version smoke: PASS');
