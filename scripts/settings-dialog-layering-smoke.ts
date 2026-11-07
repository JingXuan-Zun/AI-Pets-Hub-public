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

// The redesigned panel tops out lower (z-40); what matters is that dialogs stay above it.
assert.ok(
  settingsPanelZIndexes.length > 0,
  'the settings panel should still declare its stacking (z-*) so this check means something',
);

assert.ok(
  minDialogZIndex > maxSettingsPanelZIndex,
  `dialog overlay/content z-index (${minDialogZIndex}) must stay above settings panel controls (${maxSettingsPanelZIndex})`,
);

console.log('settings dialog layering smoke ok');
