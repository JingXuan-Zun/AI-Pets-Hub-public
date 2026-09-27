import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

function extractZIndexUtilities(source: string) {
  return Array.from(source.matchAll(/z-(?:\[(\d+)\]|(\d+))/g))
    .map((match) => Number(match[1] ?? match[2]))
    .filter(Number.isFinite);
}

const {
  dialog: dialogSource,
  settingsPanel: settingsPanelSource,
} = readProjectSources({
  dialog: 'components/ui/dialog.tsx',
  settingsPanel: 'src/components/SettingsPanel.tsx',
});

const settingsPanelZIndexes = extractZIndexUtilities(settingsPanelSource);
const dialogZIndexes = extractZIndexUtilities(dialogSource);
const maxSettingsPanelZIndex = Math.max(...settingsPanelZIndexes);
const minDialogZIndex = Math.min(...dialogZIndexes);

assert.ok(
  maxSettingsPanelZIndex >= 70,
  'settings panel should keep its known docked z-index in this smoke check',
);

assert.ok(
  minDialogZIndex > maxSettingsPanelZIndex,
  `dialog overlay/content z-index (${minDialogZIndex}) must stay above settings panel controls (${maxSettingsPanelZIndex})`,
);

console.log('settings dialog layering smoke ok');
