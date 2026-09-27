import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { formatGameCompanionObservationRate, normalizeGameCompanionObservationInterval } from '../src/gameCompanionSettings.ts';
import { getSettingsControlCenterPage, SETTINGS_CONTROL_CENTER_MODULES } from '../src/components/settings/settingsControlCenterNavigation.ts';

assert.equal(normalizeGameCompanionObservationInterval(8_000), 8_000);
assert.equal(normalizeGameCompanionObservationInterval(100), 200);
assert.equal(normalizeGameCompanionObservationInterval(10_001), 10_000);
assert.equal(normalizeGameCompanionObservationInterval(350), 400);
assert.equal(normalizeGameCompanionObservationInterval(200), 200);
assert.equal(normalizeGameCompanionObservationInterval(10_000), 10_000);
assert.equal(formatGameCompanionObservationRate(8_000), '0.13 帧/秒');

const advancedModule = SETTINGS_CONTROL_CENTER_MODULES.find((module) => module.id === 'advanced');
assert.ok(advancedModule);
const page = advancedModule.pages.find((candidate) => candidate.id === 'advanced-game-companion');
assert.ok(page);
assert.equal(page.label, '陪玩');
assert.equal(getSettingsControlCenterPage(page.id).runtimeTab, 'system');

const controllerSource = readFileSync('src/components/pet/useGameCompanionLoopController.ts', 'utf8');
assert.match(controllerSource, /getPetResponseStrict/u);
assert.match(controllerSource, /gameCompanionObservationIntervalMs/u);
assert.match(controllerSource, /slot\.personality/u);

console.log('game companion settings smoke passed');
