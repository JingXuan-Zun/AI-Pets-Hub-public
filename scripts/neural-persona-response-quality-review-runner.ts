import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  applyNeuralPersonaAbHumanReviews,
  type NeuralPersonaAbHumanReviewDecision,
  type NeuralPersonaResponseQualityAbReport,
} from '../src/character-graph/neural-persona';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown) {
  const resolved = path.resolve(filePath);
  if (fs.existsSync(resolved) && !process.argv.includes('--overwrite')) {
    throw new Error('审核输出已存在；如需替换请显式提供 --overwrite。');
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, resolved);
  return resolved;
}

interface ReviewDecisionFile {
  decisions: NeuralPersonaAbHumanReviewDecision[];
  reviewedAt: string;
  reviewerId: string;
  schemaVersion: string;
}

function main() {
  const reportPath = argument('--report');
  const decisionsPath = argument('--decisions');
  const outputPath = argument('--output');
  if (!reportPath || !decisionsPath || !outputPath) {
    throw new Error('必须提供 --report、--decisions 和 --output。');
  }
  const report = readJson<NeuralPersonaResponseQualityAbReport>(reportPath);
  const review = readJson<ReviewDecisionFile>(decisionsPath);
  if (review.schemaVersion !== 'neural-persona-response-quality-review.v1') {
    throw new Error('不支持的审核决定文件版本。');
  }
  const reviewedAt = Date.parse(review.reviewedAt);
  if (!Number.isFinite(reviewedAt) || !review.reviewerId.trim()) {
    throw new Error('审核时间或审核者无效。');
  }
  const reviewed = applyNeuralPersonaAbHumanReviews({
    decisions: review.decisions, report, reviewedAt, reviewerId: review.reviewerId,
  });
  console.log(`审核报告已写入：${writeJson(outputPath, reviewed)}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
