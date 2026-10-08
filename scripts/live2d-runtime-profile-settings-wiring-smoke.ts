import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readSource(relativeUrl: string) {
  return readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), 'utf8');
}

const settingsPanelSource = readSource('../src/components/SettingsPanel.tsx');
const settingsModelTabSource = readSource('../src/components/settings/SettingsModelTab.tsx');
const modelAssetsStateSource = readSource('../src/components/settings/useSettingsPanelModelAssetsState.ts');
const profileSectionSource = readSource('../src/components/settings/SettingsLive2DRuntimeProfileSection.tsx');

assert.match(
  modelAssetsStateSource,
  /preset\.id === modelId && preset\.type === 'live2d'[\s\S]*live2dRuntimeProfile: normalizedProfile/u,
  'profile updates must stay scoped to the selected custom Live2D preset',
);
assert.match(
  settingsPanelSource,
  /onUpdateLive2DRuntimeProfile: updateLive2DRuntimeProfile/u,
  'the settings shell should forward the model-level profile updater',
);
assert.match(
  settingsModelTabSource,
  /currentModelPreset\?\.type === 'live2d' && !currentModelPreset\.builtIn[\s\S]*SettingsLive2DRuntimeProfileSection/u,
  'calibration should only appear for the selected editable Live2D model',
);
assert.match(
  profileSectionSource,
  /onValueChange=\{\(nextValue\) => onPreview[\s\S]*onValueCommit=\{\(nextValue\) => onCommit/u,
  'slider movement should remain local until the user commits it',
);
assert.match(
  profileSectionSource,
  /loadLive2DDeclaredParameterIdsFromModelUrl\(preset\.url\)[\s\S]*resolveLive2DDefaultParameterId/u,
  'the profile editor should display model-declared parameter IDs for automatic mapping',
);
assert.match(
  profileSectionSource,
  /placeholder=\{automaticParameterId[\s\S]*enabled: checked[\s\S]*invert: checked[\s\S]*sensitivity:/u,
  'each semantic parameter should expose ID override, enable, invert, and sensitivity controls',
);
assert.match(
  profileSectionSource,
  /editorState\.fitMode === 'canvas'[\s\S]*canvasAnchorX[\s\S]*canvasAnchorY[\s\S]*visibleBoundsAnchorX[\s\S]*visibleBoundsAnchorY/u,
  'the calibration UI should edit the anchor pair consumed by the active fit mode',
);
assert.match(
  profileSectionSource,
  /onCommitProfile\(preset\.id, null\)/u,
  'the calibration UI should support restoring automatic model adaptation',
);

console.log('live2d runtime profile settings wiring smoke passed');
