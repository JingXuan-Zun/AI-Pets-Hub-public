import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';
import { readModuleProjectFunction } from './projectModuleSource.mjs';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const probeSource = readProjectFile('src/components/pet/useLive2DDragReleaseProbe.ts');
const probeReportSource = readProjectFile('src/components/pet/live2dDragReleaseProbeReport.ts');
const probeSampleSource = readProjectFile('src/components/pet/live2dDragReleaseProbeSample.ts');
const probeFlagSource = readProjectFile('src/components/pet/live2dDragProbeFlag.ts');
const avatarLayerSource = readProjectFile('src/components/pet/PetAvatarLayer.tsx');
const companionLayerSource = readProjectFile('src/components/pet/PetCompanionLayer.tsx');
const live2DRendererSource = readModuleProjectFile('src/components/pet/PetLive2DRenderer.tsx');
const shellEffectsSource = readModuleProjectFile('src/components/pet/usePetContainerShellEffects.ts');
const electronMainSource = readProjectFile('electron/main.cjs');
const electronWindowManagerSource = readProjectFile('electron/windowManager.cjs');

assert.match(
  probeFlagSource,
  /LIVE2D_DRAG_PROBE_STORAGE_KEY = 'desktop-pet:live2d-drag-probe'[\s\S]*LIVE2D_DRAG_PROBE_QUERY_KEY = 'live2dDragProbe'[\s\S]*\?\? '0'[\s\S]*\['1', 'true', 'on', 'enabled', 'yes'\]\.includes\(rawValue\)/,
  'temporary Live2D drag probe should stay disabled unless explicitly enabled',
);

for (const expectedSelector of [
  'data-desktop-pet-live2d-renderer',
  'canvas',
  ' visual surface',
  ' window shape',
]) {
  assert.ok(
    probeSampleSource.includes(expectedSelector),
    `probe should sample ${expectedSelector}`,
  );
}

for (const expectedDriftKey of [
  'runtimePosition',
  'shell',
  'visualSurface',
  'live2dRenderer',
  'canvas',
  'windowShape',
]) {
  assert.ok(
    probeReportSource.includes(`${expectedDriftKey}: maxPointDrift`),
    `probe summary should distinguish ${expectedDriftKey} drift`,
  );
}

assert.match(
  probeReportSource,
  /const summary = summarizeProbeSamples\(options\.samples\)[\s\S]*TEMP live2d drag release probe summary[\s\S]*TEMP live2d drag release controller summary[\s\S]*TEMP live2d drag release head summary/,
  'probe should write a tagged temporary summary into runtime logs',
);

assert.match(
  probeReportSource,
  /currentX: summarizeNumericSeries[\s\S]*currentY: summarizeNumericSeries[\s\S]*postX: summarizeNumericSeries[\s\S]*preX: summarizeNumericSeries/,
  'probe should summarize controller movement and real Cubism head parameters',
);

assert.match(
  probeReportSource,
  /TIMELINE_TARGETS_MS[\s\S]*TEMP live2d drag release controller frame[\s\S]*TEMP live2d drag release rendered frame[\s\S]*TEMP live2d drag release largest head step/,
  'probe should persist bounded controller, rendered, and largest-step timeline evidence',
);

assert.match(
  probeSource,
  /LIVE2D_DRAG_PROBE_MAX_RUNS = 6[\s\S]*live2DDragProbeRunCount < LIVE2D_DRAG_PROBE_MAX_RUNS/,
  'probe should allow a bounded set of primary and companion comparisons',
);

assert.match(
  probeSource,
  /report\('completed'\)[\s\S]*report\('interrupted'\)/,
  'a repeated drag should persist its bounded partial release report before cancellation',
);

assert.match(
  avatarLayerSource,
  /useLive2DDragReleaseProbe\(\{[\s\S]*avatarShellRef[\s\S]*focusTarget[\s\S]*pointerLookTarget[\s\S]*position: petPos/,
  'primary avatar layer should wire the Live2D drag release probe at the layer boundary',
);

assert.match(
  companionLayerSource,
  /useLive2DDragReleaseProbe\(\{[\s\S]*avatarShellRef: companionShellRef[\s\S]*petId: slot\.id[\s\S]*position: slot\.position/,
  'companion layer should wire the same Live2D drag release probe at its layer boundary',
);

assert.match(
  live2DRendererSource,
  /data-desktop-pet-live2d-renderer="true"[\s\S]*data-live2d-look-settle=\{shouldSettleLive2DLook \? '1' : '0'\}[\s\S]*data-live2d-look-source=\{lookPositionRef\.current\.source\}/,
  'Live2D renderer should expose pointer-look diagnostic data for the probe',
);

assert.match(
  live2DRendererSource,
  /LIVE2D_FALLBACK_BOUNDS_PROBE_LIMIT[\s\S]*TEMP live2d fallback bounds probe[\s\S]*fallbackBoundsSignature[\s\S]*stageSize[\s\S]*viewport/,
  'Live2D fallback-bounds probe should record the changing variables with a hard log limit',
);

assert.doesNotMatch(
  live2DRendererSource,
  /options\.isMoving \? 'moving' : 'idle'/,
  'Live2D fallback-bounds signatures should not alternate between moving and idle for the same stage size',
);

assert.match(
  shellEffectsSource,
  /LIVE2D_NATIVE_REGION_PROBE_LIMIT[\s\S]*TEMP native interactive region probe[\s\S]*reason[\s\S]*scheduleSource[\s\S]*signature/,
  'native interactive-region probe should record sync cause and region signatures with a hard log limit',
);

assert.match(
  electronMainSource,
  /DESKTOP_PET_LIVE2D_DRAG_PROBE === '1'[\s\S]*process\.argv\.includes\('--live2d-drag-probe'\)[\s\S]*live2dDragProbe: '1'/,
  'packaged app should allow enabling the temporary Live2D drag probe through an environment variable',
);

assert.match(
  electronMainSource,
  /dragDiagnosticsEnabled \|\| live2DDragProbeEnabled[\s\S]*live2DDragProbeEnabled \? 'live2d-drag-probe' : 'drag-diagnostics-v2'/,
  'the Live2D drag probe switch should persist runtime evidence without requiring general drag tracing',
);

assert.match(
  electronWindowManagerSource,
  /DESKTOP_PET_LIVE2D_DRAG_PROBE === '1'[\s\S]*process\.argv\.includes\('--live2d-drag-probe'\)/,
  'main desktop window should retain both explicit Live2D drag probe switches',
);

assert.match(
  readModuleProjectFunction('electron/windowManager/rendererNavigation.cjs', 'createWindowManagerRendererNavigation'),
  /createRendererNavigation\(\{[\s\S]*queryOptions: \{[\s\S]*live2DDragProbeEnabled,/,
  'window manager should pass its captured probe flag into renderer navigation',
);

const rendererNavigation = readModuleProjectFunction(
  'electron/windowManager/rendererNavigation.cjs', 'createRendererNavigation',
);
assert.match(rendererNavigation, /const \{ live2DDragProbeEnabled \} = queryOptions/);
assert.match(
  rendererNavigation,
  /const nextQuery = buildRendererQuery\(query, queryOptions\)[\s\S]*if \(live2DDragProbeEnabled\)[\s\S]*loadRenderer: live2d drag probe enabled/,
  'navigation should construct the probe query and retain its diagnostic log',
);
assert.match(
  readModuleProjectFunction('electron/windowManager/rendererQuery.cjs', 'buildRendererQuery'),
  /live2DDragProbeEnabled \? \{ live2dDragProbe: '1' \} : \{\}/,
  'query construction should forward the probe flag only when explicitly enabled',
);

console.log('live2d drag release probe smoke passed');

assert.match(readModuleProjectFunction('electron/windowManager.cjs', 'createWindowManager'),
  /createWindowManagerRendererNavigation\(\{[\s\S]*localTestQueryValues, pointerDiagnosticsEnabled, forceFullShapeOnDragEnabled, live2DDragProbeEnabled,/);
