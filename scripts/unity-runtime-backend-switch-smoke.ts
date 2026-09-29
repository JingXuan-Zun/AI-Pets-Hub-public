import assert from 'node:assert/strict';
import {
  createUnityHideAvatarCommand,
  createUnityLayoutCommand,
  createUnitySemanticStateCommand,
  createUnityVisibilityCommand,
  resolveUnityAvatarRuntimeCommandSurface,
} from '../src/pet-runtime/avatar-runtime/unity/unityBridgeCommandSurface';
import { resolveUnityDragLayoutPreviewCommand } from '../src/components/pet/petUnityDragLayoutPreview';
import { readProjectFile } from './smokeTestHarness.ts';

const runtimeGlobal = globalThis as unknown as { window?: unknown };
const previousWindow = runtimeGlobal.window;

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    innerHeight: 900,
    innerWidth: 1440,
  },
});

const activeSurface = resolveUnityAvatarRuntimeCommandSurface({
  dragState: {
    active: true,
    deltaX: 24,
    deltaY: -12,
  },
  focusTarget: {
    x: 14,
    y: 11,
  },
  hoverState: {
    activeRegion: ' head ',
    focusTarget: null,
    supportedRegions: ['head'],
  },
  modelUrl: ' local-model://models/avatar.vrm ',
  petId: ' main ',
  presentationMode: 'interactive-dialogue',
  scale: 1.35,
  visible: true,
  viewport: {
    height: 300,
    width: 256,
    x: 100,
    y: 200,
  },
  viseme: ' aa ',
});

assert.deepEqual(
  createUnityVisibilityCommand(activeSurface),
  {
    petId: 'main',
    runtimeKind: 'unity',
    type: 'setVisibility',
    visible: true,
  },
  'active Unity renderer should be able to mark the avatar visible',
);

assert.deepEqual(
  createUnityHideAvatarCommand(activeSurface.petId),
  {
    petId: 'main',
    runtimeKind: 'unity',
    type: 'setVisibility',
    visible: false,
  },
  'switching away from Unity should hide the previous Unity avatar',
);

assert.deepEqual(
  createUnityHideAvatarCommand('   '),
  {
    petId: 'main',
    runtimeKind: 'unity',
    type: 'setVisibility',
    visible: false,
  },
  'Unity hide cleanup should use the protocol default pet id when no id is available',
);

assert.deepEqual(
  createUnityLayoutCommand(activeSurface),
  {
    petId: 'main',
    presentationMode: 'interactive-dialogue',
    runtimeKind: 'unity',
    scale: 1.35,
    screenHeight: 900,
    screenWidth: 1440,
    type: 'setLayout',
    viewportHeight: 300,
    viewportWidth: 256,
    viewportX: 100,
    viewportY: 200,
  },
  'Unity layout should include viewport and screen fields for native overlay anchoring',
);

assert.deepEqual(
  resolveUnityDragLayoutPreviewCommand({
    activityCenter: { x: 720, y: 450 },
    petId: 'main',
    position: { x: 40, y: -30 },
    scale: 1,
    screen: { height: 900, width: 1440 },
  }),
  {
    petId: 'main',
    presentationMode: 'default',
    runtimeKind: 'unity',
    scale: 1,
    screenHeight: 900,
    screenWidth: 1440,
    type: 'setLayout',
    viewportHeight: 280,
    viewportWidth: 280,
    viewportX: 620,
    viewportY: 280,
  },
  'Unity drag preview should send pointer-time layout for the target pet position before React commit effects',
);

assert.deepEqual(
  createUnitySemanticStateCommand(activeSurface),
  {
    dragActive: true,
    dragDeltaX: 24,
    dragDeltaY: -12,
    expressionKey: '',
    hoverRegion: 'head',
    lookAtX: 0.4,
    lookAtY: 3.804,
    motionKey: 'idle',
    petId: 'main',
    runtimeKind: 'unity',
    type: 'setSemanticState',
    viseme: 'aa',
  },
  'Unity semantic state should include drag, hover, look-at, and lip-sync fields',
);

if (previousWindow === undefined) {
  delete runtimeGlobal.window;
} else {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: previousWindow,
  });
}

const unityWindowControllerSource = readProjectFile('scripts/unity-runtime-src/Runtime/UnityRuntimeWindowController.cs');
const unityAvatarLoaderSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarLoader.cs');
const unityAvatarPreviewFramingSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarPreviewFraming.cs');
const unityBoundsReporterSource = readProjectFile('scripts/unity-runtime-src/Avatar/AvatarBoundsReporter.cs');
const unityRuntimeSessionSource = readProjectFile('scripts/unity-runtime-src/Runtime/AvatarRuntimeSession.cs');
const unityRuntimeBuildScriptSource = readProjectFile('scripts/build-unity-runtime.mjs');

assert.match(
  unityWindowControllerSource,
  /WsExTransparent/u,
  'Unity native overlay window should define WS_EX_TRANSPARENT for mouse passthrough',
);

assert.match(
  unityWindowControllerSource,
  /WsExLayered\s*\|\s*WsExNoActivate\s*\|\s*WsExToolWindow\s*\|\s*WsExTransparent/u,
  'Unity native overlay window should apply WS_EX_TRANSPARENT with the other overlay styles',
);

assert.match(
  unityWindowControllerSource,
  /WmNcHitTest\s*=\s*0x0084/u,
  'Unity native overlay window should define WM_NCHITTEST for explicit hit-test passthrough',
);

assert.match(
  unityWindowControllerSource,
  /return\s+HtTransparent;/u,
  'Unity native overlay window should return HTTRANSPARENT from the hit-test window procedure',
);

assert.match(
  unityWindowControllerSource,
  /SetWindowLongPtr\(hwnd,\s*GwlWndProc,/u,
  'Unity native overlay window should subclass the window procedure for mouse hit testing',
);

assert.match(
  unityWindowControllerSource,
  /GetWindowLongPtr\(hwnd,\s*GwlWndProc\)\s*==\s*GetTransparentHitTestWindowProcPointer\(\)/u,
  'Unity native overlay window should verify that the transparent hit-test subclass remains installed',
);

assert.match(
  unityWindowControllerSource,
  /IsOverlayAlreadyApplied\(hwnd,\s*overlayBounds\)[\s\S]*IsTransparentHitTestInstalled\(hwnd\)/u,
  'Unity native overlay window should reapply styles when the hit-test subclass is lost',
);

assert.match(
  unityAvatarLoaderSource,
  /screenAnchorDistanceScale/u,
  'Unity avatar loader should scale camera distance from the desktop viewport size',
);

assert.match(
  unityAvatarPreviewFramingSource,
  /previewCamera\.orthographic\s*=\s*true/u,
  'Unity runtime preview framing should use an orthographic camera to avoid edge-of-screen perspective stretching',
);

assert.match(
  unityAvatarLoaderSource,
  /targetCamera\.orthographicSize\s*=\s*Mathf\.Max\(\s*0\.01f,\s*screenAnchorBaseCameraOrthographicSize\s*\*\s*screenAnchorDistanceScale/u,
  'Unity orthographic runtime should fit the avatar to the desktop viewport without perspective camera translation',
);

assert.match(
  unityAvatarLoaderSource,
  /if\s*\(!targetCamera\.orthographic\s*&&\s*screenAnchorDistanceScale\s*>\s*1\.001f\)/u,
  'Unity runtime should only use perspective distance scaling when the camera is not orthographic',
);

assert.match(
  unityAvatarLoaderSource,
  /Vector3\s+anchoredCameraPosition\s*=\s*screenAnchorBaseCameraPosition/u,
  'Unity avatar loader should keep a distance-adjusted camera base before applying anchor offset',
);

assert.match(
  unityAvatarLoaderSource,
  /targetCamera\.transform\.position\s*=\s*anchoredCameraPosition\s*-\s*offset/u,
  'Unity avatar loader should not discard the distance-scaled camera position after anchor offset',
);

assert.match(
  unityRuntimeSessionSource,
  /MaxViewportDistanceScale\s*=\s*4\.5f/u,
  'Unity runtime layout should cap viewport camera distance to avoid drag-time perspective distortion',
);

assert.match(
  unityRuntimeSessionSource,
  /viewportDistanceScale\s*=\s*Mathf\.Clamp\(Mathf\.Min\(widthDistanceScale,\s*heightDistanceScale\),\s*1f,\s*MaxViewportDistanceScale\)/u,
  'Unity runtime layout should derive camera distance scale from viewport-to-screen ratio',
);

assert.match(
  unityRuntimeSessionSource,
  /CreateBoundsData\(bounds,\s*currentState\)/u,
  'Unity runtime should create visual bounds using the current viewport layout state',
);

assert.match(
  unityRuntimeSessionSource,
  /HasMeaningfulChange\(data\)/u,
  'Unity runtime should debounce visual-bounds by screen-space data',
);

assert.match(
  unityBoundsReporterSource,
  /WorldToScreenPoint/u,
  'Unity bounds reporter should project world bounds into screen coordinates',
);

assert.match(
  unityBoundsReporterSource,
  /runtimeState\.viewportX\s*\+\s*runtimeState\.viewportWidth\s*\*\s*0\.5f/u,
  'Unity bounds reporter should resolve extents relative to the avatar shell viewport center',
);

assert.match(
  unityRuntimeBuildScriptSource,
  /AvatarBoundsReporter\.cs/u,
  'Unity runtime build should copy the tracked bounds reporter source',
);

assert.match(
  unityRuntimeBuildScriptSource,
  /AvatarPreviewFraming\.cs/u,
  'Unity runtime build should copy the tracked orthographic preview framing source',
);

assert.match(
  unityWindowControllerSource,
  /IsOverlayAlreadyApplied\(hwnd,\s*overlayBounds\)/u,
  'Unity overlay window should skip repeated native style application when the existing overlay is still valid',
);

assert.match(
  unityWindowControllerSource,
  /TryApplyWindowsOverlayStyles\(false\)/u,
  'Unity overlay window should use non-forced periodic checks to avoid layered-window flicker',
);

assert.match(
  unityWindowControllerSource,
  /HighQualityAntiAliasingSamples\s*=\s*8/u,
  'Unity runtime should prefer 8x MSAA for smoother avatar edges',
);

assert.match(
  unityAvatarLoaderSource,
  /InteractionDragScaleBoost\s*=\s*0f/u,
  'Unity drag interaction should not scale the avatar during desktop dragging',
);

assert.match(
  unityAvatarLoaderSource,
  /DragYawDegreesPerPixel\s*=\s*0f/u,
  'Unity drag interaction should not rotate the avatar during desktop dragging',
);

assert.match(
  unityAvatarLoaderSource,
  /bool\s+scaleChanged\s*=\s*Mathf\.Abs\(currentPresentationScale\s*-\s*nextPresentationScale\)\s*>\s*0\.0001f/u,
  'Unity layout updates should distinguish drag-time viewport changes from real avatar scale changes',
);

assert.match(
  unityAvatarLoaderSource,
  /if\s*\(scaleChanged\)\s*\{\s*RefreshSpringBoneAfterScale\(\);/u,
  'Unity runtime should only rebuild spring bones when the avatar scale actually changes',
);

assert.match(
  unityWindowControllerSource,
  /TargetFrameRate\s*=\s*165/u,
  'Unity runtime should target high-refresh desktop displays',
);

assert.match(
  unityWindowControllerSource,
  /Application\.targetFrameRate\s*=\s*TargetFrameRate/u,
  'Unity runtime should apply the configured target frame rate',
);

assert.match(
  unityWindowControllerSource,
  /QualitySettings\.antiAliasing\s*=\s*Mathf\.Max\(QualitySettings\.antiAliasing,\s*HighQualityAntiAliasingSamples\)/u,
  'Unity runtime should force the configured high-quality MSAA sample count',
);

assert.match(
  unityWindowControllerSource,
  /QualitySettings\.masterTextureLimit\s*=\s*0/u,
  'Unity runtime should keep full-resolution textures for avatar rendering',
);

assert.match(
  unityWindowControllerSource,
  /QualitySettings\.lodBias\s*=\s*Mathf\.Max\(QualitySettings\.lodBias,\s*HighQualityLodBias\)/u,
  'Unity runtime should bias toward higher-detail avatar LODs',
);

console.log('unity runtime backend switch smoke ok');
