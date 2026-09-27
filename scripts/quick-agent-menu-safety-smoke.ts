import { strict as assert } from 'node:assert';
import { readProjectSources } from './smokeTestHarness.ts';

const { menuSource, layerSource, containerSource } = readProjectSources({
  menuSource: 'src/components/pet/PetQuickActionMenu.tsx',
  layerSource: 'src/components/pet/PetPanelsLayer.tsx',
  containerSource: 'src/components/PetContainer.tsx',
});

assert.doesNotMatch(menuSource, /桌面整理/u);
assert.doesNotMatch(menuSource, /打开应用/u);
assert.doesNotMatch(menuSource, /onStartDesktopOrganization|onRequestAgentAppLaunch/u);
assert.doesNotMatch(layerSource, /onStartDesktopOrganization|onRequestAgentAppLaunch/u);
assert.doesNotMatch(containerSource, /onRequestAgentAppLaunch/u);

console.log('quick agent menu safety smoke passed');
