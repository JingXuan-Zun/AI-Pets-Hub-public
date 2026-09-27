import path from 'node:path';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 19778;
export const DEFAULT_RUNTIME_EXE = path.join(
  process.cwd(),
  'release',
  'unity-runtime',
  'AI Desktop Pet Unity Runtime.exe',
);
export const DEFAULT_MODEL_ROOT = path.join(process.cwd(), 'public', 'models-3d', 'pet-1');
export const DEFAULT_EVIDENCE_PATH = path.join(
  process.cwd(),
  'tmp',
  'unity-runtime-real-model-expression-qa.json',
);
export const DEFAULT_PREFLIGHT_EVIDENCE_PATH = path.join(
  process.cwd(),
  'tmp',
  'unity-runtime-real-model-expression-qa-preflight.json',
);
export const DEFAULT_SCREENSHOT_PATH = path.join(
  process.cwd(),
  'tmp',
  'unity-runtime-real-model-expression-qa.png',
);
export const DEFAULT_SCREENSHOT_CROP_PATH = path.join(
  process.cwd(),
  'tmp',
  'unity-runtime-real-model-expression-qa-crop.png',
);
export const UNITY_RUNTIME_ARGS = [
  '--desktop-pet-window-overlay',
  '-screen-fullscreen',
  '0',
  '-force-glcore',
  '-popupwindow',
];
export const UNITY_EXPRESSION_SOURCE_PATHS = [
  'scripts/unity-runtime-src/Bridge/AvatarBridgeCommand.cs',
  'scripts/unity-runtime-src/Bridge/AvatarBridgeEvent.cs',
  'scripts/unity-runtime-src/Bridge/AvatarBridgeRuntimeOverrides.cs',
  'scripts/unity-runtime-src/Runtime/AvatarRuntimeState.cs',
  'scripts/unity-runtime-src/Runtime/AvatarExpressionDiagnosticReporter.cs',
  'scripts/unity-runtime-src/Runtime/AvatarRuntimeSession.cs',
  'scripts/unity-runtime-src/Avatar/AvatarBlendShapeExpressionMatch.cs',
  'scripts/unity-runtime-src/Avatar/AvatarExpressionController.cs',
  'scripts/unity-runtime-src/Avatar/AvatarExpressionApplicationResult.cs',
  'scripts/unity-runtime-src/Avatar/AvatarExpressionCandidates.cs',
  'scripts/unity-runtime-src/Avatar/AvatarVrmExpressionApplyResult.cs',
  'scripts/unity-runtime-src/Avatar/AvatarVrmExpressionAdapter.cs',
  'scripts/unity-runtime-src/Avatar/AvatarVrmExpressionKeyResolver.cs',
  'scripts/unity-runtime-src/Avatar/AvatarBlendShapeExpressionAdapter.cs',
];

export type UnityExpressionQaOptions = {
  allowStaleRuntime: boolean;
  captureScreenshot: boolean;
  evidencePath: string;
  expressionKey: string;
  fallbackExpressionKey: string;
  launchRuntime: boolean;
  modelPath: string | null;
  port: number;
  preflightEvidencePath: string;
  runtimeArgs: string[];
  runtimeExe: string;
  screenshotCropPath: string;
  screenshotPath: string;
  timeoutMs: number;
};

export type UnityBridgeEvent = {
  errorMessage?: string;
  expressionKey?: string | null;
  motionKey?: string | null;
  petId?: string;
  type?: string;
  [key: string]: unknown;
};

function readOptionValue(argv: string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseUnityExpressionQaOptions(argv: string[]): UnityExpressionQaOptions {
  return {
    allowStaleRuntime: argv.includes('--allow-stale-runtime'),
    captureScreenshot: !argv.includes('--no-screenshot'),
    expressionKey: readOptionValue(argv, '--expression') ?? 'happy',
    fallbackExpressionKey: readOptionValue(argv, '--fallback-expression') ?? 'mouth-corner-up',
    launchRuntime: argv.includes('--launch-runtime'),
    modelPath: readOptionValue(argv, '--model')
      ? path.resolve(readOptionValue(argv, '--model') ?? '')
      : null,
    port: Number.parseInt(readOptionValue(argv, '--port') ?? '', 10) || DEFAULT_PORT,
    preflightEvidencePath: path.resolve(
      readOptionValue(argv, '--preflight-evidence') ?? DEFAULT_PREFLIGHT_EVIDENCE_PATH,
    ),
    runtimeArgs: UNITY_RUNTIME_ARGS,
    runtimeExe: path.resolve(readOptionValue(argv, '--runtime-exe') ?? DEFAULT_RUNTIME_EXE),
    screenshotCropPath: path.resolve(
      readOptionValue(argv, '--screenshot-crop') ?? DEFAULT_SCREENSHOT_CROP_PATH,
    ),
    screenshotPath: path.resolve(readOptionValue(argv, '--screenshot') ?? DEFAULT_SCREENSHOT_PATH),
    timeoutMs: Number.parseInt(readOptionValue(argv, '--timeout-ms') ?? '', 10) || 120000,
    evidencePath: path.resolve(readOptionValue(argv, '--evidence') ?? (
      argv.includes('--launch-runtime') ? DEFAULT_EVIDENCE_PATH : DEFAULT_PREFLIGHT_EVIDENCE_PATH
    )),
  };
}

export function createUnityExpressionQaCommands(
  options: UnityExpressionQaOptions,
  modelPath: string,
) {
  const petId = 'qa-main';
  return [
    {
      modelUrl: modelPath,
      petId,
      runtimeKind: 'unity',
      type: 'loadAvatar',
    },
    {
      petId,
      presentationMode: 'default',
      runtimeKind: 'unity',
      scale: 1,
      screenHeight: 720,
      screenWidth: 420,
      type: 'setLayout',
      viewportHeight: 360,
      viewportWidth: 300,
      viewportX: 60,
      viewportY: 180,
    },
    {
      expressionKey: options.expressionKey,
      motionKey: 'happy',
      petId,
      runtimeKind: 'unity',
      type: 'setSemanticState',
      viseme: 'aa',
    },
    {
      expressionKey: options.fallbackExpressionKey,
      motionKey: 'idle',
      petId,
      runtimeKind: 'unity',
      type: 'setSemanticState',
      viseme: '',
    },
  ];
}
