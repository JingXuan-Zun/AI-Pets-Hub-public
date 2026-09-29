import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/components/settings/SettingsModelProviderTools.tsx');

const firstVisibleStatusIndex = source.indexOf('aria-live="polite"');
const dialogIndex = source.indexOf('<Dialog open={advancedOpen}');

assert.ok(
  firstVisibleStatusIndex > -1,
  'model connection test status should be announced outside the advanced dialog',
);

assert.ok(
  dialogIndex > -1,
  'advanced model dialog should still exist',
);

assert.ok(
  firstVisibleStatusIndex < dialogIndex,
  'model connection test feedback must be visible before the dialog markup, not only inside it',
);

assert.match(
  source,
  /disabled=\{isTestingConnection\}/,
  'test connection button should be disabled while a request is in flight',
);

assert.match(
  source,
  /updateTestStatus\([^)]*'success'/s,
  'successful connection tests should use a success status tone',
);

assert.match(
  source,
  /updateTestStatus\([^)]*'error'/s,
  'failed connection tests should use an error status tone',
);

console.log('settings model test feedback smoke ok');
