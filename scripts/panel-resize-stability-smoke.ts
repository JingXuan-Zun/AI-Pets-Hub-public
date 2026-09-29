import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

function assertIncludes(source: string, expected: string, message: string) {
  assert.ok(source.includes(expected), message);
}

const {
  chatResizeSource,
  settingsResizeSource,
  chatHandlesSource,
  settingsPanelSource,
  activityLayerSource,
} = readProjectSources({
  chatResizeSource: 'src/components/chat/useFloatingChatPanelResize.ts',
  settingsResizeSource: 'src/components/settings/useSettingsPanelFrameState.ts',
  chatHandlesSource: 'src/components/chat/EmbeddedPetChatPanelResizeHandles.tsx',
  settingsPanelSource: 'src/components/SettingsPanel.tsx',
  activityLayerSource: 'src/components/pet/PetEnvironmentLayer.tsx',
});

assertIncludes(
  chatResizeSource,
  'originBaseX',
  'chat resize should store the base position from pointer down',
);
assertIncludes(
  chatResizeSource,
  'nextBasePosition = panelBasePositionResolverRef.current',
  'chat resize should resolve the next base position for the next size',
);
assertIncludes(
  chatResizeSource,
  'originBaseX + chatPanelResizeState.originOffsetX + chatPanelResizeState.originWidth - nextWidth - nextBasePosition.x',
  'chat left resize should preserve the original absolute right edge',
);
assertIncludes(
  settingsResizeSource,
  'originBaseX',
  'settings resize should store the base position from pointer down',
);
assertIncludes(
  settingsResizeSource,
  'const nextBasePosition = resolveDockedPanelStartPosition(',
  'settings resize should resolve the panel base from the next size',
);
assertIncludes(
  settingsResizeSource,
  '?? resolvePanelStartPosition(anchorRect, nextSize)',
  'settings resize should fall back to the next-size floating base position',
);
assertIncludes(
  settingsResizeSource,
  'originBaseX + panelResizeState.originOffsetX + panelResizeState.originWidth - nextWidth - nextBasePosition.x',
  'settings left resize should preserve the original absolute right edge',
);

for (const [label, source] of [
  ['chat resize handles', chatHandlesSource],
  ['settings resize handles', settingsPanelSource],
] as const) {
  assertIncludes(source, 'h-5 cursor-ns-resize border-t border-primary/45', `${label} should give the top edge the larger bottom-edge hit style`);
  assertIncludes(source, 'w-5 cursor-ew-resize border-l border-primary/45', `${label} should give the left edge the larger right-edge hit style`);
  assertIncludes(source, 'h-7 w-7 cursor-nwse-resize border-l border-t border-primary/45', `${label} should give the top-left corner a larger hit target`);
  assert.doesNotMatch(source, /border-[lt] border-primary\/25/, `${label} should not keep the old faint left/top border`);
}

assertIncludes(
  activityLayerSource,
  'left-0 right-0 top-0 h-4 cursor-ns-resize border-t border-primary/45 bg-gradient-to-b from-primary/10 to-transparent',
  'activity region top handle should use the old-package h-4 interactive border',
);
assertIncludes(
  activityLayerSource,
  'bottom-0 left-0 top-0 w-4 cursor-ew-resize border-l border-primary/45 bg-gradient-to-r from-primary/10 to-transparent',
  'activity region left handle should use the old-package w-4 interactive border',
);
assertIncludes(
  activityLayerSource,
  'left-0 top-0 h-5 w-5 cursor-nwse-resize border-l border-t border-primary/45 bg-gradient-to-br from-primary/10 to-transparent',
  'activity region corner handle should use the old-package h-5/w-5 interactive corner',
);
assertIncludes(
  activityLayerSource,
  'data-desktop-pet-activity-region-handle="true"',
  'activity region handles should expose a rectangle fallback marker for desktop pointer passthrough polling',
);
assertIncludes(
  activityLayerSource,
  'absolute z-[45] rounded-lg',
  'activity region frame should stay above pet hit layers so handles are first-pickable',
);
assertIncludes(
  activityLayerSource,
  'data-desktop-pet-interactive="true"',
  'activity region handles must remain marked as desktop-pet interactive',
);
assert.doesNotMatch(
  activityLayerSource,
  /border-[lt] border-primary\/25/,
  'activity region left/top handles should not keep the old faint border',
);

console.log('panel resize stability smoke ok');
