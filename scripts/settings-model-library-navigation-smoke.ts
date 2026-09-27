import { strict as assert } from 'node:assert';
import {
  getSettingsControlCenterPage,
  SETTINGS_CONTROL_CENTER_MODULES,
} from '../src/components/settings/settingsControlCenterNavigation.ts';

const desktopModule = SETTINGS_CONTROL_CENTER_MODULES.find((module) => module.id === 'desktop');
assert.ok(desktopModule);
assert.equal(desktopModule.pages.some((page) => page.id === 'desktop-appearance'), false);
assert.equal(desktopModule.pages.some((page) => page.id === 'desktop-vision-area'), false);
const modelLibraryPage = desktopModule.pages.find((page) => page.id === 'desktop-model-library');
assert.ok(modelLibraryPage);
assert.equal(modelLibraryPage.runtimeTab, 'model');
assert.equal(getSettingsControlCenterPage('desktop-model-library').workspaceTitle, '模型库工作区');
assert.equal(getSettingsControlCenterPage('ai-vision-model').runtimeTab, 'vision');

console.log('settings model library navigation smoke passed');
