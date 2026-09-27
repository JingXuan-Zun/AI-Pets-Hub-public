const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isMcpPackagedReadOnlyCallProbeEnabled,
  readCallSpecs,
  runMcpPackagedReadOnlyCallProbe,
  scheduleMcpPackagedReadOnlyCallProbe,
} = require('../electron/mcpPackagedReadOnlyCallProbe.cjs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-packaged-probe-'));
const outputPath = path.join(tempDir, 'packaged-read-only-call-report.json');
const env = {
  DESKTOP_PET_MCP_PACKAGED_PRODUCTION_RUN_ID: 'probe-smoke',
  DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ENABLE: '1',
  DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_INTERVAL_MS: '5',
  DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT: outputPath,
  DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ROUNDS: '2',
};
const sleepCalls = [];
const historyEntries = [];
const historyService = {
  listHistory() {
    return { entries: historyEntries };
  },
};

const service = {
  async callTool(request) {
    historyEntries.unshift({
      createdAt: Date.now(),
      requestId: request.requestId,
      status: 'started',
      type: 'tool-call',
    });
    return { isError: request.name === 'bad_tool' };
  },
  async listTools(request) {
    return {
      tools: [
        { name: 'list_directory', serverId: request.serverId },
        { name: 'read_graph', serverId: request.serverId },
      ],
    };
  },
};

assert.equal(readCallSpecs({})[0].serverId, 'filesystem');
assert.equal(isMcpPackagedReadOnlyCallProbeEnabled({}), false);
assert.equal(isMcpPackagedReadOnlyCallProbeEnabled(env), true);
assert.throws(
  () => readCallSpecs({ DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALLS_JSON: '{}' }),
  /JSON array/u,
);

runMcpPackagedReadOnlyCallProbe({
  app: { getVersion: () => '0.0.1' },
  env,
  mcpHistoryService: historyService,
  mcpStdioClientService: service,
  sleep: async (delayMs) => { sleepCalls.push(delayMs); },
}).then((report) => {
  assert.equal(report.kind, 'mcp-packaged-read-only-call-report');
  assert.equal(report.runtime.mode, 'packaged');
  assert.equal(report.productionRunId, 'probe-smoke');
  assert.equal(report.probe.intervalMs, 5);
  assert.deepEqual(sleepCalls, [5]);
  assert.equal(report.safety.historyAvailable, true);
  assert.equal(report.safety.observedProbeCallCount, 4);
  assert.equal(report.safety.unexpectedToolCallCount, 0);
  assert.equal(report.runtime.kind, 'packaged');
  assert.equal(report.totals.optionalCallSuccesses, 4);
  assert.equal(report.servers.length, 2);
  assert.equal(report.servers[0].toolCountChanged, false);
  assert.equal(report.servers[0].restartEventCount, 0);
  assert.equal(fs.existsSync(outputPath), true);

  return runMcpPackagedReadOnlyCallProbe({
    app: { getVersion: () => '0.0.1' },
    env,
    mcpHistoryService: historyService,
    mcpStdioClientService: service,
    runtimeKind: 'packaged-main-harness',
    runtimeMode: 'unknown',
    sleep: async () => {},
  });
}).then((harnessReport) => {
  assert.equal(harnessReport.runtime.mode, 'unknown');
  assert.equal(harnessReport.runtime.kind, 'packaged-main-harness');

  const fallbackOutputPath = path.join(tempDir, 'packaged-read-only-call-report-process-env.json');
  const fallbackEnv = {
    DESKTOP_PET_MCP_PACKAGED_PRODUCTION_RUN_ID: 'process-env-smoke',
    DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_INTERVAL_MS: '0',
    DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT: fallbackOutputPath,
    DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ROUNDS: '1',
  };
  const previousEnv = Object.fromEntries(
    Object.keys(fallbackEnv).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, fallbackEnv);
  return runMcpPackagedReadOnlyCallProbe({
    app: { getVersion: () => '0.0.1' },
    mcpHistoryService: historyService,
    mcpStdioClientService: service,
    sleep: async () => {},
  }).then((processEnvReport) => {
    assert.equal(processEnvReport.productionRunId, 'process-env-smoke');
    assert.equal(processEnvReport.outputPath, fallbackOutputPath);
  }).finally(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}).then(() => {

  let scheduledCallback = null;
  const disabledSchedule = scheduleMcpPackagedReadOnlyCallProbe({
    env: { DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT: outputPath },
    isDev: false,
    isLocalTest: false,
    log: () => {},
    mcpStdioClientService: service,
    setTimeoutFn: (callback) => {
      scheduledCallback = callback;
      return { unref: () => {} };
    },
  });
  assert.equal(disabledSchedule.scheduled, false);
  assert.equal(scheduledCallback, null);

  const scheduled = scheduleMcpPackagedReadOnlyCallProbe({
    env,
    isDev: false,
    isLocalTest: false,
    log: () => {},
    mcpStdioClientService: service,
    setTimeoutFn: (callback) => {
      scheduledCallback = callback;
      return { unref: () => {} };
    },
  });
  assert.equal(scheduled.scheduled, true);
  assert.equal(typeof scheduledCallback, 'function');
  console.log('MCP packaged read-only call probe smoke passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
