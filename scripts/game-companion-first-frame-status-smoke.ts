import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const controllerSource = readProjectFile('src/components/pet/useGameCompanionLoopController.ts');
const petContainerSource = readProjectFile('src/components/PetContainer.tsx');
const loopStateSource = readProjectFile('src/components/pet/usePetContainerGameCompanionLoopState.ts');
const quickMenuSource = readProjectFile('src/components/pet/PetQuickActionMenu.tsx');
const panelsLayerSource = readProjectFile('src/components/pet/PetPanelsLayer.tsx');

assert.match(
  controllerSource,
  /export type GameCompanionSourceCheckStatus = 'idle' \| 'checking' \| 'ready' \| 'uncertain' \| 'error'/u,
  'game companion loop should expose a first-frame source check status type',
);
assert.match(
  controllerSource,
  /sourceCheckStatus: 'idle'/u,
  'stopped status should reset first-frame source check state',
);
assert.match(
  controllerSource,
  /sourceCheckMessage: '正在确认第一帧画面\.\.\.'/u,
  'loop start should publish a clear first-frame checking message',
);
assert.match(
  controllerSource,
  /FIRST_FRAME_AGENT_RESULT_TIMEOUT_MS = 12000/u,
  'Agent tool start should wait only briefly for first-frame confirmation',
);
assert.match(
  controllerSource,
  /firstFrameResultResolvers: \[\]/u,
  'loop state should initialize first-frame Agent result resolvers',
);
assert.match(
  controllerSource,
  /waitForFirstFrameToolResult\(startedState, startResult\)/u,
  'manage_game_companion_loop start should return the first-frame result to Agent when available',
);
assert.match(
  controllerSource,
  /createFirstFrameToolStateSummary[\s\S]*missingEvidence[\s\S]*recommendedRecovery/u,
  'first-frame tool result should include structured state for AgentSessionV2 recovery',
);
assert.match(
  controllerSource,
  /state\.sourceCheckStatus = 'error'[\s\S]*请先在游戏陪玩中选择一个游戏窗口或屏幕来源/u,
  'first missing thumbnail should be surfaced as a first-frame source error',
);
assert.match(
  controllerSource,
  /resolveFirstFrameToolResult\(state\)/u,
  'first-frame success or failure should resolve the pending Agent tool result',
);
assert.match(
  controllerSource,
  /updateSourceCheckFromAnalysis\(state, analysis, observationSummary, firstFrame\)/u,
  'first successful analysis should update first-frame source confidence',
);
assert.match(
  controllerSource,
  /options\.status === 'ready'[\s\S]*return compactCompanionText\(/u,
  'first-frame result should distinguish confirmed and uncertain visual evidence',
);
assert.match(
  controllerSource,
  /getGameCompanionObservationTrustIssue\(analysis\)[\s\S]*!trustIssue[\s\S]*state\.pendingCompanionReplyRevision === null/u,
  'uncertain first frames should not immediately produce companion chatter',
);
assert.match(
  loopStateSource,
  /handleGameCompanionSourcePreferenceChange[\s\S]*gameCompanionSourcePreferenceRef\.current = preference/u,
  'source preference updates should synchronously update the ref used by the loop controller',
);
assert.match(
  loopStateSource,
  /handleRestartGameCompanionLoopWithSourcePreference[\s\S]*handleGameCompanionSourcePreferenceChange\(preference\)[\s\S]*gameCompanionLoopControllerRef\.current\?\.start\(\)/u,
  'running source changes should restart the companion loop after applying the selected source',
);
assert.match(
  loopStateSource,
  /handleRestartGameCompanionLoopWithScreenSource[\s\S]*sourceType: 'screen'/u,
  'first-frame recovery should support restarting the loop against a screen source',
);

for (const [label, source] of [
  ['quick menu', quickMenuSource],
  ['floating badge', panelsLayerSource],
] as const) {
  assert.match(
    source,
    /gameCompanionLoopStatus\.running/u,
    `${label} should use game companion status copy`,
  );
  assert.match(
    source,
    /sourceCheckMessage[\s\S]*lastObservationSummary/u,
    `${label} should prefer first-frame check text before the latest observation summary`,
  );
  assert.doesNotMatch(
    source,
    /interactive Agent running/u,
    `${label} should not keep the old interactive Agent running copy`,
  );
}

assert.match(
  quickMenuSource,
  /sourceCheckStatus === 'uncertain'[\s\S]*sourceCheckStatus === 'error'/u,
  'quick menu should expose recovery actions only when the first-frame check is uncertain or failed',
);
assert.match(
  quickMenuSource,
  /openGameSourcePickerForRecovery[\s\S]*onRestartGameCompanionLoopWithScreenSource/u,
  'quick menu should offer reselect-source and watch-screen recovery actions',
);
assert.match(
  quickMenuSource,
  /applyGameCompanionSourcePreference[\s\S]*gameCompanionLoopStatus\.running[\s\S]*onRestartGameCompanionLoopWithSourcePreference/u,
  'source picker should restart the running loop instead of only saving a future preference',
);
assert.match(
  panelsLayerSource,
  /onRestartGameCompanionLoopWithScreenSource/u,
  'floating game companion badge should expose a direct watch-screen recovery action',
);

assert.match(
  panelsLayerSource,
  /resolveGameCompanionBadgePosition[\s\S]*petVisualBounds\.bottom/u,
  'floating game companion badge should be positioned below the pet visual bounds',
);
assert.match(
  panelsLayerSource,
  /transform: 'translateX\(-50%\)'/u,
  'floating game companion badge should be centered below the pet',
);
assert.match(
  panelsLayerSource,
  /const gameCompanionTextColor = config\.settings\.chatBracketOuterTextColor/u,
  'floating game companion badge text should use the chat text color setting',
);
assert.match(
  panelsLayerSource,
  /gameCompanionDetected \? 'border-white\/55 bg-white\/52' : 'border-violet-200 bg-white\/94'/u,
  'confirmed game detection should render the badge with a translucent background',
);

console.log('game companion first-frame status smoke ok');
