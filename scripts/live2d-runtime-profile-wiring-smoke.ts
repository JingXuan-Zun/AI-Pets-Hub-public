import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readModuleProjectFile } from './projectModuleSource.mjs';

function readSource(relativeUrl: string) {
  return readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), 'utf8');
}

const typesSource = readSource('../src/types.ts');
const normalizationSource = readSource('../src/petConfigNormalization.ts');
const primaryLayerSource = readSource('../src/components/pet/PetAvatarLayer.tsx');
const companionLayerSource = readSource('../src/components/pet/PetCompanionLayer.tsx');
const visualRendererSource = readSource('../src/components/pet/PetVisualRenderer.tsx');
const live2DRendererSource = readModuleProjectFile('src/components/pet/PetLive2DRenderer.tsx');
const live2DModelRuntimeSource = readSource('../src/components/pet/live2dModelRuntime.ts');

assert.equal(
  live2DRendererSource.match(/Live2DModel\.from\(/gu)?.length ?? 0,
  1,
  'profile hot-update code must not introduce a second model loading path',
);

assert.match(
  typesSource,
  /interface PetModelPreset[\s\S]*live2dRuntimeProfile\?: Live2DRuntimeProfileConfigV1/u,
  'each model preset should own an optional Live2D runtime profile',
);
assert.match(
  normalizationSource,
  /live2dRuntimeProfile:\s*normalizeLive2DRuntimeProfileConfig\(preset\.live2dRuntimeProfile\) \?\? undefined/u,
  'persisted model profiles must pass through the versioned normalizer',
);
assert.match(
  primaryLayerSource,
  /matchedModelPreset\?\.live2dRuntimeProfile \?\? null/u,
  'the primary model should forward its matched profile',
);
assert.match(
  companionLayerSource,
  /matchedModelPreset\?\.live2dRuntimeProfile \?\? null/u,
  'companion slots should forward their own matched profiles',
);
assert.match(
  visualRendererSource,
  /<PetLive2DRenderer[\s\S]*live2dRuntimeProfile=\{live2dRuntimeProfile\}/u,
  'only the Live2D renderer should receive the Live2D profile',
);
assert.match(
  live2DRendererSource,
  /function replaceLive2DRuntimeControllers\([\s\S]*createLive2DPointerLookRuntimeController\(options\.model,[\s\S]*runtimeProfile:\s*options\.runtimeProfile[\s\S]*createLive2DPerformanceRuntimeController\(options\.model,[\s\S]*runtimeProfile:\s*options\.runtimeProfile/u,
  'pointer look and performance should consume the same resolved runtime profile',
);
assert.match(
  live2DRendererSource,
  /appliedRuntimeProfileSignatureRef\.current === options\.runtimeProfileSignature[\s\S]*resolveLive2DRuntimeProfileForModel\([\s\S]*replaceLive2DRuntimeControllers\(\{[\s\S]*runtimeProfile,[\s\S]*live2d runtime profile hot updated/u,
  'layout, pointer look, and performance should share one resolved runtime profile',
);
assert.match(
  live2DRendererSource,
  /declaredParameterIds = await loadLive2DDeclaredParameterIds\(model\)[\s\S]*resolveLive2DRuntimeProfileForModel\([\s\S]*declaredParameterIds/u,
  'model loading should resolve profiles from publicly declared display-info parameters',
);
assert.match(
  live2DModelRuntimeSource,
  /resolveLive2DRuntimeProfileForModel\([\s\S]*declaredParameterIds\?: ReadonlySet<string>[\s\S]*declaredParameterIds,/u,
  'the model runtime should forward declared parameter IDs into profile resolution',
);
assert.doesNotMatch(
  live2DRendererSource,
  /live2d runtime profile hot updated[\s\S]{0,500}setRuntimeReadyVersion/u,
  'profile hot updates must not replay motion/expression synchronization',
);

console.log('live2d runtime profile wiring smoke passed');
