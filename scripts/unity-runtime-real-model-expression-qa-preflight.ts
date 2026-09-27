import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_MODEL_ROOT,
  UNITY_EXPRESSION_SOURCE_PATHS,
  type UnityExpressionQaOptions,
} from './unity-runtime-real-model-expression-qa-config';

export async function writeUnityExpressionQaEvidence(
  evidencePath: string,
  evidence: Record<string, unknown>,
) {
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

async function findFirstVrm(rootPath: string): Promise<string | null> {
  if (!existsSync(rootPath)) {
    return null;
  }

  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.vrm')) {
      return entryPath;
    }

    if (entry.isDirectory()) {
      const nested = await findFirstVrm(entryPath);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function resolveUnityRuntimeFreshness(runtimeExe: string) {
  if (!existsSync(runtimeExe)) {
    return {
      fresh: false,
      newestSourceMtimeMs: 0,
      runtimeMtimeMs: 0,
    };
  }

  const newestSourceMtimeMs = Math.max(...UNITY_EXPRESSION_SOURCE_PATHS.map((relativePath) => (
    statSync(path.join(process.cwd(), relativePath)).mtimeMs
  )));
  const runtimeMtimeMs = statSync(runtimeExe).mtimeMs;
  return {
    fresh: runtimeMtimeMs >= newestSourceMtimeMs,
    newestSourceMtimeMs,
    runtimeMtimeMs,
  };
}

export async function resolveUnityExpressionQaModelPath(options: UnityExpressionQaOptions) {
  const modelPath = options.modelPath ?? await findFirstVrm(DEFAULT_MODEL_ROOT);
  assert.ok(modelPath, `No .vrm model found under ${DEFAULT_MODEL_ROOT}`);
  assert.ok(existsSync(modelPath), `Model file does not exist: ${modelPath}`);
  assert.equal(path.extname(modelPath).toLowerCase(), '.vrm', 'Unity runtime QA requires a VRM model');
  return path.resolve(modelPath);
}

export async function runUnityExpressionQaPreflight(
  options: UnityExpressionQaOptions,
  modelPath: string,
) {
  assert.ok(existsSync(options.runtimeExe), `Unity runtime executable does not exist: ${options.runtimeExe}`);
  const freshness = resolveUnityRuntimeFreshness(options.runtimeExe);
  if (options.launchRuntime && !freshness.fresh && !options.allowStaleRuntime) {
    throw new Error('Unity runtime exe is older than expression source files. Rebuild with npm run unity:build-runtime first.');
  }

  const summary = {
    launchRuntime: options.launchRuntime,
    modelPath,
    runtimeExe: options.runtimeExe,
    runtimeFresh: freshness.fresh,
  };
  await writeUnityExpressionQaEvidence(
    options.launchRuntime ? options.preflightEvidencePath : options.evidencePath,
    {
    ...summary,
    freshness,
    mode: options.launchRuntime ? 'real-runtime' : 'preflight',
    },
  );
  console.log(JSON.stringify(summary, null, 2));
}
