import assert from 'node:assert/strict';
import {
  DEFAULT_INTERACTIVE_DIALOGUE_LAYOUT,
  DEFAULT_INTERACTIVE_DIALOGUE_SETTINGS,
  normalizeInteractiveDialogueSettings,
  resolveInteractiveDialogueLayout,
  resolveInteractiveDialogueStageFrame,
} from '../src/interactiveDialogueSettings';
import { SETTINGS_CONTROL_CENTER_MODULES } from '../src/components/settings/settingsControlCenterNavigation';

// Old configs have no interactiveDialogue block: hide every desktop pet, no per-character layouts.
assert.deepEqual(normalizeInteractiveDialogueSettings(undefined), DEFAULT_INTERACTIVE_DIALOGUE_SETTINGS);

// Each character keeps its own layout; one that was never tuned uses the default (2.8x, up 30%, panel 34%).
const settings = normalizeInteractiveDialogueSettings({
  hideDesktopPets: false,
  layoutsByPetId: {
    live2d: { modelScale: 1.6, modelOffsetYPercent: 5, panelHeightPercent: 5, panelMaxWidth: 1111 },
    '': { modelScale: 2 },
    broken: 'x',
  },
});
assert.equal(settings.hideDesktopPets, false);
assert.deepEqual(Object.keys(settings.layoutsByPetId), ['live2d']);
const live2d = resolveInteractiveDialogueLayout(settings, 'live2d');
assert.equal(live2d.modelScale, 1.6);
assert.equal(live2d.modelOffsetYPercent, 5);
assert.equal(live2d.panelHeightPercent, 20, 'out-of-range values are clamped');
assert.equal(live2d.panelMaxWidth, 1120);
assert.deepEqual(resolveInteractiveDialogueLayout(settings, 'vrm'), DEFAULT_INTERACTIVE_DIALOGUE_LAYOUT);

// 2.8x the window height with the 3D preview filling 84% of its frame -> a frame 333% of the window.
assert.equal(resolveInteractiveDialogueStageFrame(DEFAULT_INTERACTIVE_DIALOGUE_LAYOUT).heightPercent, 333.3);

const advanced = SETTINGS_CONTROL_CENTER_MODULES.find((module) => module.id === 'advanced');
assert.ok(advanced?.pages.some((page) => page.id === 'advanced-interactive-dialogue' && page.label === '互动对话'));
console.log('interactive dialogue settings smoke ok');
