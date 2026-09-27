import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const modelCardsSource = readProjectFile('src/components/settings/SettingsModelCards.tsx');
const sharedRendererSource = readProjectFile('src/components/pet/live2dSharedRenderer.ts');
const live2DRendererSource = readProjectFile('src/components/pet/PetLive2DRenderer.tsx');

assert.doesNotMatch(
  modelCardsSource,
  /PetModel3D|usePetContentManifest|resolvePetModel3DStandaloneSurface/u,
  'settings model cards must not create a complete 3D runtime for every preset',
);
assert.match(
  modelCardsSource,
  /<Box[\s\S]*3D MODEL/u,
  '3D preset cards should retain a lightweight format placeholder',
);
assert.match(
  sharedRendererSource,
  /layer\.destroy\(\{ children: false \}\)/u,
  'the shared Pixi layer must leave model destruction to the Live2D renderer',
);
assert.doesNotMatch(
  sharedRendererSource,
  /layer\.destroy\(\{ children: true \}\)/u,
  'releasing a shared layer must not recursively destroy its Live2D model',
);
assert.match(
  sharedRendererSource,
  /layer\.destroy\(\{ children: false \}\);[\s\S]*state\.app\.render\(\);[\s\S]*state\.app\.stop\(\)/u,
  'the shared canvas must render its cleared stage before the last Live2D registration stops',
);
assert.match(
  live2DRendererSource,
  /model\.destroy\(\{ baseTexture: false, children: true, texture: false \}\)/u,
  'the Live2D renderer should remain the owner of model destruction',
);

console.log('live2d to 3d switch cleanup smoke passed');
