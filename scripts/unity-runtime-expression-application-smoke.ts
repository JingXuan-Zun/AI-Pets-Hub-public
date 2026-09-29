import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

function assertLineBudget(source: string, label: string) {
  const lineCount = source.split(/\r?\n/u).length;
  assert.ok(lineCount <= 300, `${label} should stay below the 300-line source target`);
}

const runtimeSessionSource = readProjectFile('scripts/unity-runtime-src/Runtime/AvatarRuntimeSession.cs');
const diagnosticReporterSource = readProjectFile('scripts/unity-runtime-src/Runtime/AvatarExpressionDiagnosticReporter.cs');
const eventSource = readProjectFile('scripts/unity-runtime-src/Bridge/AvatarBridgeEvent.cs');
const runtimeOverridesSource = readProjectFile('scripts/unity-runtime-src/Bridge/AvatarBridgeRuntimeOverrides.cs');
const resultSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarExpressionApplicationResult.cs');
const expressionControllerSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarExpressionController.cs');
const expressionCandidatesSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarExpressionCandidates.cs');
const vrmExpressionResultSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarVrmExpressionApplyResult.cs');
const vrmExpressionKeyResolverSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarVrmExpressionKeyResolver.cs');
const vrmExpressionAdapterSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarVrmExpressionAdapter.cs');
const blendShapeExpressionMatchSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarBlendShapeExpressionMatch.cs');
const blendShapeExpressionAdapterSource = readProjectFile(
  'scripts/unity-runtime-src/Avatar/AvatarBlendShapeExpressionAdapter.cs',
);
const buildUnityRuntimeSource = readProjectFile('scripts/build-unity-runtime.mjs');

for (const [label, source] of [
  ['AvatarExpressionController.cs', expressionControllerSource],
  ['AvatarExpressionApplicationResult.cs', resultSource],
  ['AvatarExpressionCandidates.cs', expressionCandidatesSource],
  ['AvatarVrmExpressionApplyResult.cs', vrmExpressionResultSource],
  ['AvatarVrmExpressionKeyResolver.cs', vrmExpressionKeyResolverSource],
  ['AvatarVrmExpressionAdapter.cs', vrmExpressionAdapterSource],
  ['AvatarBlendShapeExpressionMatch.cs', blendShapeExpressionMatchSource],
  ['AvatarBlendShapeExpressionAdapter.cs', blendShapeExpressionAdapterSource],
  ['AvatarExpressionDiagnosticReporter.cs', diagnosticReporterSource],
  ['AvatarBridgeEvent.cs', eventSource],
  ['AvatarBridgeRuntimeOverrides.cs', runtimeOverridesSource],
] as const) {
  assertLineBudget(source, label);
}

assert.match(
  runtimeSessionSource,
  /private\s+readonly\s+AvatarExpressionController\s+expressionController\s*=\s*new\s+AvatarExpressionController\(\)/u,
  'Unity runtime session should own an expression controller separate from animation playback',
);

assert.match(
  runtimeSessionSource,
  /expressionController\.Bind\(avatarLoader\.CurrentAvatarRoot,\s*currentState\.avatarUrl\)/u,
  'Unity runtime should bind expression handling after loading the avatar',
);

assert.match(
  runtimeSessionSource,
  /ApplyCurrentExpressionState\(\)/u,
  'Unity runtime should apply expression key and viseme state from semantic commands',
);

assert.match(
  runtimeSessionSource,
  /AvatarExpressionDiagnosticReporter\.Send\(bridgeTransport,\s*currentState\.petId,\s*result\)/u,
  'Unity runtime should emit expression application diagnostics after applying state',
);

assert.match(
  runtimeSessionSource,
  /expressionController\.Unbind\(\)/u,
  'Unity runtime should clear native expression state when unloading or disposing avatars',
);

assert.match(
  expressionControllerSource,
  /new\s+AvatarVrmExpressionAdapter\(\)/u,
  'Unity expression controller should try VRM expression APIs first',
);

assert.match(
  expressionControllerSource,
  /new\s+AvatarBlendShapeExpressionAdapter\(\)/u,
  'Unity expression controller should include a BlendShape fallback for non-VRM expression names',
);

assert.match(
  expressionControllerSource,
  /if\s*\(!vrmResult\.applied\)[\s\S]*blendShapeAdapter\.QueueWeights/u,
  'Unity expression controller should only use expression BlendShapes when VRM expression application misses',
);

assert.match(
  expressionControllerSource,
  /ResolveExpressionSource\(\)[\s\S]*return\s+result/u,
  'Unity expression controller should return the applied source for QA evidence',
);

assert.match(
  expressionControllerSource,
  /ResolveVisemeCandidates\(viseme\)[\s\S]*BlendShapeVisemeWeight/u,
  'Unity expression controller should apply visemes through BlendShapes alongside expressions',
);

assert.doesNotMatch(
  expressionControllerSource,
  /AvatarAnimationController|HumanPose|Animator/u,
  'Unity expression controller must not interfere with the HumanPose/animation chain',
);

assert.match(
  expressionCandidatesSource,
  /case\s+"happy":[\s\S]*case\s+"smile":[\s\S]*"joy"[\s\S]*\\u7B11\\u3044[\s\S]*\\u53E3\\u89D2\\u4E0A\\u3052/u,
  'Unity expression candidate mapping should include common happy/smile aliases and local VRM keys',
);

assert.match(
  expressionCandidatesSource,
  /case\s+"aa":[\s\S]*"mouthopen"[\s\S]*"open"[\s\S]*\\u3042/u,
  'Unity viseme candidate mapping should include common mouth-open BlendShape aliases and local VRM vowel keys',
);

assert.match(
  expressionCandidatesSource,
  /case\s+"mouthcornerup":[\s\S]*\\u53E3\\u89D2\\u4E0A\\u3052/u,
  'Unity expression candidate mapping should include an ASCII QA key for local BlendShape fallback evidence',
);

assert.match(
  vrmExpressionAdapterSource,
  /GetProperty\("Expression"\)[\s\S]*GetProperty\("Expressions"\)/u,
  'Unity VRM expression adapter should support common VRM runtime expression property names',
);

assert.match(
  vrmExpressionAdapterSource,
  /AvatarVrmExpressionKeyResolver\.ResolveAvailableKeys/u,
  'Unity VRM expression adapter should enumerate real runtime expression keys',
);

assert.match(
  vrmExpressionKeyResolverSource,
  /ExpressionKeys/u,
  'Unity VRM expression key resolver should read real ExpressionKeys from the runtime',
);

assert.match(
  vrmExpressionAdapterSource,
  /method\.Name\s*!=\s*"SetWeight"\s*&&\s*method\.Name\s*!=\s*"SetValue"/u,
  'Unity VRM expression adapter should support SetWeight and SetValue runtimes',
);

assert.match(
  vrmExpressionAdapterSource,
  /TryFindAvailableKey[\s\S]*TrySetWeight/u,
  'Unity VRM expression adapter should only apply candidates found in available keys',
);

assert.match(
  vrmExpressionAdapterSource,
  /previousExpressionKeys[\s\S]*TrySetWeight\(key,\s*0f\)/u,
  'Unity VRM expression adapter should clear previously applied expression weights',
);

assert.match(
  blendShapeExpressionAdapterSource,
  /GetComponentsInChildren<SkinnedMeshRenderer>\(true\)/u,
  'Unity BlendShape expression adapter should scan all avatar skinned meshes',
);

assert.match(
  blendShapeExpressionAdapterSource,
  /mesh\.GetBlendShapeName\(index\)/u,
  'Unity BlendShape expression adapter should index real model BlendShape names',
);

assert.match(
  blendShapeExpressionAdapterSource,
  /return\s+new\s+AvatarBlendShapeExpressionMatch/u,
  'Unity BlendShape expression adapter should report matched keys for diagnostics',
);

assert.match(
  blendShapeExpressionAdapterSource,
  /SetBlendShapeWeight\(binding\.index,\s*weight\)/u,
  'Unity BlendShape expression adapter should apply weights to matching BlendShapes',
);

assert.match(
  eventSource,
  /expressionSource[\s\S]*availableVrmExpressionKeyCount[\s\S]*availableBlendShapeKeyCount/u,
  'Unity bridge events should include expression diagnostic fields',
);

assert.match(
  runtimeOverridesSource,
  /--desktop-pet-bridge-port[\s\S]*tcpPort/u,
  'Unity runtime QA should support bridge port override without changing production defaults',
);

assert.match(
  blendShapeExpressionAdapterSource,
  /binding\.key\.Contains\(candidate\)\s*\|\|\s*candidate\.Contains\(binding\.key\)/u,
  'Unity BlendShape expression adapter should include fuzzy fallback matching',
);

assert.match(
  blendShapeExpressionAdapterSource,
  /previousKeys\.Where[\s\S]*SetWeight\(key,\s*0f\)/u,
  'Unity BlendShape expression adapter should clear stale BlendShape weights',
);

for (const fileName of [
  'AvatarExpressionController.cs',
  'AvatarExpressionApplicationResult.cs',
  'AvatarExpressionCandidates.cs',
  'AvatarVrmExpressionApplyResult.cs',
  'AvatarVrmExpressionAdapter.cs',
  'AvatarVrmExpressionKeyResolver.cs',
  'AvatarBlendShapeExpressionMatch.cs',
  'AvatarBlendShapeExpressionAdapter.cs',
  'AvatarExpressionDiagnosticReporter.cs',
  'AvatarBridgeEvent.cs',
  'AvatarBridgeRuntimeOverrides.cs',
]) {
  assert.match(
    buildUnityRuntimeSource,
    new RegExp(fileName.replace(/\./gu, '\\.'), 'u'),
    `Unity runtime build should copy ${fileName}`,
  );
}

console.log('unity runtime expression application smoke ok');
