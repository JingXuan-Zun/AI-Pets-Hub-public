import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { redactMcpSoakText } from './agent-mcp-real-server-soak-config.ts';

interface ToolSchemaOptions {
  outputPath?: string;
  projectRoot?: string;
  serverId: string;
  toolName: string;
}

interface McpToolWithSchema {
  description?: string;
  inputSchema?: Record<string, unknown>;
  name: string;
  serverId: string;
  title?: string;
}

interface McpService {
  dispose: (reason?: string) => number;
  listTools: (request?: Record<string, unknown>) => Promise<{ tools: McpToolWithSchema[] }>;
}

const MUTATING_NAME_PATTERN = /\b(add|create|delete|edit|remove|update|write)\b/i;
const MUTATING_SCHEMA_PATTERN = /\b(add|create|delete|edit|remove|update|write|mutation)\b/i;

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

export function parseMcpRealServerToolSchemaArgs(args: readonly string[]): ToolSchemaOptions {
  const options: Partial<ToolSchemaOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--serverId' || arg === '--server-id') {
      options.serverId = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--toolName' || arg === '--tool-name') {
      options.toolName = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--projectRoot' || arg === '--project-root') {
      options.projectRoot = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.serverId || !options.toolName) {
    throw new Error('Usage: npx tsx scripts/agent-mcp-real-server-tool-schema.ts --serverId server --toolName tool [--output schema.json]');
  }

  return options as ToolSchemaOptions;
}

function normalizeObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasRequiredInputs(schema: Record<string, unknown>) {
  return Array.isArray(schema.required) && schema.required.length > 0;
}

function isReadOnlyCandidate(tool: McpToolWithSchema) {
  const schemaText = JSON.stringify(tool.inputSchema || {});
  return !MUTATING_NAME_PATTERN.test(tool.name)
    && !MUTATING_NAME_PATTERN.test(tool.title || '')
    && !MUTATING_NAME_PATTERN.test(tool.description || '')
    && !MUTATING_SCHEMA_PATTERN.test(schemaText);
}

async function createService(projectRoot: string): Promise<McpService> {
  const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
    createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
  };
  const { createMcpHistoryService } = await import('../electron/mcpHistoryService.cjs');
  const { createMcpServerHealthService } = await import('../electron/mcpServerHealthService.cjs');
  const history = createMcpHistoryService({ maxEntries: 50 });
  return createMcpStdioClientService({
    health: createMcpServerHealthService(),
    history,
    projectRoot,
    reuseSessions: true,
  });
}

export async function runMcpRealServerToolSchema(options: ToolSchemaOptions) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const service = await createService(projectRoot);
  try {
    const result = await service.listTools({ serverId: options.serverId });
    const tool = result.tools.find((candidate) => candidate.name === options.toolName);
    if (!tool) {
      throw new Error(`Tool ${options.toolName} was not listed for server ${options.serverId}.`);
    }

    const report = {
      generatedAt: new Date().toISOString(),
      inputSchema: normalizeObject(tool.inputSchema),
      kind: 'mcp-real-server-tool-schema',
      readOnlyCandidate: isReadOnlyCandidate(tool),
      requiredInputsPresent: hasRequiredInputs(normalizeObject(tool.inputSchema)),
      serverId: tool.serverId,
      toolDescription: tool.description || '',
      toolName: tool.name,
      toolTitle: tool.title || tool.name,
      version: 1,
    };
    if (options.outputPath) {
      const outputPath = path.resolve(options.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    return report;
  } finally {
    service.dispose('tool-schema-complete');
  }
}

async function runCli() {
  const result = await runMcpRealServerToolSchema(parseMcpRealServerToolSchemaArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    readOnlyCandidate: result.readOnlyCandidate,
    requiredInputsPresent: result.requiredInputsPresent,
    serverId: result.serverId,
    toolName: result.toolName,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    console.error(redactMcpSoakText(error));
    process.exitCode = 1;
  });
}
