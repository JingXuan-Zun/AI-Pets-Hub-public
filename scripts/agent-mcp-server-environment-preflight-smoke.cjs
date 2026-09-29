const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMcpServerEnvironmentPreflightService } = require('../electron/mcpServerEnvironmentPreflightService.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-env-'));
try {
  const workspace = path.join(tempRoot, 'workspace with spaces');
  const bin = path.join(tempRoot, 'runtime bin');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'node.exe'), 'fixture');
  fs.writeFileSync(path.join(bin, 'npx.cmd'), 'fixture');
  const service = createMcpServerEnvironmentPreflightService({
    env: { Path: bin, PATHEXT: '.EXE;.CMD' },
    platform: 'win32',
    projectRoot: tempRoot,
  });

  const nodeResult = service.inspect({
    server: { args: ['server.js'], command: 'node', cwd: workspace, env: {} },
  });
  assert.equal(nodeResult.ok, true);
  assert.equal(nodeResult.status, 'ready');
  assert.equal(nodeResult.resolvedCommand, path.join(bin, 'node.exe'));
  assert.equal(nodeResult.checks.find((check) => check.id === 'space-path').status, 'ready');

  const npxResult = service.inspect({
    server: {
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      command: 'npx.cmd',
      cwd: workspace,
      env: { API_TOKEN: 'YOUR_TOKEN_VALUE' },
    },
  });
  assert.equal(npxResult.ok, false);
  assert.equal(npxResult.status, 'blocked');
  assert.equal(npxResult.commandKind, 'windows-command-script');
  assert.equal(npxResult.checks.find((check) => check.id === 'environment-values').status, 'blocked');
  assert.equal(npxResult.checks.find((check) => check.id === 'npx-network').status, 'warning');
  assert.equal(JSON.stringify(npxResult).includes('YOUR_TOKEN_VALUE'), false);

  const missing = service.inspect({ server: { command: 'missing-runtime', cwd: workspace } });
  assert.equal(missing.status, 'blocked');
  assert.match(missing.checks.find((check) => check.id === 'command-availability').detail, /not found/u);

  const quoted = service.inspect({ server: { command: '"node.exe"', cwd: workspace } });
  assert.equal(quoted.status, 'blocked');
  assert.match(quoted.checks.find((check) => check.id === 'command-availability').detail, /surrounding quotes/u);

  const missingCwd = service.inspect({ server: { command: 'node', cwd: path.join(tempRoot, 'missing') } });
  assert.equal(missingCwd.checks.find((check) => check.id === 'working-directory').status, 'blocked');

  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  const ipcSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ipcHandlers.cjs'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  const formSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'settings', 'SettingsMcpServerForm.tsx'), 'utf8');
  assert.match(mainSource, /createMcpServerEnvironmentPreflightService/u);
  assert.match(ipcSource, /desktop-pet:preflight-mcp-server-environment/u);
  assert.match(ipcSource, /logArgs: false/u);
  assert.match(preloadSource, /preflightMcpServerEnvironment/u);
  assert.match(formSource, /Check host/u);
  assert.match(formSource, /No server process was started/u);
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'electron', 'mcpServerEnvironmentPreflightService.cjs'), 'utf8').includes('child_process'), false);
  console.log('agent MCP server environment preflight smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
