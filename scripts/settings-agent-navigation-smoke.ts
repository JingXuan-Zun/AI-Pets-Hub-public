import { strict as assert } from 'node:assert';
import { getSettingsControlCenterPage, SETTINGS_CONTROL_CENTER_MODULES } from '../src/components/settings/settingsControlCenterNavigation.ts';

const aiModule = SETTINGS_CONTROL_CENTER_MODULES.find((module) => module.id === 'ai');
const desktopModule = SETTINGS_CONTROL_CENTER_MODULES.find((module) => module.id === 'desktop');
assert.ok(aiModule);
assert.ok(desktopModule);
assert.equal(aiModule.pages.some((page) => page.id === 'ai-agent'), false);

const page = desktopModule.pages.find((candidate) => candidate.id === 'desktop-knowledge-personality');
assert.ok(page);
assert.equal(page.label, '知识记忆人格');
assert.equal(page.personalityWorkspacePage, 'agent');
assert.equal(getSettingsControlCenterPage(page.id).runtimeTab, 'personality');

console.log('settings agent navigation smoke passed');
