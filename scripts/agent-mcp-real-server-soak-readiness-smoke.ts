import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseMcpSoakReadinessArgs,
  runMcpSoakReadiness,
} from './agent-mcp-real-server-soak-readiness.ts';
import { projectPath } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-soak-readiness-'));
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
const previousEnvConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;

async function assertEmptyConfig() {
  delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  const result = await runMcpSoakReadiness({ projectRoot: tempRoot, rounds: 2 });
  assert.equal(result.status, 'blocked');
  assert.equal(result.configPresent, false);
  assert.equal(result.source, 'saved-config');
  assert.equal(result.totals.servers, 0);
  assert.match(result.runbook.allServers, /agent-mcp-real-server-soak-runner/u);
}

async function assertFakeAndReadyConfig() {
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = JSON.stringify({
    servers: [{
      args: [fakeServerPath],
      command: process.execPath,
      env: { TOKEN: 'secret-token' },
      id: 'fixture-server',
      title: 'Fixture Server',
    }, {
      args: ['--version'],
      command: process.execPath,
      id: 'ready-server',
      title: 'Ready Server',
    }],
  });
  const outputPath = path.join(tempRoot, 'readiness.json');
  const result = await runMcpSoakReadiness({
    outputPath,
    projectRoot: tempRoot,
    reportDir: 'reports',
    rounds: 5,
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'saved-config');
  assert.equal(result.totals.servers, 2);
  assert.equal(result.totals.readyServers, 1);
  assert.equal(result.totals.fakeFixtureServers, 1);
  assert.equal(result.servers.find((server) => server.id === 'fixture-server')?.fakeFixture, true);
  assert.equal(result.servers.find((server) => server.id === 'ready-server')?.readyForRealSoak, true);
  assert.equal(result.runbook.perServer.length, 1);
  assert.match(result.runbook.perServer[0]?.command ?? '', /--serverId "ready-server"/u);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(fs.readFileSync(outputPath, 'utf8').includes('secret-token'), false);
}

async function assertInputDraftConfig() {
  delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
  const inputPath = path.join(tempRoot, 'draft-mcp-config.json');
  fs.writeFileSync(inputPath, JSON.stringify({
    servers: [{
      args: ['--version'],
      command: process.execPath,
      env: { TOKEN: 'draft-token' },
      id: 'input-draft-server',
    }],
  }));
  const outputPath = path.join(tempRoot, 'draft-readiness.json');
  const result = await runMcpSoakReadiness({
    inputPath,
    outputPath,
    projectRoot: tempRoot,
    rounds: 3,
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'draft-config');
  assert.equal(result.configPresent, false);
  assert.equal(result.servers[0]?.id, 'input-draft-server');
  assert.equal(fs.readFileSync(outputPath, 'utf8').includes('draft-token'), false);
}

async function assertRawTextDraftConfig() {
  const result = await runMcpSoakReadiness({
    projectRoot: tempRoot,
    rawText: JSON.stringify({
      servers: [{
        args: ['--version'],
        command: process.execPath,
        id: 'raw-text-server',
      }],
    }),
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'draft-config');
  assert.equal(result.totals.readyServers, 1);
  assert.match(result.runbook.perServer[0]?.command ?? '', /--serverId "raw-text-server"/u);
}

async function assertTemplateDraftBlocked() {
  const result = await runMcpSoakReadiness({
    projectRoot: tempRoot,
    rawText: JSON.stringify({
      servers: [{
        args: ['-y', '@vendor/real-mcp-server'],
        command: 'npx.cmd',
        env: { API_KEY: 'replace-me' },
        id: 'template-server',
      }],
    }),
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.totals.readyServers, 0);
  assert.equal(result.runbook.perServer.length, 0);
  assert.match(result.servers[0]?.blockers?.join(' ') ?? '', /placeholder values/u);
}

const parsed = parseMcpSoakReadinessArgs([
  '--projectRoot',
  tempRoot,
  '--reportDir',
  'reports',
  '--rounds',
  '5',
  '--input',
  'draft.json',
]);
assert.equal(parsed.projectRoot, tempRoot);
assert.equal(parsed.reportDir, 'reports');
assert.equal(parsed.rounds, 5);
assert.equal(parsed.inputPath, 'draft.json');

await assertEmptyConfig();
await assertFakeAndReadyConfig();
await assertInputDraftConfig();
await assertRawTextDraftConfig();
await assertTemplateDraftBlocked();

assert.throws(
  () => parseMcpSoakReadinessArgs(['--rawText']),
  /Missing value after --rawText/u,
);
await assert.rejects(
  () => runMcpSoakReadiness({ inputPath: 'draft.json', rawText: '{}' }),
  /Use either --input or --rawText/u,
);

if (previousEnvConfig === undefined) {
  delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
} else {
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousEnvConfig;
}

console.log('agent MCP real-server soak readiness smoke passed');
