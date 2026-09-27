import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const visualSource = readFileSync('src/services/agentVisualSnapshotService.ts', 'utf8');
const controllerSource = readFileSync('src/components/pet/useGameCompanionLoopController.ts', 'utf8');
const menuSource = readFileSync('src/components/pet/PetQuickActionMenu.tsx', 'utf8');
const settingsSource = readFileSync('src/components/settings/SettingsGameCompanionTab.tsx', 'utf8');

assert.match(visualSource, /gameIdentityMetadata/u);
assert.match(visualSource, /gameIdentityEvidence/u);
assert.match(visualSource, /never invent a game title/u);
assert.match(controllerSource, /getActiveWindowInfo/u);
assert.match(controllerSource, /executablePath/u);
assert.match(controllerSource, /createGameIdentityMetadata/u);
assert.match(controllerSource, /detectedGameOrGenre/u);
assert.match(menuSource, /识别：/u);
assert.match(settingsSource, /游戏名称/u);
assert.match(settingsSource, /游戏介绍/u);
assert.match(settingsSource, /手动扫描/u);
assert.match(settingsSource, /listCaptureSources/u);
assert.match(settingsSource, /analyzeAgentGameSnapshot/u);

console.log('game companion identity smoke passed');
