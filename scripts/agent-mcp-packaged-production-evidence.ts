import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpPackagedProductionReview,
  parseSettingsMcpPackagedProductionEvidenceText,
} from '../src/components/settings/settingsMcpPackagedProductionEvidence.ts';

export interface McpPackagedProductionEvidenceCliOptions {
  inputPath: string;
  outputPath?: string;
  prettyJson?: boolean;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

export function parseMcpPackagedProductionEvidenceArgs(
  args: readonly string[],
): McpPackagedProductionEvidenceCliOptions {
  const options: Partial<McpPackagedProductionEvidenceCliOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input') {
      options.inputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--pretty') {
      options.prettyJson = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.inputPath) {
    throw new Error('Usage: npx tsx scripts/agent-mcp-packaged-production-evidence.ts --input report.json [--output review.json] [--pretty]');
  }

  return options as McpPackagedProductionEvidenceCliOptions;
}

export function runMcpPackagedProductionEvidenceReview(
  options: McpPackagedProductionEvidenceCliOptions,
) {
  const inputPath = path.resolve(options.inputPath);
  const imported = parseSettingsMcpPackagedProductionEvidenceText(
    fs.readFileSync(inputPath, 'utf8'),
    inputPath,
  );
  const review = createSettingsMcpPackagedProductionReview(imported.report);
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(review, null, options.prettyJson ? 2 : 0)}\n`, 'utf8');
  }

  return review;
}

function runCli() {
  const review = runMcpPackagedProductionEvidenceReview(
    parseMcpPackagedProductionEvidenceArgs(process.argv.slice(2)),
  );
  console.log(review.summaryText);
  for (const blocker of review.blockers) {
    console.log(`blocker: ${blocker}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
