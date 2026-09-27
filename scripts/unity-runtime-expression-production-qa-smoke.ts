import assert from 'node:assert/strict';
import {
  createUnitySemanticStateCommand,
  resolveUnityAvatarRuntimeCommandSurface,
} from '../src/pet-runtime/avatar-runtime/unity/unityBridgeCommandSurface';
import { resolveAvatarRuntimeManualExpressionSelection } from '../src/pet-runtime/content/petModelExpressionBindings';
import { type PetModelMotionBinding } from '../src/types';
import { readProjectFile } from './smokeTestHarness.ts';

function assertMatch(source: string, pattern: RegExp, message: string) {
  assert.match(source, pattern, message);
}

function assertNoMatch(source: string, pattern: RegExp, message: string) {
  assert.doesNotMatch(source, pattern, message);
}

function assertLineBudget(source: string, label: string) {
  const lineCount = source.split(/\r?\n/u).length;
  assert.ok(lineCount <= 300, `${label} should stay below the 300-line source target`);
}

function withBrowserWindow<T>(callback: () => T) {
  const previousWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const runtimeGlobal = globalThis as typeof globalThis & { window?: unknown };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerHeight: 1080,
      innerWidth: 1920,
    },
  });

  try {
    return callback();
  } finally {
    if (previousWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', previousWindowDescriptor);
    } else {
      delete runtimeGlobal.window;
    }
  }
}

function assertUnitySemanticCommandKeepsExpressionFields() {
  const expressionBinding: PetModelMotionBinding = {
    clipNames: ['JoyFace', 'Smile_Bright'],
    format: 'exp3',
    id: 'skill-smile-expression',
    kind: 'expression',
    motionKey: 'happy',
    name: 'Bright Smile',
    semanticAliases: ['big grin'],
    semanticTags: ['face'],
    sourceUrl: '/library/expressions/bright-smile.exp3.json?cache=2',
  };
  const manualSelection = resolveAvatarRuntimeManualExpressionSelection(expressionBinding);
  assert.ok(manualSelection, 'expression binding should resolve to a manual expression selection');
  const expressionName = manualSelection.candidateExpressionNames[0] ?? manualSelection.expressionKey;

  const surface = resolveUnityAvatarRuntimeCommandSurface({
    expressionKey: ` ${expressionName} `,
    modelUrl: ' local-model://avatars/performer.vrm ',
    motionKey: 'happy',
    petId: ' skill-pet ',
    viseme: ' aa ',
  });

  assert.deepEqual(
    createUnitySemanticStateCommand(surface),
    {
      dragActive: false,
      dragDeltaX: 0,
      dragDeltaY: 0,
      expressionKey: 'Bright Smile',
      hoverRegion: '',
      lookAtX: 0,
      lookAtY: 4,
      motionKey: 'happy',
      petId: 'skill-pet',
      runtimeKind: 'unity',
      type: 'setSemanticState',
      viseme: 'aa',
    },
    'Unity semantic commands should preserve Skill expression keys and visemes',
  );
}

function assertRendererBridgeContract() {
  const visualRendererSource = readProjectFile('src/components/pet/PetVisualRenderer.tsx');
  const unityRendererSource = readProjectFile('src/components/pet/PetUnity3DRenderer.tsx');
  const bridgeSource = readProjectFile('src/pet-runtime/avatar-runtime/unity/unityAvatarRuntimeBridge.ts');
  const commandSurfaceSource = readProjectFile('src/pet-runtime/avatar-runtime/unity/unityBridgeCommandSurface.ts');

  assertMatch(visualRendererSource, /manualExpressionBinding=\{manualExpressionBinding\}/u, 'visual renderer should forward manual expression bindings');
  assertMatch(unityRendererSource, /manualExpressionBinding\s*\?\?\s*\(manualMotionBinding\s*&&\s*isPetModelExpressionBinding/u, 'Unity renderer should accept expression bindings from either expression or motion slots');
  assertMatch(unityRendererSource, /manualExpressionSelection[\s\S]*useUnityAvatarRuntimeMirror/u, 'Unity renderer should send manual expression selections to the Unity bridge hook');
  assertMatch(unityRendererSource, /manualMotionKey:\s*manualMotionBinding\s*&&\s*!isPetModelExpressionBinding/u, 'Unity renderer should keep body motion separate from expression-only bindings');
  assertMatch(bridgeSource, /candidateExpressionNames\.find[\s\S]*\?\?\s*selection\?\.expressionKey/u, 'Unity bridge should prefer imported expression candidate names before generic keys');
  assertMatch(bridgeSource, /isTyping\s*\?\s*''[\s\S]*resolveUnityManualExpressionKey\(manualExpressionSelection\)/u, 'Unity bridge should clear expressions while typing and otherwise prefer manual Skill expressions');
  assertMatch(commandSurfaceSource, /expressionKey:\s*expressionKey\.trim\(\)/u, 'Unity command surface should trim expression keys without dropping them');
  assertMatch(commandSurfaceSource, /viseme:\s*viseme\.trim\(\)/u, 'Unity command surface should trim visemes without dropping them');
}

function assertRuntimeSessionContract() {
  const commandSource = readProjectFile('scripts/unity-runtime-src/Bridge/AvatarBridgeCommand.cs');
  const eventSource = readProjectFile('scripts/unity-runtime-src/Bridge/AvatarBridgeEvent.cs');
  const runtimeOverridesSource = readProjectFile('scripts/unity-runtime-src/Bridge/AvatarBridgeRuntimeOverrides.cs');
  const stateSource = readProjectFile('scripts/unity-runtime-src/Runtime/AvatarRuntimeState.cs');
  const sessionSource = readProjectFile('scripts/unity-runtime-src/Runtime/AvatarRuntimeSession.cs');
  const diagnosticReporterSource = readProjectFile('scripts/unity-runtime-src/Runtime/AvatarExpressionDiagnosticReporter.cs');

  assertMatch(commandSource, /public\s+string\s+expressionKey\s*=\s*""/u, 'Unity bridge command should expose expressionKey');
  assertMatch(commandSource, /public\s+string\s+viseme\s*=\s*""/u, 'Unity bridge command should expose viseme');
  assertMatch(eventSource, /public\s+string\s+expressionSource\s*=\s*""/u, 'Unity bridge event should expose expressionSource');
  assertMatch(eventSource, /availableVrmExpressionKeyCount/u, 'Unity bridge event should expose available VRM expression key counts');
  assertMatch(eventSource, /availableBlendShapeKeyCount/u, 'Unity bridge event should expose available BlendShape key counts');
  assertMatch(runtimeOverridesSource, /--desktop-pet-bridge-port[\s\S]*tcpPort/u, 'Unity runtime should allow QA to override the bridge port');
  assertMatch(stateSource, /currentExpressionKey\s*=\s*""/u, 'Unity runtime state should persist the current expression key');
  assertMatch(stateSource, /currentViseme\s*=\s*""/u, 'Unity runtime state should persist the current viseme');
  assertMatch(sessionSource, /expressionController\.Bind\(avatarLoader\.CurrentAvatarRoot,\s*currentState\.avatarUrl\)[\s\S]*expressionController\.ApplyState/u, 'Unity should bind and apply expression state after avatar load');
  assertMatch(sessionSource, /currentState\.currentExpressionKey\s*=\s*command\.expressionKey\s*\?\?\s*""/u, 'Unity semantic state should copy expressionKey from bridge commands');
  assertMatch(sessionSource, /currentState\.currentViseme\s*=\s*command\.viseme\s*\?\?\s*""/u, 'Unity semantic state should copy viseme from bridge commands');
  assertMatch(sessionSource, /animationController\?\.PlayMotion\(currentState\.currentMotionKey\)[\s\S]*ApplyCurrentExpressionState\(\)/u, 'Unity should apply expression state alongside motion commands');
  assertMatch(sessionSource, /type\s*=\s*"expression-state-changed"[\s\S]*expressionKey\s*=\s*currentState\.currentExpressionKey/u, 'Unity runtime should report expression changes for QA visibility');
  assertMatch(diagnosticReporterSource, /expression-application-diagnostic/u, 'Unity runtime should report expression application diagnostics for QA visibility');
}

function assertExpressionControllerContract() {
  const controllerSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarExpressionController.cs');
  const resultSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarExpressionApplicationResult.cs');
  const candidatesSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarExpressionCandidates.cs');

  assertLineBudget(controllerSource, 'AvatarExpressionController.cs');
  assertLineBudget(resultSource, 'AvatarExpressionApplicationResult.cs');
  assertLineBudget(candidatesSource, 'AvatarExpressionCandidates.cs');
  assertMatch(controllerSource, /new\s+AvatarVrmExpressionAdapter\(\)/u, 'expression controller should use the VRM expression adapter');
  assertMatch(controllerSource, /new\s+AvatarBlendShapeExpressionAdapter\(\)/u, 'expression controller should keep a BlendShape fallback');
  assertMatch(controllerSource, /vrmAdapter\.Clear\(\)[\s\S]*vrmAdapter\.ApplyCandidates/u, 'expression controller should clear stale VRM weights before applying a new expression');
  assertMatch(controllerSource, /if\s*\(!vrmResult\.applied\)[\s\S]*blendShapeAdapter\.QueueWeights/u, 'expression BlendShapes should only apply when VRM expression lookup misses');
  assertMatch(controllerSource, /ResolveVisemeCandidates\(viseme\)[\s\S]*BlendShapeVisemeWeight/u, 'visemes should be layered through BlendShapes');
  assertMatch(resultSource, /blendshape-fallback/u, 'expression application result should distinguish BlendShape fallback source');
  assertNoMatch(controllerSource, /HumanPose|SetHumanPose|VrmAnimation|PlayMotion/u, 'expression controller should not mutate the animation or HumanPose chain');
  assertMatch(candidatesSource, /case\s+"happy":[\s\S]*case\s+"smile":[\s\S]*"joy"[\s\S]*\\u7B11\\u3044[\s\S]*\\u53E3\\u89D2\\u4E0A\\u3052/u, 'happy Skill expressions should match common VRM or BlendShape smile aliases');
  assertMatch(candidatesSource, /case\s+"mouthcornerup":[\s\S]*\\u53E3\\u89D2\\u4E0A\\u3052/u, 'ASCII QA expression should map to a local BlendShape-only fallback key');
  assertMatch(candidatesSource, /case\s+"aa":[\s\S]*"mouthopen"[\s\S]*"open"[\s\S]*\\u3042/u, 'AA viseme should match common mouth-open BlendShape aliases');
}

function assertVrmAdapterContract() {
  const source = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarVrmExpressionAdapter.cs');
  const resolverSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarVrmExpressionKeyResolver.cs');

  assertLineBudget(source, 'AvatarVrmExpressionAdapter.cs');
  assertLineBudget(resolverSource, 'AvatarVrmExpressionKeyResolver.cs');
  assertMatch(source, /GetProperty\("Expression"\)[\s\S]*GetProperty\("Expressions"\)/u, 'VRM adapter should support common expression runtime property names');
  assertMatch(source, /method\.Name\s*!=\s*"SetWeight"\s*&&\s*method\.Name\s*!=\s*"SetValue"/u, 'VRM adapter should support SetWeight and SetValue runtimes');
  assertMatch(source, /ResolveAvailableKeys\(expressionRuntime\)/u, 'VRM adapter should cache real runtime expression keys');
  assertMatch(resolverSource, /ReadMemberValue\(expressionRuntime,\s*"ExpressionKeys"\)/u, 'VRM key resolver should read runtime ExpressionKeys');
  assertMatch(source, /TryFindAvailableKey[\s\S]*TrySetWeight/u, 'VRM adapter should only set weights for real available expression keys');
  assertMatch(source, /previousExpressionKeys[\s\S]*TrySetWeight\(key,\s*0f\)[\s\S]*previousExpressionKeys\.Clear\(\)/u, 'VRM adapter should clear stale expression weights');
}

function assertBlendShapeAdapterContract() {
  const source = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarBlendShapeExpressionAdapter.cs');

  assertLineBudget(source, 'AvatarBlendShapeExpressionAdapter.cs');
  assertMatch(source, /GetComponentsInChildren<SkinnedMeshRenderer>\(true\)/u, 'BlendShape adapter should scan all skinned meshes, including inactive children');
  assertMatch(source, /NormalizeName\(mesh\.GetBlendShapeName\(index\)\)/u, 'BlendShape adapter should index normalized model BlendShape names');
  assertMatch(source, /Mathf\.Max\(currentWeight,\s*weight\)/u, 'BlendShape adapter should keep the strongest expression or viseme weight per key');
  assertMatch(source, /exact\.Length\s*>\s*0[\s\S]*binding\.key\.Contains\(candidate\)\s*\|\|\s*candidate\.Contains\(binding\.key\)/u, 'BlendShape adapter should prefer exact matches before fuzzy fallback');
  assertMatch(source, /previousKeys\.Where[\s\S]*SetWeight\(key,\s*0f\)/u, 'BlendShape adapter should clear stale weights that are no longer pending');
  assertMatch(source, /renderer\.SetBlendShapeWeight\(binding\.index,\s*weight\)/u, 'BlendShape adapter should apply resolved weights to the renderer');
}

function assertBuildScriptCopiesExpressionSources() {
  const buildScriptSource = readProjectFile('scripts/build-unity-runtime.mjs');

  for (const fileName of [
    'AvatarBridgeEvent.cs',
    'AvatarBridgeRuntimeOverrides.cs',
    'AvatarExpressionDiagnosticReporter.cs',
    'AvatarBlendShapeExpressionMatch.cs',
    'AvatarExpressionController.cs',
    'AvatarExpressionApplicationResult.cs',
    'AvatarExpressionCandidates.cs',
    'AvatarVrmExpressionApplyResult.cs',
    'AvatarVrmExpressionAdapter.cs',
    'AvatarVrmExpressionKeyResolver.cs',
    'AvatarBlendShapeExpressionAdapter.cs',
  ]) {
    assertMatch(buildScriptSource, new RegExp(fileName.replace(/\./gu, '\\.'), 'u'), `Unity build should copy ${fileName}`);
  }
}

withBrowserWindow(assertUnitySemanticCommandKeepsExpressionFields);
assertRendererBridgeContract();
assertRuntimeSessionContract();
assertExpressionControllerContract();
assertVrmAdapterContract();
assertBlendShapeAdapterContract();
assertBuildScriptCopiesExpressionSources();

console.log('unity runtime expression production QA smoke ok');
