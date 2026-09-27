const fs = require('fs');
const path = require('path');
const {
  loadExternalMcpServers,
  normalizeConfigServers,
} = require('./mcpServerConfigLoader.cjs');

function commandExists(server) {
  if (!server.command || /^(node|npx|npx\.cmd|python|python3|cmd|powershell)$/iu.test(server.command)) {
    return null;
  }

  return fs.existsSync(server.command);
}

function isFakeFixture(server) {
  const joined = [server.command, ...(server.args || [])].join(' ').replace(/\\/g, '/');
  return /scripts\/fixtures\/.*mcp.*server/iu.test(joined);
}

function isReferenceServer(server) {
  const joined = [server.command, ...(server.args || [])].join(' ').replace(/\\/g, '/');
  return /scripts\/reference-mcp-stdio-server\.cjs/iu.test(joined);
}

function hasPlaceholderValue(server) {
  const joined = [
    server.command,
    server.cwd,
    ...(server.args || []),
    ...Object.values(server.env || {}),
  ].join(' ');
  return /\b(replace-me|example|vendor|your-|placeholder)\b|C:\\path\\to\\/iu.test(joined);
}

function createPlaceholderBlocker(server) {
  return hasPlaceholderValue(server)
    ? 'placeholder values must be replaced before real soak'
    : '';
}

function getScriptPathArg(server) {
  const firstArg = (server.args || [])[0] || '';
  if (!/\.(cjs|js|mjs|py)$/iu.test(firstArg)) {
    return '';
  }

  return path.isAbsolute(firstArg) ? firstArg : path.resolve(server.cwd || '', firstArg);
}

function createScriptPathBlocker(server) {
  const scriptPath = getScriptPathArg(server);
  return scriptPath && !fs.existsSync(scriptPath)
    ? 'server script path does not exist'
    : '';
}

function createRunbookCommand(projectRoot, reportDir, rounds, serverId) {
  const reportName = serverId ? `mcp-soak-${serverId}.json` : 'mcp-soak-all.json';
  const parts = [
    'npx.cmd tsx .\\scripts\\agent-mcp-real-server-soak-runner.ts',
    `--projectRoot "${projectRoot}"`,
    `--rounds ${rounds}`,
    `--output "${path.join(reportDir, reportName)}"`,
  ];
  if (serverId) {
    parts.push(`--serverId "${serverId}"`);
  }

  return parts.join(' ');
}

function normalizeRounds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(200, Math.round(parsed))) : 10;
}

function parseDraftServers(rawText, projectRoot) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return null;
  }

  return normalizeConfigServers(JSON.parse(rawText), projectRoot);
}

function createServerReadiness(server) {
  const commandPathExists = commandExists(server);
  const cwdExists = server.cwd ? fs.existsSync(server.cwd) : null;
  const fakeFixture = isFakeFixture(server);
  const referenceServer = isReferenceServer(server);
  const blockers = [
    createPlaceholderBlocker(server),
    createScriptPathBlocker(server),
    commandPathExists === false ? 'command path does not exist' : '',
    cwdExists === false ? 'cwd does not exist' : '',
  ].filter(Boolean);

  return {
    blockers,
    command: server.command,
    commandPathExists,
    cwd: server.cwd || '',
    cwdExists,
    fakeFixture,
    id: server.id,
    readyForRealSoak: blockers.length === 0 && !fakeFixture && !referenceServer,
    referenceServer,
    timeoutMs: server.timeoutMs ?? null,
    title: server.title || server.id,
    warning: fakeFixture
      ? 'fixture server; useful for smoke but not a real external soak sample'
      : referenceServer
        ? 'local reference server; validates the pipeline but is not a real external soak sample'
        : '',
  };
}

function createMcpSoakReadinessService(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));

  function createReadinessReport(request = {}) {
    const rounds = normalizeRounds(request.rounds);
    const reportDir = path.resolve(projectRoot, request.reportDir || path.join('tmp', 'mcp-real-soak-samples'));
    const configPath = path.join(projectRoot, '.desktop-pet-mcp.json');
    const draftServers = parseDraftServers(request.rawText, projectRoot);
    const servers = (draftServers ?? loadExternalMcpServers(projectRoot)).map(createServerReadiness);
    const readyServers = servers.filter((server) => server.readyForRealSoak);
    return {
      configPath,
      configPresent: fs.existsSync(configPath),
      generatedAt: new Date().toISOString(),
      kind: 'mcp-real-server-soak-readiness',
      reportDir,
      source: draftServers ? 'draft-config' : 'saved-config',
      runbook: {
        allServers: createRunbookCommand(projectRoot, reportDir, rounds),
        indexReports: `npx.cmd tsx .\\scripts\\agent-mcp-real-server-soak-sample-index.ts --dir "${reportDir}" --output "${path.join(reportDir, 'index.json')}" --pretty`,
        perServer: readyServers.map((server) => ({
          command: createRunbookCommand(projectRoot, reportDir, rounds, server.id),
          serverId: server.id,
        })),
      },
      servers,
      status: readyServers.length > 0 ? 'ready' : 'blocked',
      totals: {
        blockedServers: servers.length - readyServers.length,
        fakeFixtureServers: servers.filter((server) => server.fakeFixture).length,
        referenceServers: servers.filter((server) => server.referenceServer).length,
        readyServers: readyServers.length,
        servers: servers.length,
      },
      version: 1,
    };
  }

  return {
    createReadinessReport,
  };
}

module.exports = {
  createMcpSoakReadinessService,
};
