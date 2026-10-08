import assert from 'node:assert/strict';
import {
  canModelTypeUseMotionBindings,
  getSupportedLive2DModelAcceptAttribute,
  resolveLive2DExpressionFormatFromFileName,
  resolveLive2DMotionFormatFromFileName,
} from '../src/pet-runtime/live2d/live2dModelSupport.ts';
import {
  resolveLive2DExpressionCandidates,
  resolveLive2DExternalExpressionDefinitions,
  resolveLive2DExternalMotionGroups,
  resolveLive2DMotionGroupCandidates,
} from '../src/pet-runtime/live2d/live2dRuntimeMapping.ts';
import {
  isPetContentManifest,
  resolvePetContentMotionAssetSources,
  type PetContentManifest,
} from '../src/pet-runtime/content/petContentManifest.ts';
import {
  createLive2DExpressionMotionBindings,
  resolveLive2DExpressionAssetsFromDirectoryEntries,
  resolveLive2DExpressionAssetsFromModelJsonText,
} from '../src/pet-runtime/live2d/live2dExpressionDiscovery.ts';
import {
  getSupportedCustomMotionAcceptAttribute,
  resolveCustomMotionFormatFromFileName,
} from '../src/components/settings/settingsModelImportUtils.ts';
import { resolveLive2DViewportShellSize } from '../src/components/pet/petVisualBounds.ts';
import {
  attachLive2DModelToApplicationTicker,
  resolveLive2DSharedLayerPosition,
} from '../src/components/pet/live2dSharedRenderer.ts';
import { type PetModelMotionBinding } from '../src/types.ts';
import { readProjectFile } from './smokeTestHarness.ts';
import { readModuleProjectFile } from './projectModuleSource.mjs';

assert.equal(canModelTypeUseMotionBindings('3d'), true);
assert.equal(canModelTypeUseMotionBindings('live2d'), true);
assert.equal(canModelTypeUseMotionBindings('2d'), false);
assert.equal(
  resolveLive2DViewportShellSize(3, false),
  resolveLive2DViewportShellSize(3, true),
  'Live2D viewport shell size should stay fixed across moving and idle states to avoid release-time layout jitter',
);
assert.equal(resolveLive2DViewportShellSize(3, false), 768);
assert.equal(resolveLive2DViewportShellSize(3.5, false), 864);
assert.equal(resolveLive2DViewportShellSize(4, false), 960);
assert.ok(
  resolveLive2DViewportShellSize(3.75, false) < resolveLive2DViewportShellSize(4, false),
  'Live2D visual scaling must not plateau before the 4x control ceiling',
);
assert.deepEqual(
  resolveLive2DSharedLayerPosition({
    canvasLeft: 0,
    canvasTop: 0,
    containerHeight: 128,
    containerLeft: 320,
    containerTop: 180,
    containerWidth: 128,
    stageSize: 256,
  }),
  { x: 256, y: 116 },
  'a minimum-size Live2D shell must center its larger renderer stage instead of offsetting the model down-right',
);
assert.deepEqual(
  resolveLive2DSharedLayerPosition({
    canvasLeft: 0,
    canvasTop: 0,
    containerHeight: 256,
    containerLeft: 320,
    containerTop: 180,
    containerWidth: 256,
    stageSize: 256,
  }),
  { x: 320, y: 180 },
);
assert.deepEqual(
  resolveLive2DSharedLayerPosition({
    canvasLeft: 10,
    canvasTop: 20,
    containerHeight: 960,
    containerLeft: 320,
    containerTop: 180,
    containerWidth: 960,
    stageSize: 960,
  }),
  { x: 310, y: 160 },
);

const tickerListeners: Array<{ listener: () => void; context: unknown }> = [];
const fakeApplication = {
  ticker: {
    deltaMS: 16.67,
    add(listener: () => void, context: unknown) {
      tickerListeners.push({ context, listener });
    },
    remove(listener: () => void, context: unknown) {
      for (let index = tickerListeners.length - 1; index >= 0; index -= 1) {
        if (tickerListeners[index]?.listener === listener && tickerListeners[index]?.context === context) {
          tickerListeners.splice(index, 1);
        }
      }
    },
  },
};
const firstModelUpdates: number[] = [];
const secondModelUpdates: number[] = [];
const firstTickerHandle = attachLive2DModelToApplicationTicker(
  fakeApplication as never,
  { update: (deltaMs) => firstModelUpdates.push(deltaMs) },
);
const secondTickerHandle = attachLive2DModelToApplicationTicker(
  fakeApplication as never,
  { update: (deltaMs) => secondModelUpdates.push(deltaMs) },
);
tickerListeners.forEach(({ listener }) => listener());
assert.equal(firstModelUpdates.length, 1);
assert.equal(secondModelUpdates.length, 1);
firstTickerHandle.release();
tickerListeners.forEach(({ listener }) => listener());
assert.equal(firstModelUpdates.length, 1, 'releasing one model must not stop its sibling update');
assert.equal(secondModelUpdates.length, 2);
secondTickerHandle.release();
assert.equal(tickerListeners.length, 0);

const failingModelUpdates: number[] = [];
const siblingModelUpdates: number[] = [];
const tickerErrorCounts: number[] = [];
attachLive2DModelToApplicationTicker(
  fakeApplication as never,
  {
    update: () => {
      failingModelUpdates.push(1);
      throw new Error('simulated switched-model update failure');
    },
  },
  { onError: (_error, consecutiveErrorCount) => tickerErrorCounts.push(consecutiveErrorCount) },
);
attachLive2DModelToApplicationTicker(
  fakeApplication as never,
  { update: () => siblingModelUpdates.push(1) },
);
assert.doesNotThrow(() => tickerListeners.forEach(({ listener }) => listener()));
assert.equal(failingModelUpdates.length, 1);
assert.deepEqual(tickerErrorCounts, [1]);
assert.equal(
  siblingModelUpdates.length,
  1,
  'a switched-model update failure must not stop sibling Live2D updates',
);
assert.equal(resolveLive2DMotionFormatFromFileName('Idle.motion3.json'), 'motion3');
assert.equal(resolveLive2DExpressionFormatFromFileName('害羞.exp3.json'), 'exp3');
assert.equal(resolveCustomMotionFormatFromFileName('害羞.exp3.json'), 'exp3');
assert.equal(getSupportedLive2DModelAcceptAttribute(), '.model3.json,.model.json');
assert.match(getSupportedCustomMotionAcceptAttribute(), /\.motion3\.json/u);
assert.match(getSupportedCustomMotionAcceptAttribute(), /\.exp3\.json/u);
const live2dManifest = {
  id: 'live2d-test',
  model: {
    type: 'live2d',
    url: 'C:/models/live2d/test/test.model3.json',
  },
  motions: {
    idle: {
      clips: ['idle_custom'],
      sources: [
        {
          format: 'motion3',
          motionNames: ['idle_external'],
          url: 'motions/Idle.motion3.json',
        },
      ],
    },
  },
  name: 'Live2D Test',
} satisfies PetContentManifest;

assert.equal(isPetContentManifest(live2dManifest), true);
assert.deepEqual(
  resolvePetContentMotionAssetSources(live2dManifest, 'idle', 'C:/models/live2d/test/test.model3.json')
    .map((source) => source.format),
  ['motion3'],
);

const live2dMotionBindings = [
  {
    clipNames: ['Idle01'],
    format: 'motion3',
    id: 'binding-idle',
    motionKey: 'idle',
    name: 'Idle Motion',
    sourceUrl: 'C:/models/live2d/test/motions/Idle.motion3.json',
  },
  {
    clipNames: ['害羞'],
    format: 'exp3',
    id: 'binding-shy-expression',
    kind: 'expression',
    motionKey: 'happy',
    name: '害羞',
    semanticAliases: ['脸红'],
    semanticTags: ['表情'],
    sourceUrl: 'C:/models/live2d/test/expressions/害羞.exp3.json',
  },
] satisfies PetModelMotionBinding[];

const externalGroups = resolveLive2DExternalMotionGroups({
  contentManifest: live2dManifest,
  motionBindings: live2dMotionBindings,
});
assert.ok(externalGroups.idle?.length);
assert.ok(externalGroups['Idle Motion']?.length);
assert.ok(externalGroups.Idle01?.length);
assert.equal(externalGroups['害羞'], undefined, 'Live2D expression bindings must not be registered as motion groups');

const externalExpressions = resolveLive2DExternalExpressionDefinitions({
  motionBindings: live2dMotionBindings,
});
assert.ok(externalExpressions.some((definition) => definition.Name === '害羞'));
assert.ok(externalExpressions.some((definition) => definition.Name === '脸红'));
assert.ok(externalExpressions.every((definition) => definition.File.length > 0));
assert.ok(externalExpressions.every((definition) => decodeURIComponent(definition.File).includes('害羞.exp3.json')));

const declaredExpressionAssets = resolveLive2DExpressionAssetsFromModelJsonText(JSON.stringify({
  Version: 3,
  FileReferences: {
    Expressions: [
      { Name: '害羞', File: 'expressions/害羞.exp3.json' },
      { File: '哭.exp3.json' },
    ],
  },
}), 'C:/models/live2d/test/test.model3.json');
assert.equal(declaredExpressionAssets.length, 2);
assert.equal(declaredExpressionAssets[0]?.name, '害羞');
assert.ok(decodeURIComponent(declaredExpressionAssets[0]?.sourceUrl ?? '').includes('害羞.exp3.json'));

const sidecarExpressionAssets = resolveLive2DExpressionAssetsFromDirectoryEntries([
  {
    kind: 'file',
    name: '害羞.exp3.json',
    path: 'C:/models/live2d/test/害羞.exp3.json',
  },
  {
    kind: 'file',
    name: 'Scene1.motion3.json',
    path: 'C:/models/live2d/test/Scene1.motion3.json',
  },
], 'C:/models/live2d/test/test.model3.json');
assert.deepEqual(sidecarExpressionAssets.map((asset) => asset.name), ['害羞']);

const discoveredExpressionBindings = createLive2DExpressionMotionBindings(
  sidecarExpressionAssets,
  { idPrefix: 'live2d-test' },
);
assert.equal(discoveredExpressionBindings[0]?.kind, 'expression');
assert.equal(discoveredExpressionBindings[0]?.format, 'exp3');
assert.equal(discoveredExpressionBindings[0]?.name, '害羞');

const motionCandidates = resolveLive2DMotionGroupCandidates({
  action: 'IDLE',
  contentManifest: live2dManifest,
  isMoving: false,
  manualMotionBinding: live2dMotionBindings[0],
});
assert.equal(motionCandidates.motionKey, 'idle');
assert.ok(motionCandidates.candidates.includes('Idle Motion'));
assert.ok(motionCandidates.candidates.includes('Idle01'));

const expressionCandidates = resolveLive2DExpressionCandidates({
  contentManifest: live2dManifest,
  expressionAction: null,
  manualMotionBinding: live2dMotionBindings[1],
});
assert.equal(expressionCandidates.expressionKey, '害羞');
assert.ok(expressionCandidates.candidates.includes('害羞'));
assert.ok(expressionCandidates.candidates.includes('脸红'));

const expressionAsMotionCandidates = resolveLive2DMotionGroupCandidates({
  action: 'IDLE',
  contentManifest: live2dManifest,
  isMoving: false,
  manualMotionBinding: live2dMotionBindings[1],
});
assert.equal(expressionAsMotionCandidates.motionKey, 'idle');
assert.equal(expressionAsMotionCandidates.candidates.includes('害羞'), false);

const typeSource = readProjectFile('src/types.ts');
const visualRendererSource = readProjectFile('src/components/pet/PetVisualRenderer.tsx');
const modelImportSource = readProjectFile('src/components/settings/settingsModelImportUtils.ts');
const modelAssetsStateSource = readProjectFile('src/components/settings/useSettingsPanelModelAssetsState.ts');
const controlsTabSource = readProjectFile('src/components/settings/SettingsMotionExpressionTab.tsx');
const cardsSource = readProjectFile('src/components/settings/SettingsModelCards.tsx');
const customMotionSelectionSource = readProjectFile('src/components/pet/usePetContainerCustomMotionSelection.ts');
const motionBindingsSource = readProjectFile('src/pet-runtime/content/petModelMotionBindings.ts');
const motionBindingKindsSource = readProjectFile('src/pet-runtime/content/petModelMotionBindingKinds.ts');
const live2dRendererSource = readModuleProjectFile('src/components/pet/PetLive2DRenderer.tsx');
const live2dModelRuntimeSource = readProjectFile('src/components/pet/live2dModelRuntime.ts');
const live2dMotionExpressionSyncSource = readProjectFile('src/components/pet/useLive2DMotionExpressionSync.ts');
const live2dCoreLoaderSource = readProjectFile('src/pet-runtime/live2d/live2dCubismCoreLoader.ts');
const live2dVisualSurfaceSource = readProjectFile('src/components/pet/petVisualRendererSurface.ts');
const live2dSharedRendererSource = readProjectFile('src/components/pet/live2dSharedRenderer.ts');
const live2dSharedRendererFrameSource = readProjectFile('src/components/pet/live2dSharedRendererFrame.ts');

assert.match(typeSource, /ModelType = '2d' \| '3d' \| 'live2d'/u);
assert.match(typeSource, /PetModelMotionAssetFormat = 'exp3' \| 'fbx' \| 'glb' \| 'gltf' \| 'motion3' \| 'vrma'/u);
assert.match(typeSource, /PetModelMotionBindingKind = 'expression' \| 'motion'/u);
assert.match(visualRendererSource, /modelType === 'live2d'/u);
assert.match(visualRendererSource, /<PetLive2DRenderer/u);
assert.match(visualRendererSource, /viewport=\{viewport\}/u);
assert.match(modelImportSource, /isLive2DModelFileName\(file\.name\)/u);
assert.match(modelImportSource, /resolveLive2DMotionFormatFromFileName/u);
assert.match(modelAssetsStateSource, /format === 'motion3' \|\| format === 'exp3'/u);
assert.match(modelAssetsStateSource, /kind: motionSource\.format === 'exp3' \? 'expression' : 'motion'/u);
assert.match(modelAssetsStateSource, /fileToCustomLive2DModelUrl\(file\)/u);
assert.match(controlsTabSource, /Settings2DAnimationSection/u);
assert.match(controlsTabSource, /custom3DModelPresets/u);
assert.match(controlsTabSource, /customLive2DModelPresets/u);
assert.match(controlsTabSource, /motion3dFileInputRef/u);
assert.match(controlsTabSource, /live2dMotionFileInputRef/u);
assert.match(controlsTabSource, /accept=\{getLive2DMotionImportAcceptAttribute\(\)\}/u);
assert.match(cardsSource, /preset\.type === 'live2d'/u);
assert.doesNotMatch(cardsSource, /preset\.type === 'live2d'[\s\S]{0,400}<PetModel3D/u);
assert.match(customMotionSelectionSource, /canModelTypeUseMotionBindings\(targetSlot\.modelType\)/u);
assert.match(motionBindingsSource, /preset\.type !== '3d' && preset\.type !== 'live2d'/u);
assert.match(motionBindingKindsSource, /isPetModelExpressionBinding/u);
assert.match(motionBindingKindsSource, /format === 'exp3'/u);

assert.doesNotMatch(
  live2dRendererSource,
  /import\s*\{(?!\s*type\b)[^}]*\}\s*from\s*['"]pixi-live2d-display\/cubism4['"]/u,
);
assert.doesNotMatch(live2dRendererSource, /['"]pixi-live2d-display\/cubism4['"]/u);
assert.match(live2dRendererSource, /loadLive2DCubism4Runtime/u);
assert.match(live2dRendererSource, /syncLive2DModelPresentation/u);
assert.match(live2dRendererSource, /type Live2DModelLike/u);
assert.match(live2dModelRuntimeSource, /import\s+type\s+\{[^}]*\}\s+from\s+['"]pixi-live2d-display\/cubism4['"]/u);
assert.match(live2dModelRuntimeSource, /await ensureLive2DCubism4Core\(\);[\s\S]*import\('pixi-live2d-display\/cubism4'\)/u);
assert.match(live2dMotionExpressionSyncSource, /canRotateLive2DIdleMotion/u);
assert.match(live2dMotionExpressionSyncSource, /rotateLive2DMotionCandidates/u);
assert.match(live2dMotionExpressionSyncSource, /resolveLive2DAvailableMotionCandidateGroups/u);
assert.doesNotMatch(
  live2dMotionExpressionSyncSource,
  /availableCandidateCount:\s*candidates\.length/u,
  'Live2D idle rotation should count actual available motion groups, not raw alias candidates',
);
assert.match(live2dMotionExpressionSyncSource, /clearIdleMotionRotationTimer/u);
assert.doesNotMatch(live2dRendererSource, /LIVE2D_STAGE_SIZE/u);
assert.match(live2dRendererSource, /resolveLive2DRendererStageSize\(viewport\)/u);
assert.match(live2dSharedRendererSource, /new Application\(appOptions\)/u);
assert.match(live2dSharedRendererSource, /resolveLive2DSharedLayerPosition/u);
assert.match(live2dSharedRendererSource, /setStageSize:\s*\(stageSize:\s*number\)/u);
assert.match(live2dRendererSource, /acquireLive2DSharedRenderer\(container,\s*stageSize,\s*runtimePetId\)/u);
assert.match(live2dRendererSource, /sharedRendererHandleRef\.current\?\.setStageSize\(stageSize\)/u);
assert.match(
  live2dRendererSource,
  /function createLive2DFallbackBoundsSignature\(options: \{[\s\S]*modelUrl:\s*string;[\s\S]*options\.modelUrl[\s\S]*createLive2DFallbackBoundsSignature\(\{[\s\S]*modelUrl,[\s\S]*\}, \[isDragging, isMoving, modelUrl,/u,
  'Live2D-to-Live2D model switches must invalidate and re-emit fallback visual bounds',
);
assert.match(
  live2dRendererSource,
  /runtimeContextRef = useRef[\s\S]*runtimeContextRef\.current = \{[\s\S]*onRuntimeEvent[\s\S]*\}, \[modelRuntimeUrl, modelUrl, onRuntimeEvent, runtimePetId\]\);/u,
  'Live2D Pixi Application should not be destroyed and recreated just because runtime callbacks change during drag renders',
);
assert.doesNotMatch(
  live2dRendererSource,
  /new Application\(/u,
  'individual Live2D model components must reuse the shared Pixi Application/WebGL context',
);
assert.match(
  live2dSharedRendererSource,
  /let sharedRendererState:[\s\S]*function getSharedRendererState\(\)[\s\S]*sharedRendererState = createSharedRendererState\(\)/u,
  'Live2D renderer initialization should remain shared across mounted model components',
);
assert.match(
  live2dRendererSource,
  /resetMotionExpressionSignaturesRef\.current = resetMotionExpressionSignatures/u,
  'motion/expression cleanup should stay current without becoming a model lifecycle dependency',
);
assert.match(
  live2dRendererSource,
  /Live2DModel\.from\(options\.modelRuntimeUrl,[\s\S]*model\.destroy\(\{\s*baseTexture:\s*false,\s*children:\s*true,\s*texture:\s*false\s*\}\);[\s\S]*useEffect\(\(\) => \{[\s\S]*\}, \[options\.modelRuntimeUrl\]\);/u,
  'only a Live2D model URL change may replace the model inside the persistent Pixi Application',
);
assert.doesNotMatch(
  live2dRendererSource,
  /\}, \[[^\]]*live2dRuntimeProfile[^\]]*modelRuntimeUrl[^\]]*resetMotionExpressionSignatures[^\]]*\]\);/u,
  'Live2D profile calibration must not reload the model or replay its current motion',
);
assert.match(
  live2dRendererSource,
  /modelLayer\.addChild\(model\);[\s\S]*app\.start\(\);[\s\S]*app\.render\(\);/u,
  'a switched Live2D model should explicitly start the persistent app and paint its first frame',
);
assert.match(
  live2dRendererSource,
  /model\.destroy\(\{\s*baseTexture:\s*false,\s*children:\s*true,\s*texture:\s*false\s*\}\)/u,
  'Live2D model replacement should not destroy shared PIXI textures/baseTextures',
);
assert.match(
  live2dSharedRendererSource,
  /if \(state\.registrations\.size === 0\) \{\s*state\.app\.stop\(\);/u,
  'the shared Live2D Application should stop only after its final model registration is released',
);
assert.match(
  live2dSharedRendererSource,
  /function attachLive2DModelToApplicationTicker\([\s\S]*app\.ticker\.add\(updateModel, model, UPDATE_PRIORITY\.NORMAL\)[\s\S]*app\.ticker\.remove\(updateModel, model\)/u,
  'each Live2D model must own an update registration on the shared Application ticker',
);
assert.match(
  live2dSharedRendererSource + live2dSharedRendererFrameSource,
  /autoStart:\s*false[\s\S]*app\.ticker\.remove\(app\.render, app\)[\s\S]*app\.ticker\.add\(safeRender, app, UPDATE_PRIORITY\.LOW\)/u,
  'the shared Live2D renderer must isolate model replacement render failures from the shared ticker',
);
assert.match(
  live2dRendererSource,
  /model\.autoUpdate\s*=\s*false;[\s\S]*attachLive2DModelToApplicationTicker\(app, model[,\s]/u,
  'Live2D models must not use the global Ticker.shared auto-update path',
);
assert.doesNotMatch(
  live2dRendererSource,
  /app\.stage\.updateTransform\(\)/u,
  'Live2D bounds probes must not call updateTransform directly on the parentless root stage',
);
assert.match(
  live2dSharedRendererSource,
  /state\.registrations\.add\(registration\);[\s\S]*state\.app\.start\(\);/u,
  'a later Live2D layer mount must restart the shared Application after the final layer was released',
);
assert.doesNotMatch(
  live2dRendererSource,
  /appRef\.current\?\.destroy\(true,\s*\{\s*baseTexture:\s*true,\s*children:\s*true,\s*texture:\s*true\s*\}\)/u,
  'Live2D cleanup must avoid the old aggressive texture-destroy path',
);
assert.match(
  live2dSharedRendererSource,
  /const appOptions:[\s\S]*backgroundAlpha:\s*0,[\s\S]*premultipliedAlpha:\s*false,[\s\S]*useContextAlpha:\s*'notMultiplied'[\s\S]*const app = new Application\(appOptions\)/u,
  'Live2D Pixi canvas should keep a non-premultiplied transparent WebGL context on the transparent desktop shell',
);
assert.doesNotMatch(
  live2dSharedRendererSource,
  /transparent:\s*true/u,
  'Live2D Pixi renderer should not use deprecated transparent:true because Pixi v6 lets it override useContextAlpha',
);
assert.match(
  live2dSharedRendererSource,
  /app\.renderer\.backgroundAlpha\s*=\s*0/u,
  'Live2D renderer should reassert a transparent clear alpha after Application creation',
);
assert.match(
  live2dSharedRendererSource,
  /app\.view\.style\.backgroundColor\s*=\s*'transparent'/u,
  'Live2D canvas DOM element should not paint a dark background when Electron shape exposes it',
);
assert.match(live2dModelRuntimeSource, /fitLive2DModelToStage\(model,\s*options\.stageSize,\s*runtimeProfile\)/u);
assert.match(live2dModelRuntimeSource, /resolveLive2DRuntimeProfileForModel/u);
assert.match(live2dModelRuntimeSource, /injectExternalLive2DExpressions/u);
assert.match(live2dModelRuntimeSource, /resolveLive2DExternalExpressionDefinitions/u);
assert.match(live2dRendererSource, /manualMotionBindingForMotion/u);
assert.doesNotMatch(live2dModelRuntimeSource, /fitScale[\s\S]{0,220}\*\s*safeScale/u);
assert.doesNotMatch(
  live2dRendererSource,
  /fallbackBounds[\s\S]{0,260}\*\s*safeScale/u,
  'Live2D fallback visual bounds should not multiply user scale because the shell/stage already scales with user size',
);
assert.match(
  live2dRendererSource,
  /function resolveLive2DFallbackBounds\(options: \{[\s\S]*stageSize:\s*number;[\s\S]*void options\.isMoving;[\s\S]*const stageScale = Math\.max\([\s\S]*LIVE2D_BASE_STAGE_SIZE[\s\S]*bottom:\s*Math\.round\(116 \* stageScale\)[\s\S]*left:\s*Math\.round\(90 \* stageScale\)/u,
  'Live2D fallback bounds should be converted from the 256px baseline to the actual stage CSS size while staying stable across moving and idle states',
);
assert.doesNotMatch(
  live2dRendererSource,
  /const motionPadding = options\.isMoving \?/u,
  'Live2D fallback visual bounds should not alternate between moving and idle padding',
);
assert.doesNotMatch(
  live2dRendererSource,
  /emitLive2DFallbackBounds\(\{[\s\S]{0,220}scale,/u,
  'Live2D fallback bounds should not receive user scale directly because the shell/stage already resolved the current size',
);
assert.match(live2dVisualSurfaceSource, /modelType === 'live2d'/u);
assert.match(live2dVisualSurfaceSource, /resolveLive2DViewportShellSize\(scale,\s*visualRendererIsMoving\)/u);
assert.match(live2dVisualSurfaceSource, /isLive2DPresentation/u);
assert.match(live2dCoreLoaderSource, /'\/live2d\/live2dcubismcore\.js'/u);
assert.match(live2dCoreLoaderSource, /'\/live2d\/live2dcubismcore\.min\.js'/u);

console.log('live2d runtime support smoke ok');
