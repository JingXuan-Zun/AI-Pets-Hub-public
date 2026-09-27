import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  normalizeMcpRealServerSoakOptions,
  parseMcpRealServerSoakArgs,
  redactMcpSoakText,
  type McpRealServerSoakOptions,
  type NormalizedMcpRealServerSoakOptions,
} from './agent-mcp-real-server-soak-config.ts';
import { summarizeMcpSoakHistory } from './agent-mcp-real-server-soak-history.ts';

type McpTool = { name: string; serverId: string };
type McpServer = { description?: string; id: string; title?: string };
type McpSessionStatus = {
  closed: boolean;
  pendingCount: number;
  restartStatus?: string;
  restartWaitMs?: number;
  serverId: string;
};

type McpService = {
  callTool: (request: Record<string, unknown>) => Promise<{ isError?: boolean }>;
  dispose: (reason?: string) => number;
  getSessionStatus: () => McpSessionStatus[];
  listServers: () => McpServer[];
  listTools: (request?: Record<string, unknown>) => Promise<{
    ok: boolean;
    serverHealth?: Array<{ serverId: string; status: string }>;
    tools: McpTool[];
  }>;
};

type McpHistoryService = {
  listHistory: (request?: { limit?: number; serverId?: string }) => {
    entries: Array<{ serverId?: string; status: string; type: string }>;
  };
};

interface SoakContext {
  history: McpHistoryService;
  options: NormalizedMcpRealServerSoakOptions;
  service: McpService;
}

interface McpRoundMetric {
  callStatus: 'disabled' | 'error' | 'ok' | 'skipped';
  durationMs: number;
  error: string | null;
  healthStatus: string;
  listOk: boolean;
  round: number;
  serverId: string;
  sessionStatus: string;
  toolCount: number;
  toolNames: string[];
}

async function createSoakContext(options: McpRealServerSoakOptions): Promise<SoakContext> {
  const normalizedOptions = normalizeMcpRealServerSoakOptions(options);
  const { createMcpHistoryService } = await import('../electron/mcpHistoryService.cjs') as {
    createMcpHistoryService: (options?: Record<string, unknown>) => McpHistoryService;
  };
  const { createMcpServerHealthService } = await import('../electron/mcpServerHealthService.cjs');
  const { createMcpStdioClientService } = await import('../electron/mcpStdioClientService.cjs') as {
    createMcpStdioClientService: (options: Record<string, unknown>) => McpService;
  };
  const { createMcpStdioSessionPool } = await import('../electron/mcpStdioSessionPool.cjs');
  const history = createMcpHistoryService({ maxEntries: 200 });
  const sessionPool = createMcpStdioSessionPool({ history, idleTimeoutMs: 30_000 });

  return {
    history,
    options: normalizedOptions,
    service: createMcpStdioClientService({
      health: createMcpServerHealthService(),
      history,
      projectRoot: normalizedOptions.projectRoot,
      reuseSessions: true,
      sessionPool,
    }),
  };
}

function selectServers(servers: McpServer[], serverId: string) {
  const selected = serverId ? servers.filter((server) => server.id === serverId) : servers;
  if (serverId && selected.length === 0) {
    throw new Error(`No configured MCP server matched serverId=${serverId}.`);
  }

  return selected;
}

function getSessionState(sessions: McpSessionStatus[], serverId: string) {
  const session = sessions.find((item) => item.serverId === serverId);
  if (!session) {
    return 'none';
  }

  if (session.closed) {
    return `closed:${session.restartStatus || 'unknown'}`;
  }

  return `open:${session.pendingCount}`;
}

async function maybeCallTool(ctx: SoakContext, serverId: string, tools: McpTool[], round: number) {
  if (!ctx.options.callTool) {
    return { error: null, status: 'disabled' as const };
  }

  if (!tools.some((tool) => tool.name === ctx.options.callTool)) {
    return { error: 'Tool was not listed for this server.', status: 'skipped' as const };
  }

  const result = await ctx.service.callTool({
    arguments: ctx.options.callArgs,
    name: ctx.options.callTool,
    requestId: `mcp-soak-${serverId}-${round}`,
    serverId,
  });
  return {
    error: result.isError ? 'Tool call returned an error.' : null,
    status: result.isError ? 'error' as const : 'ok' as const,
  };
}

async function runServerRound(ctx: SoakContext, server: McpServer, round: number): Promise<McpRoundMetric> {
  const startedAt = Date.now();
  try {
    const result = await ctx.service.listTools({ serverId: server.id });
    const tools = result.tools.filter((tool) => tool.serverId === server.id);
    const healthStatus = result.serverHealth?.find((item) => item.serverId === server.id)?.status || 'unknown';
    const call = await maybeCallTool(ctx, server.id, tools, round);
    return {
      callStatus: call.status,
      durationMs: Date.now() - startedAt,
      error: call.error,
      healthStatus,
      listOk: healthStatus !== 'unhealthy',
      round,
      serverId: server.id,
      sessionStatus: getSessionState(ctx.service.getSessionStatus(), server.id),
      toolCount: tools.length,
      toolNames: tools.map((tool) => tool.name).slice(0, 50),
    };
  } catch (error) {
    return {
      callStatus: 'skipped',
      durationMs: Date.now() - startedAt,
      error: redactMcpSoakText(error),
      healthStatus: 'error',
      listOk: false,
      round,
      serverId: server.id,
      sessionStatus: getSessionState(ctx.service.getSessionStatus(), server.id),
      toolCount: 0,
      toolNames: [],
    };
  }
}

async function runRounds(ctx: SoakContext, servers: McpServer[]) {
  const rounds: McpRoundMetric[] = [];
  for (let round = 1; round <= ctx.options.rounds; round += 1) {
    for (const server of servers) {
      rounds.push(await runServerRound(ctx, server, round));
    }
  }

  return rounds;
}

function summarizeHistory(history: McpHistoryService, serverId: string) {
  return summarizeMcpSoakHistory(history, serverId);
}

function summarizeServer(rounds: McpRoundMetric[], server: McpServer, history: McpHistoryService) {
  const serverRounds = rounds.filter((round) => round.serverId === server.id);
  const historySummary = summarizeHistory(history, server.id);
  return {
    description: server.description || '',
    errorCount: serverRounds.filter((round) => round.error).length,
    history: {
      byStatus: historySummary.byStatus,
      totalCount: historySummary.totalCount,
    },
    historyErrorSamples: historySummary.errorSamples,
    id: server.id,
    listFailureCount: serverRounds.filter((round) => !round.listOk).length,
    listSuccessCount: serverRounds.filter((round) => round.listOk).length,
    maxToolCount: Math.max(0, ...serverRounds.map((round) => round.toolCount)),
    optionalCallErrorCount: serverRounds.filter((round) => round.callStatus === 'error').length,
    optionalCallSuccessCount: serverRounds.filter((round) => round.callStatus === 'ok').length,
    rounds: serverRounds,
    title: server.title || server.id,
  };
}

function writeReport(outputPath: string, report: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export async function runMcpRealServerSoak(options: McpRealServerSoakOptions = {}) {
  const startedAtMs = Date.now();
  const ctx = await createSoakContext(options);
  try {
    const servers = selectServers(ctx.service.listServers(), ctx.options.serverId);
    const rounds = await runRounds(ctx, servers);
    const endedAtMs = Date.now();
    const report = {
      elapsedMs: endedAtMs - startedAtMs,
      endedAt: new Date(endedAtMs).toISOString(),
      kind: 'mcp-real-server-soak-report',
      options: {
        callArgsProvided: Object.keys(ctx.options.callArgs).length > 0,
        callTool: ctx.options.callTool || null,
        listOnlyDefault: !ctx.options.callTool,
        outputPath: ctx.options.outputPath,
        projectRoot: ctx.options.projectRoot,
        rounds: ctx.options.rounds,
        serverId: ctx.options.serverId || null,
      },
      outputPath: ctx.options.outputPath,
      servers: servers.map((server) => summarizeServer(rounds, server, ctx.history)),
      sessionStatus: ctx.service.getSessionStatus(),
      startedAt: new Date(startedAtMs).toISOString(),
      totals: {
        listFailures: rounds.filter((round) => !round.listOk).length,
        listSuccesses: rounds.filter((round) => round.listOk).length,
        optionalCallErrors: rounds.filter((round) => round.callStatus === 'error').length,
        optionalCallSuccesses: rounds.filter((round) => round.callStatus === 'ok').length,
        rounds: rounds.length,
        servers: servers.length,
      },
      version: 1,
    };
    writeReport(ctx.options.outputPath, report);
    return report;
  } finally {
    ctx.service.dispose('soak-runner-complete');
  }
}

async function runCli() {
  const report = await runMcpRealServerSoak(parseMcpRealServerSoakArgs(process.argv.slice(2)));
  console.log(`MCP real-server soak report written: ${report.outputPath}`);
  console.log(JSON.stringify(report.totals));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    console.error(redactMcpSoakText(error));
    process.exitCode = 1;
  });
}
