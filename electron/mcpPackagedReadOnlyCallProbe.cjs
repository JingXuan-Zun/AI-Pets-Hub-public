const fs = require('fs');
const path = require('path');

const DEFAULT_PACKAGED_READ_ONLY_CALLS = [
  {
    arguments: { path: '.' },
    serverId: 'filesystem',
    toolName: 'list_directory',
  },
  {
    arguments: {},
    serverId: 'memory',
    toolName: 'read_graph',
  },
];

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

function parseJsonObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function normalizeCallSpec(value) {
  const record = parseJsonObject(value, null);
  const serverId = typeof record?.serverId === 'string' ? record.serverId.trim() : '';
  const toolName = typeof record?.toolName === 'string' ? record.toolName.trim() : '';
  if (!serverId || !toolName) {
    return null;
  }

  return {
    arguments: parseJsonObject(record.arguments),
    serverId,
    toolName,
  };
}

function readCallSpecs(env) {
  const rawSpecs = env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALLS_JSON;
  if (!rawSpecs || !rawSpecs.trim()) {
    return DEFAULT_PACKAGED_READ_ONLY_CALLS;
  }

  const parsed = JSON.parse(rawSpecs);
  if (!Array.isArray(parsed)) {
    throw new Error('Packaged read-only MCP call specs must be a JSON array.');
  }

  const specs = parsed.map(normalizeCallSpec).filter(Boolean);
  if (!specs.length) {
    throw new Error('Packaged read-only MCP call specs did not contain any valid calls.');
  }

  return specs;
}

function redactProbeText(value) {
  return String(value ?? '')
    .replace(/([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*=)[^\s,;}]+/giu, '$1[redacted]')
    .slice(0, 800);
}

function listedToolsForServer(result, serverId) {
  return Array.isArray(result?.tools)
    ? result.tools.filter((tool) => tool?.serverId === serverId)
    : [];
}

async function runProbeRound(service, callSpec, round) {
  const startedAt = Date.now();
  try {
    const listed = await service.listTools({ serverId: callSpec.serverId });
    const tools = listedToolsForServer(listed, callSpec.serverId);
    const toolFound = tools.some((tool) => tool?.name === callSpec.toolName);
    if (!toolFound) {
      return createRoundMetric(callSpec, round, startedAt, tools, 'skipped', 'Tool was not listed.');
    }

    const result = await service.callTool({
      arguments: callSpec.arguments,
      name: callSpec.toolName,
      requestId: `packaged-read-only-${callSpec.serverId}-${round}`,
      serverId: callSpec.serverId,
    });
    return createRoundMetric(
      callSpec,
      round,
      startedAt,
      tools,
      result?.isError ? 'error' : 'ok',
      result?.isError ? result?.content?.[0]?.text || 'Tool call returned an error.' : null,
    );
  } catch (error) {
    return createRoundMetric(callSpec, round, startedAt, [], 'error', error?.message || error);
  }
}

function createRoundMetric(callSpec, round, startedAt, tools, callStatus, error) {
  return {
    callStatus,
    durationMs: Date.now() - startedAt,
    error: error ? redactProbeText(error) : null,
    listOk: tools.length > 0,
    round,
    serverId: callSpec.serverId,
    toolCount: tools.length,
    toolName: callSpec.toolName,
  };
}

async function runProbeRounds(service, calls, rounds, intervalMs, sleep) {
  const metrics = [];
  for (let round = 1; round <= rounds; round += 1) {
    for (const callSpec of calls) {
      metrics.push(await runProbeRound(service, callSpec, round));
    }
    if (intervalMs > 0 && round < rounds) {
      await sleep(intervalMs);
    }
  }

  return metrics;
}

function summarizeServer(metrics, serverId) {
  const serverMetrics = metrics.filter((metric) => metric.serverId === serverId);
  const toolCounts = serverMetrics.map((metric) => metric.toolCount);
  return {
    errorSamples: serverMetrics
      .map((metric) => metric.error)
      .filter(Boolean)
      .slice(0, 3),
    id: serverId,
    listFailureCount: serverMetrics.filter((metric) => !metric.listOk).length,
    listSuccessCount: serverMetrics.filter((metric) => metric.listOk).length,
    maxToolCount: Math.max(0, ...serverMetrics.map((metric) => metric.toolCount)),
    minToolCount: Math.min(...toolCounts),
    optionalCallErrorCount: serverMetrics.filter((metric) => metric.callStatus === 'error').length,
    optionalCallSkippedCount: serverMetrics.filter((metric) => metric.callStatus === 'skipped').length,
    optionalCallSuccessCount: serverMetrics.filter((metric) => metric.callStatus === 'ok').length,
    roundCount: serverMetrics.length,
    toolCountChanged: new Set(toolCounts).size > 1,
    toolNames: [...new Set(serverMetrics.map((metric) => metric.toolName))],
  };
}

function countRestartEvents(historyService, serverId, startedAtMs) {
  const entries = historyService?.listHistory?.({ limit: 200, serverId })?.entries || [];
  return entries.filter((entry) => (
    Number(entry?.createdAt) >= startedAtMs
    && ['restart-cooldown', 'restart-blocked', 'restart-recovered'].includes(entry?.status)
  )).length;
}

function summarizeProbeSafety(historyService, calls, rounds, startedAtMs) {
  if (!historyService?.listHistory) {
    return {
      expectedProbeCallCount: calls.length * rounds,
      historyAvailable: false,
      observedProbeCallCount: 0,
      unexpectedToolCallCount: 0,
    };
  }

  const expectedRequestIds = new Set();
  for (let round = 1; round <= rounds; round += 1) {
    for (const callSpec of calls) {
      expectedRequestIds.add(`packaged-read-only-${callSpec.serverId}-${round}`);
    }
  }
  const startedCalls = (historyService.listHistory({ limit: 200 })?.entries || [])
    .filter((entry) => (
      Number(entry?.createdAt) >= startedAtMs
      && entry?.type === 'tool-call'
      && entry?.status === 'started'
    ));
  const observedExpectedIds = new Set(
    startedCalls
      .map((entry) => entry.requestId)
      .filter((requestId) => expectedRequestIds.has(requestId)),
  );
  const unexpectedRequestIds = new Set(
    startedCalls
      .map((entry) => entry.requestId)
      .filter((requestId) => !expectedRequestIds.has(requestId)),
  );
  return {
    expectedProbeCallCount: expectedRequestIds.size,
    historyAvailable: true,
    observedProbeCallCount: observedExpectedIds.size,
    unexpectedToolCallCount: unexpectedRequestIds.size,
  };
}

function createReport(options, calls, metrics, startedAtMs, endedAtMs, intervalMs, rounds) {
  const serverIds = [...new Set(calls.map((callSpec) => callSpec.serverId))];
  const runtimeMode = options.runtimeMode || 'packaged';
  return {
    elapsedMs: endedAtMs - startedAtMs,
    endedAt: new Date(endedAtMs).toISOString(),
    generatedAt: new Date(endedAtMs).toISOString(),
    kind: 'mcp-packaged-read-only-call-report',
    outputPath: options.outputPath,
    probe: { intervalMs, roundsPerServer: rounds },
    productionRunId: String(options.env?.DESKTOP_PET_MCP_PACKAGED_PRODUCTION_RUN_ID || '').trim() || null,
    runtime: {
      kind: options.runtimeKind || runtimeMode,
      mode: runtimeMode,
      platform: process.platform,
      version: options.app?.getVersion?.(),
    },
    safety: summarizeProbeSafety(options.mcpHistoryService, calls, rounds, startedAtMs),
    servers: serverIds.map((serverId) => ({
      ...summarizeServer(metrics, serverId),
      restartEventCount: countRestartEvents(options.mcpHistoryService, serverId, startedAtMs),
    })),
    startedAt: new Date(startedAtMs).toISOString(),
    totals: {
      listFailures: metrics.filter((metric) => !metric.listOk).length,
      listSuccesses: metrics.filter((metric) => metric.listOk).length,
      optionalCallErrors: metrics.filter((metric) => metric.callStatus === 'error').length,
      optionalCallSkipped: metrics.filter((metric) => metric.callStatus === 'skipped').length,
      optionalCallSuccesses: metrics.filter((metric) => metric.callStatus === 'ok').length,
      rounds: metrics.length,
      servers: serverIds.length,
    },
    version: 1,
  };
}

function writeReport(outputPath, report) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function isMcpPackagedReadOnlyCallProbeEnabled(env = process.env) {
  return env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ENABLE === '1';
}

async function runMcpPackagedReadOnlyCallProbe(options) {
  const env = options.env || process.env;
  const outputPath = path.resolve(env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT || '');
  const rounds = parsePositiveInteger(env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ROUNDS, 20);
  const intervalMs = parseNonNegativeInteger(env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_INTERVAL_MS, 0);
  const calls = readCallSpecs(env);
  const startedAtMs = Date.now();
  const sleep = options.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const metrics = await runProbeRounds(options.mcpStdioClientService, calls, rounds, intervalMs, sleep);
  const endedAtMs = Date.now();
  const report = createReport(
    { ...options, env, outputPath },
    calls,
    metrics,
    startedAtMs,
    endedAtMs,
    intervalMs,
    rounds,
  );
  writeReport(outputPath, report);
  return report;
}

function scheduleMcpPackagedReadOnlyCallProbe(options = {}) {
  const env = options.env || process.env;
  const outputPath = (env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT || '').trim();
  if (
    options.isDev
    || options.isLocalTest
    || !isMcpPackagedReadOnlyCallProbeEnabled(env)
    || !outputPath
    || !options.mcpStdioClientService
  ) {
    return { scheduled: false };
  }

  const delayMs = parsePositiveInteger(env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_DELAY_MS, 5000);
  options.log?.('packaged read-only MCP call probe scheduled', { delayMs, outputPath });
  const timer = (options.setTimeoutFn || setTimeout)(() => {
    runMcpPackagedReadOnlyCallProbe(options)
      .then((report) => {
        options.log?.('packaged read-only MCP call probe complete', report.totals);
        if (env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_QUIT_ON_COMPLETE === '1') {
          options.app?.quit?.();
        }
      })
      .catch((error) => options.log?.('packaged read-only MCP call probe failed', error?.stack || error));
  }, delayMs);
  timer?.unref?.();
  return { delayMs, outputPath, scheduled: true };
}

module.exports = {
  DEFAULT_PACKAGED_READ_ONLY_CALLS,
  isMcpPackagedReadOnlyCallProbeEnabled,
  readCallSpecs,
  runMcpPackagedReadOnlyCallProbe,
  scheduleMcpPackagedReadOnlyCallProbe,
};
