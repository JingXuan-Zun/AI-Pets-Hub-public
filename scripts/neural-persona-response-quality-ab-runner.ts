import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  countNeuralPersonaAbChangedPromptBranches,
  countNeuralPersonaAbErrorBranches,
  rerunNeuralPersonaResponseQualityAbChangedPrompts,
  retryNeuralPersonaResponseQualityAbErrors,
  runNeuralPersonaResponseQualityAb,
  type NeuralPersonaResponseQualityAbReport,
} from '../src/character-graph/neural-persona';
import {
  createNeuralPersonaConfiguredModelAbExecutor,
} from '../src/services/neuralPersonaConfiguredModelAbExecutor';
import { resolveNeuralPersonaConfiguredModelIssue } from '../src/services/neuralPersonaConfiguredModelProvider';
import type { PetConfig } from '../src/types';
import { prepareNeuralPersonaResponseQualityAb } from './fixtures/neural-persona-response-quality-preparation';

const EXPECTED_REQUESTS = 40;

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requestCountApproved(expected: number) {
  return argument('--confirm-requests') === String(expected);
}

function usage() {
  return [
    '真实 Classic/Neural A/B 默认不会执行。',
    `本次固定为 20 场景、${EXPECTED_REQUESTS} 次模型请求。`,
    '执行：npm.cmd run run:neural-persona:response-quality-ab -- --execute --confirm-requests 40 --config <PetConfig.json> --output <report.json>',
    '增量重试：增加 --retry-errors-from <report.json>，确认次数必须等于失败分支数。',
    '请求输入变更重跑：增加 --rerun-changed-prompts-from <report.json>，只请求系统指令或用户问题变化的分支；模型变化时重跑全部分支。',
    '若输出文件已存在，必须额外提供 --overwrite。',
  ].join('\n');
}

function unwrapConfig(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if ('settings' in parsed) return parsed;
  return 'config' in parsed ? (parsed as { config?: unknown }).config : parsed;
}

export function loadNeuralPersonaAbConfig(filePath: string): PetConfig {
  const parsed = unwrapConfig(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  if (!parsed || typeof parsed !== 'object' || !('settings' in parsed)) {
    throw new Error('A/B 配置文件不是完整 PetConfig JSON。');
  }
  return parsed as PetConfig;
}

function loadReport(filePath: string): NeuralPersonaResponseQualityAbReport {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as (
    Partial<NeuralPersonaResponseQualityAbReport>
  );
  if (!Array.isArray(parsed.scenarios) || typeof parsed.runId !== 'string') {
    throw new Error('增量重试输入不是有效的 A/B 报告。');
  }
  return parsed as NeuralPersonaResponseQualityAbReport;
}

function timeoutMs(settings: PetConfig['settings']) {
  const supplied = Number(argument('--timeout-ms'));
  return Number.isFinite(supplied) && supplied >= 1_000 && supplied <= 60_000
    ? Math.floor(supplied)
    : settings.neuralPersonaProviderTimeoutMs || 30_000;
}

function validatePaths(configPath: string, outputPath: string) {
  const resolvedConfig = path.resolve(configPath);
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedConfig === resolvedOutput) throw new Error('输出文件不能覆盖输入配置文件。');
  if (fs.existsSync(resolvedOutput) && !process.argv.includes('--overwrite')) {
    throw new Error('输出报告已存在；如需替换请显式提供 --overwrite。');
  }
  return { resolvedConfig, resolvedOutput };
}

function writeReport(outputPath: string, report: unknown) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (fs.existsSync(outputPath)) {
    fs.copyFileSync(outputPath, `${outputPath}.backup-${Date.now()}`);
    fs.copyFileSync(temporaryPath, outputPath);
    fs.unlinkSync(temporaryPath);
  } else {
    fs.renameSync(temporaryPath, outputPath);
  }
}

async function main() {
  if (!process.argv.includes('--execute')) {
    console.log(usage());
    return;
  }
  const configArgument = argument('--config');
  const outputArgument = argument('--output');
  if (!configArgument || !outputArgument) throw new Error('执行时必须提供 --config 和 --output。');
  const paths = validatePaths(configArgument, outputArgument);
  const config = loadNeuralPersonaAbConfig(paths.resolvedConfig);
  const modelIssue = resolveNeuralPersonaConfiguredModelIssue(config.settings);
  if (modelIssue) throw new Error(`模型配置不可用：${modelIssue}`);
  const preparedScenarios = prepareNeuralPersonaResponseQualityAb(config.settings);
  const executor = createNeuralPersonaConfiguredModelAbExecutor({
    settings: config.settings,
    timeoutMs: timeoutMs(config.settings),
  });
  const retryPath = argument('--retry-errors-from');
  const changedPath = argument('--rerun-changed-prompts-from');
  if (retryPath && changedPath) throw new Error('一次只能选择一种增量重跑模式。');
  const sourcePath = retryPath ?? changedPath;
  const previous = sourcePath ? loadReport(path.resolve(sourcePath)) : null;
  const expectedRequests = retryPath && previous
    ? countNeuralPersonaAbErrorBranches(previous)
    : changedPath && previous
      ? await countNeuralPersonaAbChangedPromptBranches({
        model: executor.identity, preparedScenarios, report: previous,
      })
      : EXPECTED_REQUESTS;
  if (!requestCountApproved(expectedRequests)) {
    throw new Error(`必须使用 --confirm-requests ${expectedRequests} 确认本次请求数。`);
  }
  const runOptions = {
    executor,
    onProgress: (progress) => console.log(
      `[${progress.completedBranches}/${progress.totalBranches}] ${progress.scenarioId} ${progress.mode}`,
    ),
    preparedScenarios,
    runId: `neural-persona-ab:${new Date().toISOString()}`,
  };
  const report = retryPath && previous
    ? await retryNeuralPersonaResponseQualityAbErrors({ ...runOptions, report: previous })
    : changedPath && previous
      ? await rerunNeuralPersonaResponseQualityAbChangedPrompts({
        ...runOptions, report: previous,
      })
      : await runNeuralPersonaResponseQualityAb(runOptions);
  writeReport(paths.resolvedOutput, report);
  console.log(`A/B 报告已写入：${paths.resolvedOutput}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
