import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const projectRoot = process.cwd();
const unityProjectRoot = process.env.DESKTOP_PET_UNITY_PROJECT_ROOT
  || 'D:\\projects\\zc\\ai-zc-2\\My project';
const unityExecutable = process.env.DESKTOP_PET_UNITY_EXE
  || 'D:\\projects\\6000.4.6f1\\Editor\\Unity.exe';
const unityEditorScriptSource = path.join(projectRoot, 'scripts', 'unity-runtime-builder', 'UnityRuntimeBuilder.cs');
const unityEditorScriptTarget = path.join(unityProjectRoot, 'Assets', 'Scripts', 'Bridge', 'Editor', 'UnityRuntimeBuilder.cs');
const unityRuntimeScriptCopies = [
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Bridge', 'AvatarBridgeCommand.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Bridge', 'AvatarBridgeCommand.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Bridge', 'AvatarBridgeEvent.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Bridge', 'AvatarBridgeEvent.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Bridge', 'AvatarBridgeRuntimeOverrides.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Bridge', 'AvatarBridgeRuntimeOverrides.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarLoader.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarLoader.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarPreviewFraming.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarPreviewFraming.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarAnimationController.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarAnimationController.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarExpressionController.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarExpressionController.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarExpressionApplicationResult.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarExpressionApplicationResult.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarExpressionCandidates.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarExpressionCandidates.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarVrmExpressionAdapter.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarVrmExpressionAdapter.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarVrmExpressionApplyResult.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarVrmExpressionApplyResult.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarVrmExpressionKeyResolver.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarVrmExpressionKeyResolver.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarBlendShapeExpressionAdapter.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarBlendShapeExpressionAdapter.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarBlendShapeExpressionMatch.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarBlendShapeExpressionMatch.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Avatar', 'AvatarBoundsReporter.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Avatar', 'AvatarBoundsReporter.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Runtime', 'AvatarRuntimeState.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Runtime', 'AvatarRuntimeState.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Runtime', 'AvatarExpressionDiagnosticReporter.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Runtime', 'AvatarExpressionDiagnosticReporter.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Runtime', 'AvatarRuntimeSession.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Runtime', 'AvatarRuntimeSession.cs'),
  },
  {
    source: path.join(projectRoot, 'scripts', 'unity-runtime-src', 'Runtime', 'UnityRuntimeWindowController.cs'),
    target: path.join(unityProjectRoot, 'Assets', 'Scripts', 'Runtime', 'UnityRuntimeWindowController.cs'),
  },
];
const outputPath = path.join(projectRoot, 'release', 'unity-runtime', 'AI Desktop Pet Unity Runtime.exe');
const logPath = path.join(projectRoot, 'release', 'unity-runtime-build.log');

async function main() {
  await mkdir(path.dirname(unityEditorScriptTarget), { recursive: true });
  await copyFile(unityEditorScriptSource, unityEditorScriptTarget);
  for (const copy of unityRuntimeScriptCopies) {
    await mkdir(path.dirname(copy.target), { recursive: true });
    await copyFile(copy.source, copy.target);
  }

  await rm(path.join(projectRoot, 'release', 'unity-runtime'), { recursive: true, force: true });
  await mkdir(path.dirname(outputPath), { recursive: true });

  const args = [
    '-batchmode',
    '-quit',
    '-projectPath',
    unityProjectRoot,
    '-executeMethod',
    'AiZc2.Editor.UnityRuntimeBuilder.BuildWindowsRuntime',
    '-logFile',
    logPath,
  ];

  const child = spawn(unityExecutable, args, {
    env: {
      ...process.env,
      DESKTOP_PET_PROJECT_ROOT: projectRoot,
      DESKTOP_PET_UNITY_RUNTIME_OUTPUT: outputPath,
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  const exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', (error) => {
      console.error(error);
      resolve(1);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`Unity runtime build failed with exit code ${exitCode}. Log: ${logPath}`);
  }

  console.log('');
  console.log(`Unity runtime built: ${outputPath}`);
  console.log(`Unity build log: ${logPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
