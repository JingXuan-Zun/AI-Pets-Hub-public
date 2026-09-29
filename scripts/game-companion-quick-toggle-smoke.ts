import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  gameCompanionLoopStateSource,
  petContainerSource,
  quickMenuSource,
  panelsLayerSource,
} = readProjectSources({
  gameCompanionLoopStateSource: 'src/components/pet/usePetContainerGameCompanionLoopState.ts',
  petContainerSource: 'src/components/PetContainer.tsx',
  quickMenuSource: 'src/components/pet/PetQuickActionMenu.tsx',
  panelsLayerSource: 'src/components/pet/PetPanelsLayer.tsx',
});

const toggleHandler = gameCompanionLoopStateSource.match(
  /const handleToggleGameCompanionLoop = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[gameCompanionLoopStatus\.running\]\);/u,
)?.[0] ?? '';

assert.ok(toggleHandler, 'game companion state hook should define the toggle handler');
assert.match(
  toggleHandler,
  /gameCompanionLoopStatus\.running[\s\S]*gameCompanionLoopControllerRef\.current\?\.stop\(\)[\s\S]*gameCompanionLoopControllerRef\.current\?\.start\(\)/u,
  'game companion quick entry should toggle the loop directly',
);
assert.doesNotMatch(
  gameCompanionLoopStateSource,
  /openInteractiveDialogue|setInputValue/u,
  'game companion quick entry should not open interactive dialogue or prefill an Agent draft',
);
assert.match(
  petContainerSource,
  /handleToggleGameCompanionLoop[\s\S]*usePetContainerGameCompanionLoopState[\s\S]*onToggleGameCompanionLoop: handleToggleGameCompanionLoop/u,
  'PetContainer should wire the game companion toggle from the state hook into the panels layer',
);
assert.doesNotMatch(
  petContainerSource,
  /INTERACTIVE_AGENT_DRAFT|onOpenInteractiveAgent/u,
  'old interactive Agent draft entry should be removed from PetContainer',
);

assert.match(
  quickMenuSource,
  /onToggleGameCompanionLoop/u,
  'quick menu should receive the game companion toggle prop',
);
assert.match(
  quickMenuSource,
  /handleGameCompanionToggle[\s\S]*gameCompanionSourcePreference[\s\S]*openGameSourcePickerForRecovery/u,
  'quick menu should ask for a game source before starting without an explicit selection',
);
assert.match(
  quickMenuSource,
  /关闭游戏陪玩[\s\S]*开启游戏陪玩[\s\S]*不进入互动对话/u,
  'quick menu copy should present game companion as a switch without entering interactive dialogue',
);
assert.match(
  quickMenuSource,
  /游戏来源/u,
  'quick menu should keep the selected game source control',
);

const gameCompanionButtonStart = quickMenuSource.indexOf('onClick={handleGameCompanionToggle}');
const gameCompanionButtonEnd = gameCompanionButtonStart >= 0
  ? quickMenuSource.indexOf('</button>', gameCompanionButtonStart)
  : -1;
const gameCompanionButton = gameCompanionButtonStart >= 0 && gameCompanionButtonEnd >= 0
  ? quickMenuSource.slice(gameCompanionButtonStart, gameCompanionButtonEnd)
  : '';

assert.ok(gameCompanionButton, 'quick menu should render a game companion toggle button');
assert.doesNotMatch(
  gameCompanionButton,
  /互动 Agent|互动来源|适合陪玩观察/u,
  'quick menu should not show the old interactive Agent copy',
);

assert.match(
  panelsLayerSource,
  /onToggleGameCompanionLoop/u,
  'panels layer should forward the game companion toggle prop',
);
assert.match(
  panelsLayerSource,
  /游戏陪玩中[\s\S]*停止游戏陪玩/u,
  'running badge should use game companion copy',
);
assert.doesNotMatch(
  panelsLayerSource,
  /互动 Agent/u,
  'running badge should not use old interactive Agent copy',
);

console.log('game companion quick toggle smoke ok');
