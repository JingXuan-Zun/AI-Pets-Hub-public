import fs from 'node:fs';
import path from 'node:path';

export interface McpRealServerSoakOptions {
  callArgs?: Record<string, unknown>;
  callTool?: string;
  outputPath?: string;
  projectRoot?: string;
  rounds?: number;
  serverId?: string;
}

export interface NormalizedMcpRealServerSoakOptions {
  callArgs: Record<string, unknown>;
  callTool: string;
  outputPath: string;
  projectRoot: string;
  rounds: number;
  serverId: string;
}

const DEFAULT_OUTPUT_PATH = path.join('tmp', 'mcp-real-server-soak-report.json');
const SENSITIVE_TEXT_PATTERN = /(token|password|secret|apikey|api_key)\s*[=:]\s*[^,\s}]+/giu;

function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.round(parsed)));
}

export function redactMcpSoakText(value: unknown, limit = 240) {
  const text = String(value ?? '')
    .replace(SENSITIVE_TEXT_PATTERN, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

function parseJsonObjectArg(value: string) {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--callArgsJson must be a JSON object.');
  }

  return parsed as Record<string, unknown>;
}

function parseJsonObjectFile(filePath: string) {
  return parseJsonObjectArg(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

export function parseMcpRealServerSoakArgs(args: readonly string[]): McpRealServerSoakOptions {
  const options: McpRealServerSoakOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--serverId' || arg === '--server-id') {
      options.serverId = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--rounds') {
      options.rounds = normalizePositiveInteger(readArgValue(args, index, arg), 3, 200);
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--projectRoot' || arg === '--project-root') {
      options.projectRoot = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--callTool' || arg === '--call-tool') {
      options.callTool = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--callArgsJson' || arg === '--call-args-json') {
      options.callArgs = parseJsonObjectArg(readArgValue(args, index, arg));
      index += 1;
    } else if (arg === '--callArgsFile' || arg === '--call-args-file') {
      options.callArgs = parseJsonObjectFile(readArgValue(args, index, arg));
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return options;
}

export function normalizeMcpRealServerSoakOptions(
  options: McpRealServerSoakOptions,
): NormalizedMcpRealServerSoakOptions {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  return {
    callArgs: options.callArgs || {},
    callTool: String(options.callTool || '').trim(),
    outputPath: path.resolve(projectRoot, options.outputPath || DEFAULT_OUTPUT_PATH),
    projectRoot,
    rounds: normalizePositiveInteger(options.rounds, 3, 200),
    serverId: String(options.serverId || '').trim(),
  };
}
