import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runMcpRealSchemaCompatibilityAudit } from './agent-mcp-real-schema-compatibility-audit.ts';
import { redactMcpSoakText } from './agent-mcp-real-server-soak-config.ts';

const REFERENCE_SERVER_ID = 'reference-everything';
const REFERENCE_SERVER_PACKAGE = '@modelcontextprotocol/server-everything@2026.7.4';

interface ReferenceAuditOptions {
  outputPath?: string;
  projectRoot?: string;
}

interface AuditRunnerOptions extends ReferenceAuditOptions {
  serverIds: string[];
}

type AuditRunner = (options: AuditRunnerOptions) => Promise<unknown>;

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value after ${name}.`);
  return value;
}

export function parseMcpReferenceEverythingSchemaAuditArgs(args: readonly string[]) {
  const options: ReferenceAuditOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--projectRoot' || arg === '--project-root') {
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

export function createReferenceEverythingServerConfig() {
  return {
    args: ['-y', REFERENCE_SERVER_PACKAGE],
    command: 'npx.cmd',
    id: REFERENCE_SERVER_ID,
    timeoutMs: 120_000,
    title: 'MCP reference everything schema audit',
  };
}

export async function runMcpReferenceEverythingSchemaAudit(
  options: ReferenceAuditOptions,
  auditRunner: AuditRunner = runMcpRealSchemaCompatibilityAudit,
) {
  const previousConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
    servers: [createReferenceEverythingServerConfig()],
  });
  try {
    return await auditRunner({
      outputPath: options.outputPath,
      projectRoot: options.projectRoot,
      serverIds: ['filesystem', 'memory', REFERENCE_SERVER_ID],
    });
  } finally {
    if (previousConfig === undefined) delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
    else process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousConfig;
  }
}

async function runCli() {
  const report = await runMcpReferenceEverythingSchemaAudit(
    parseMcpReferenceEverythingSchemaAuditArgs(process.argv.slice(2)),
  ) as {
    ok?: boolean;
    schemaBlockedCount?: number;
    schemaSupportedCount?: number;
    serverCount?: number;
    toolCount?: number;
  };
  console.log(JSON.stringify({
    ok: report.ok,
    schemaBlockedCount: report.schemaBlockedCount,
    schemaSupportedCount: report.schemaSupportedCount,
    serverCount: report.serverCount,
    toolCount: report.toolCount,
  }));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli().catch((error: unknown) => {
    console.error(redactMcpSoakText(error));
    process.exitCode = 1;
  });
}
