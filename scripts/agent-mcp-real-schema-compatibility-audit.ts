import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectSettingsMcpSchemaFields } from '../src/components/settings/settingsMcpFieldPolicyUtils.ts';
import { redactMcpSoakText } from './agent-mcp-real-server-soak-config.ts';

interface AuditOptions {
  outputPath?: string;
  projectRoot?: string;
  serverIds: string[];
}

interface McpToolWithSchema {
  inputSchema?: Record<string, unknown>;
  name: string;
  serverId: string;
}

interface McpService {
  dispose: (reason?: string) => number;
  listServers: () => Array<{ id: string }>;
  listTools: (request?: Record<string, unknown>) => Promise<{ tools: McpToolWithSchema[] }>;
}

interface SchemaSignals {
  compositionCount: number;
  fixedTupleCount: number;
  homogeneousArrayCount: number;
  localRefCount: number;
  nodeCount: number;
  remoteRefCount: number;
  truncated: boolean;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value after ${name}.`);
  return value;
}

export function parseMcpRealSchemaCompatibilityAuditArgs(args: readonly string[]): AuditOptions {
  const options: AuditOptions = { serverIds: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--serverId' || arg === '--server-id') {
      options.serverIds.push(readArgValue(args, index, arg));
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
  return options;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function classifySchemaDraft(schema: Record<string, unknown>) {
  const draft = typeof schema.$schema === 'string' ? schema.$schema : '';
  if (/2020-12/iu.test(draft)) return '2020-12';
  if (/2019-09/iu.test(draft)) return '2019-09';
  if (/draft-0?7/iu.test(draft)) return 'draft-07';
  return 'unspecified';
}

function collectSchemaSignals(schema: Record<string, unknown>): SchemaSignals {
  const signals: SchemaSignals = {
    compositionCount: 0,
    fixedTupleCount: 0,
    homogeneousArrayCount: 0,
    localRefCount: 0,
    nodeCount: 0,
    remoteRefCount: 0,
    truncated: false,
  };
  function visit(value: unknown, depth: number) {
    if (signals.truncated) return;
    signals.nodeCount += 1;
    if (signals.nodeCount > 1024 || depth > 16) {
      signals.truncated = true;
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
      if (Array.isArray(record[keyword])) signals.compositionCount += 1;
    }
    for (const keyword of ['$ref', '$dynamicRef', '$recursiveRef']) {
      const ref = record[keyword];
      if (typeof ref !== 'string') continue;
      if (ref.startsWith('#')) signals.localRefCount += 1;
      else signals.remoteRefCount += 1;
    }
    if (Array.isArray(record.prefixItems) || Array.isArray(record.items)) {
      signals.fixedTupleCount += 1;
    } else if (record.items && typeof record.items === 'object') {
      signals.homogeneousArrayCount += 1;
    }
    Object.values(record).forEach((child) => visit(child, depth + 1));
  }
  visit(schema, 0);
  signals.nodeCount = Math.min(signals.nodeCount, 1025);
  return signals;
}

async function createService(projectRoot: string): Promise<McpService> {
  const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
    createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
  };
  const { createMcpHistoryService } = await import('../electron/mcpHistoryService.cjs');
  const { createMcpServerHealthService } = await import('../electron/mcpServerHealthService.cjs');
  return createMcpStdioClientService({
    health: createMcpServerHealthService(),
    history: createMcpHistoryService({ maxEntries: 50 }),
    projectRoot,
    reuseSessions: true,
  });
}

export async function runMcpRealSchemaCompatibilityAudit(options: AuditOptions) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const service = await createService(projectRoot);
  try {
    const availableServerIds = service.listServers().map((server) => server.id);
    const serverIds = options.serverIds.length ? [...new Set(options.serverIds)] : availableServerIds;
    const unknownServerIds = serverIds.filter((serverId) => !availableServerIds.includes(serverId));
    if (unknownServerIds.length) throw new Error(`Unknown MCP server IDs: ${unknownServerIds.join(', ')}`);

    const { validateMcpToolArguments } = await import('../electron/mcpArgumentSchemaValidation.cjs') as {
      validateMcpToolArguments: (
        schema: Record<string, unknown>,
        input: Record<string, unknown>,
      ) => { error: string | null; errors: unknown[]; ok: boolean };
    };
    const serverResults = await Promise.all(serverIds.map(async (serverId) => {
      const listed = await service.listTools({ serverId });
      const tools = listed.tools.filter((tool) => tool.serverId === serverId);
      return { serverId, tools };
    }));
    const rows = serverResults.flatMap(({ serverId, tools }) => tools.map((tool) => {
      const schema = asRecord(tool.inputSchema);
      const validation = validateMcpToolArguments(schema, {});
      const schemaError = validation.error?.startsWith('mcp_tool_schema_') ? validation.error : null;
      const fields = collectSettingsMcpSchemaFields(schema);
      const signals = collectSchemaSignals(schema);
      return {
        compositionCount: signals.compositionCount,
        draft: classifySchemaDraft(schema),
        emptyArgumentsAccepted: validation.ok,
        fieldCount: fields.length,
        fixedTupleCount: signals.fixedTupleCount,
        homogeneousArrayCount: signals.homogeneousArrayCount,
        localRefCount: signals.localRefCount,
        remoteRefCount: signals.remoteRefCount,
        scalarArrayItemFieldCount: fields.filter((field) => field.arrayItemValuePolicySupported).length,
        scalarValueFieldCount: fields.filter((field) => field.valuePolicySupported).length,
        schemaError,
        schemaSupported: !schemaError,
        serverId,
        toolName: tool.name,
        traversalTruncated: signals.truncated,
      };
    }));
    const unavailableServerIds = serverResults.filter((result) => !result.tools.length).map((result) => result.serverId);
    const report = {
      draftCounts: Object.fromEntries([...new Set(rows.map((row) => row.draft))]
        .sort()
        .map((draft) => [draft, rows.filter((row) => row.draft === draft).length])),
      generatedAt: new Date().toISOString(),
      kind: 'mcp-real-schema-compatibility-audit',
      ok: !unavailableServerIds.length && rows.every((row) => row.schemaSupported),
      rows,
      schemaBlockedCount: rows.filter((row) => !row.schemaSupported).length,
      schemaSupportedCount: rows.filter((row) => row.schemaSupported).length,
      serverCount: serverIds.length,
      toolCount: rows.length,
      unavailableServerIds,
      version: 1,
    };
    if (options.outputPath) {
      const outputPath = path.resolve(options.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
    return report;
  } finally {
    service.dispose('real-schema-compatibility-audit-complete');
  }
}

async function runCli() {
  const report = await runMcpRealSchemaCompatibilityAudit(
    parseMcpRealSchemaCompatibilityAuditArgs(process.argv.slice(2)),
  );
  console.log(JSON.stringify({
    ok: report.ok,
    schemaBlockedCount: report.schemaBlockedCount,
    schemaSupportedCount: report.schemaSupportedCount,
    serverCount: report.serverCount,
    toolCount: report.toolCount,
  }));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    console.error(redactMcpSoakText(error));
    process.exitCode = 1;
  });
}
