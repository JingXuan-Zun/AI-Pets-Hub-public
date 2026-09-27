import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_EVIDENCE_PATH,
  DEFAULT_MODEL_ROOT,
  DEFAULT_PORT,
  parseUnityExpressionQaOptions,
  type UnityBridgeEvent,
  type UnityExpressionQaOptions,
} from './unity-runtime-real-model-expression-qa-config';
import {
  resolveUnityExpressionQaModelPath,
  runUnityExpressionQaPreflight,
  writeUnityExpressionQaEvidence,
} from './unity-runtime-real-model-expression-qa-preflight';
import { runUnityExpressionRealRuntimeQa } from './unity-runtime-real-model-expression-qa-runtime';

type MatrixOptions = UnityExpressionQaOptions & {
  evidenceDir: string;
  limit: number;
  modelPaths: string[];
  modelRoot: string;
};

type MatrixEntry = {
  diagnosticSummary: ReturnType<typeof summarizeDiagnosticEvidence> | null;
  evidencePath: string;
  error: string | null;
  modelPath: string;
  ok: boolean;
  phase: 'preflight' | 'runtime';
};

function readOptionValues(argv: string[], name: string) {
  return argv
    .map((value, index) => (value === name ? argv[index + 1] : ''))
    .filter(Boolean);
}

function readOptionValue(argv: string[], name: string) {
  return readOptionValues(argv, name)[0];
}

function parseMatrixOptions(argv: string[]): MatrixOptions {
  const baseOptions = parseUnityExpressionQaOptions(argv);
  const evidencePath = path.resolve(readOptionValue(argv, '--matrix-evidence') ?? (
    DEFAULT_EVIDENCE_PATH.replace(/\.json$/u, '-matrix.json')
  ));
  return {
    ...baseOptions,
    evidencePath,
    evidenceDir: path.resolve(readOptionValue(argv, '--evidence-dir') ?? path.join(process.cwd(), 'tmp', 'unity-expression-model-matrix')),
    limit: Number.parseInt(readOptionValue(argv, '--limit') ?? '', 10) || 4,
    modelPaths: readOptionValues(argv, '--model').map((modelPath) => path.resolve(modelPath)),
    modelRoot: path.resolve(readOptionValue(argv, '--model-root') ?? DEFAULT_MODEL_ROOT),
  };
}

async function discoverVrmModels(rootPath: string): Promise<string[]> {
  if (!existsSync(rootPath)) {
    return [];
  }

  const entries = await readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      return discoverVrmModels(entryPath);
    }

    return entry.isFile() && entry.name.toLowerCase().endsWith('.vrm') ? [entryPath] : [];
  }));
  return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function resolveMatrixModels(options: MatrixOptions) {
  const modelPaths = options.modelPaths.length > 0
    ? options.modelPaths
    : await discoverVrmModels(options.modelRoot);
  const limitedPaths = modelPaths.slice(0, Math.max(1, options.limit));
  assert.ok(limitedPaths.length > 0, `No .vrm model found under ${options.modelRoot}`);
  return limitedPaths;
}

function sanitizeEvidenceName(modelPath: string, index: number) {
  const baseName = path.basename(modelPath, path.extname(modelPath));
  const safeName = baseName.replace(/[^a-z0-9._-]+/giu, '_').replace(/^_+|_+$/gu, '') || 'model';
  return `${String(index + 1).padStart(2, '0')}-${safeName}`;
}

function createModelQaOptions(options: MatrixOptions, modelPath: string, index: number) {
  const evidenceName = sanitizeEvidenceName(modelPath, index);
  const runtimeEvidencePath = path.join(options.evidenceDir, `${evidenceName}.json`);
  const preflightEvidencePath = path.join(options.evidenceDir, `${evidenceName}-preflight.json`);
  return {
    ...options,
    evidencePath: options.launchRuntime ? runtimeEvidencePath : preflightEvidencePath,
    launchRuntime: options.launchRuntime,
    modelPath,
    port: options.port === DEFAULT_PORT ? DEFAULT_PORT + index : options.port + index,
    preflightEvidencePath,
    screenshotCropPath: path.join(options.evidenceDir, `${evidenceName}-crop.png`),
    screenshotPath: path.join(options.evidenceDir, `${evidenceName}.png`),
  };
}

function serializeMatrixError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function summarizeDiagnosticEvents(events: UnityBridgeEvent[]) {
  const diagnostics = events.filter((event) => event.type === 'expression-application-diagnostic');
  return {
    diagnostics: diagnostics.map((event) => ({
      availableBlendShapeCount: event.availableBlendShapeCount,
      availableVrmExpressionCount: event.availableVrmExpressionCount,
      expressionKey: event.expressionKey,
      expressionSource: event.expressionSource,
      matchedBlendShapeSample: event.matchedBlendShapeSample,
    })),
    errorCount: events.filter((event) => event.type === 'error').length,
    visualBoundsCount: events.filter((event) => event.type === 'visual-bounds').length,
  };
}

async function summarizeDiagnosticEvidence(evidencePath: string) {
  if (!existsSync(evidencePath)) {
    return null;
  }

  const evidence = JSON.parse(await readFile(evidencePath, 'utf8')) as { events?: UnityBridgeEvent[] };
  return summarizeDiagnosticEvents(evidence.events ?? []);
}

async function runMatrixEntry(
  options: MatrixOptions,
  modelPath: string,
  index: number,
): Promise<MatrixEntry> {
  const modelOptions = createModelQaOptions(options, modelPath, index);
  try {
    const resolvedModelPath = await resolveUnityExpressionQaModelPath(modelOptions);
    await runUnityExpressionQaPreflight(modelOptions, resolvedModelPath);
    if (options.launchRuntime) {
      await runUnityExpressionRealRuntimeQa(modelOptions, resolvedModelPath);
    }

    return {
      diagnosticSummary: await summarizeDiagnosticEvidence(modelOptions.evidencePath),
      evidencePath: modelOptions.evidencePath,
      error: null,
      modelPath: resolvedModelPath,
      ok: true,
      phase: options.launchRuntime ? 'runtime' : 'preflight',
    };
  } catch (error) {
    return {
      diagnosticSummary: await summarizeDiagnosticEvidence(modelOptions.evidencePath),
      evidencePath: modelOptions.evidencePath,
      error: serializeMatrixError(error),
      modelPath,
      ok: false,
      phase: options.launchRuntime ? 'runtime' : 'preflight',
    };
  }
}

async function runUnityExpressionModelMatrix(options: MatrixOptions) {
  await mkdir(options.evidenceDir, { recursive: true });
  const modelPaths = await resolveMatrixModels(options);
  const entries: MatrixEntry[] = [];
  for (const [index, modelPath] of modelPaths.entries()) {
    entries.push(await runMatrixEntry(options, modelPath, index));
  }

  const evidence = {
    entries,
    launchRuntime: options.launchRuntime,
    modelCount: entries.length,
    okCount: entries.filter((entry) => entry.ok).length,
    runtimeExe: options.runtimeExe,
  };
  await writeUnityExpressionQaEvidence(options.evidencePath, evidence);
  return evidence;
}

async function main() {
  const options = parseMatrixOptions(process.argv.slice(2));
  const evidence = await runUnityExpressionModelMatrix(options);
  console.log(JSON.stringify({
    evidencePath: options.evidencePath,
    modelCount: evidence.modelCount,
    okCount: evidence.okCount,
  }, null, 2));
  assert.equal(evidence.okCount, evidence.modelCount, 'Unity expression model matrix should pass every selected model');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
