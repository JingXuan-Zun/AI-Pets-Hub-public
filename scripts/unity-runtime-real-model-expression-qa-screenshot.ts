import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type UnityScreenshotBitmapEvidence = {
  bounds?: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  distinctSampleColors?: number;
  error?: string;
  height?: number;
  nonBlackSampleCount?: number;
  ok: boolean;
  path: string;
  sampleCount?: number;
  width?: number;
};

export type UnityScreenshotCropRequest = {
  centerCssX: number;
  centerCssY: number;
  cssScreenHeight: number;
  cssScreenWidth: number;
  extentBottom: number;
  extentLeft: number;
  extentRight: number;
  extentTop: number;
  paddingCss: number;
  path: string;
};

export type UnityScreenshotEvidence = UnityScreenshotBitmapEvidence & {
  crop?: UnityScreenshotBitmapEvidence | null;
};

function parsePowerShellJson(stdout: string, screenshotPath: string) {
  const line = stdout.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean).at(-1);
  assert.ok(line, 'PowerShell screenshot capture did not return JSON output');
  const evidence = JSON.parse(line) as UnityScreenshotEvidence;
  assert.equal(evidence.path, screenshotPath, 'screenshot evidence should point at the requested output path');
  return evidence;
}

export async function captureUnityRuntimeScreenshot(
  pid: number,
  screenshotPath: string,
  timeoutMs: number,
  crop: UnityScreenshotCropRequest | null,
): Promise<UnityScreenshotEvidence> {
  const scriptPath = fileURLToPath(new URL('./unity-runtime-real-model-expression-qa-capture.ps1', import.meta.url));
  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ], {
    env: {
      ...process.env,
      ...resolveCropEnvironment(crop),
      UNITY_QA_SCREENSHOT_PATH: screenshotPath,
      UNITY_QA_TARGET_PID: String(pid),
      UNITY_QA_TIMEOUT_MS: String(timeoutMs),
    },
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const exitCode = await new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
  const evidence = parsePowerShellJson(stdout, screenshotPath);
  assert.equal(exitCode, 0, stderr || evidence.error || 'screenshot capture failed');
  assert.equal(evidence.ok, true, evidence.error ?? 'screenshot capture failed');
  assert.ok(existsSync(screenshotPath), `screenshot was not written: ${screenshotPath}`);
  assert.ok((evidence.width ?? 0) > 16 && (evidence.height ?? 0) > 16, 'screenshot should have visible dimensions');
  assert.ok((evidence.distinctSampleColors ?? 0) > 1, 'screenshot should not be a single flat color');
  assertCropEvidence(evidence.crop ?? null);
  return evidence;
}

function resolveCropEnvironment(crop: UnityScreenshotCropRequest | null) {
  if (!crop) {
    return {};
  }

  return {
    UNITY_QA_CROP_CENTER_X: String(crop.centerCssX),
    UNITY_QA_CROP_CENTER_Y: String(crop.centerCssY),
    UNITY_QA_CROP_CSS_SCREEN_HEIGHT: String(crop.cssScreenHeight),
    UNITY_QA_CROP_CSS_SCREEN_WIDTH: String(crop.cssScreenWidth),
    UNITY_QA_CROP_EXTENT_BOTTOM: String(crop.extentBottom),
    UNITY_QA_CROP_EXTENT_LEFT: String(crop.extentLeft),
    UNITY_QA_CROP_EXTENT_RIGHT: String(crop.extentRight),
    UNITY_QA_CROP_EXTENT_TOP: String(crop.extentTop),
    UNITY_QA_CROP_PADDING: String(crop.paddingCss),
    UNITY_QA_CROP_PATH: crop.path,
  };
}

function assertCropEvidence(crop: UnityScreenshotBitmapEvidence | null) {
  if (!crop) {
    return;
  }

  assert.equal(crop.ok, true, crop.error ?? 'crop screenshot capture failed');
  assert.ok(existsSync(crop.path), `crop screenshot was not written: ${crop.path}`);
  assert.ok((crop.width ?? 0) > 8 && (crop.height ?? 0) > 8, 'crop screenshot should have visible dimensions');
  assert.ok((crop.distinctSampleColors ?? 0) > 1, 'crop screenshot should not be a single flat color');
}
