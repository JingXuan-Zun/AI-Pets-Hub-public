import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseMcpConfigPreflightArgs,
  runMcpConfigPreflight,
} from './agent-mcp-config-preflight.ts';
import {
  formatSettingsMcpConfigPreflightExportText,
} from '../src/components/settings/settingsMcpConfigPreflightExport';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-config-preflight-'));

const parsed = parseMcpConfigPreflightArgs([
  '--projectRoot',
  tempRoot,
  '--input',
  'draft.json',
  '--evidence',
  'evidence.json',
  '--output',
  'out.json',
]);
assert.equal(parsed.projectRoot, tempRoot);
assert.equal(parsed.inputPath, 'draft.json');
assert.equal(parsed.evidencePath, 'evidence.json');
assert.equal(parsed.outputPath, 'out.json');

const missingSaved = runMcpConfigPreflight({ projectRoot: tempRoot });
assert.equal(missingSaved.status, 'blocked');
assert.equal(missingSaved.exists, false);
assert.equal(missingSaved.source, 'saved-config');
assert.equal(missingSaved.preflight.serverCount, 0);
assert.equal(missingSaved.preflight.statusCounts.blocked, 1);

const invalidJson = runMcpConfigPreflight({
  projectRoot: tempRoot,
  rawText: '{ bad json',
});
assert.equal(invalidJson.status, 'blocked');
assert.equal(invalidJson.preflight.checks.some((check) => check.id === 'config-json'), true);
assert.equal(invalidJson.preflight.statusCounts.blocked, 2);

const duplicatePath = path.join(tempRoot, 'duplicate.json');
fs.writeFileSync(duplicatePath, JSON.stringify({
  servers: [{
    args: ['server-a.js'],
    command: 'node',
    id: 'dup',
  }, {
    args: ['server-b.js'],
    command: 'node',
    id: 'dup',
  }],
}));
const duplicateReport = runMcpConfigPreflight({
  inputPath: duplicatePath,
  projectRoot: tempRoot,
});
assert.equal(duplicateReport.status, 'blocked');
assert.equal(duplicateReport.source, 'input-file');
assert.equal(duplicateReport.preflight.checks.some((check) => check.id === 'duplicate-dup'), true);

const fixtureReport = runMcpConfigPreflight({
  projectRoot: tempRoot,
  rawText: JSON.stringify({
    servers: [{
      args: ['scripts/fixtures/fake-mcp-stdio-server.cjs'],
      command: 'node',
      id: 'fixture-server',
    }],
  }),
});
assert.equal(fixtureReport.status, 'warning');
assert.equal(fixtureReport.preflight.checks.some((check) => check.id === 'fixture-fixture-server'), true);
assert.equal(fixtureReport.preflight.statusCounts.warning, 1);

const referenceReport = runMcpConfigPreflight({
  projectRoot: tempRoot,
  rawText: JSON.stringify({
    servers: [{
      args: ['scripts/reference-mcp-stdio-server.cjs'],
      command: 'node',
      id: 'reference-server',
    }],
  }),
});
assert.equal(referenceReport.status, 'warning');
assert.equal(referenceReport.preflight.checks.some((check) => check.id === 'reference-reference-server'), true);
assert.equal(referenceReport.preflight.statusCounts.warning, 1);

const outputPath = path.join(tempRoot, 'template-report.json');
const templateReport = runMcpConfigPreflight({
  outputPath,
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
assert.equal(templateReport.status, 'blocked');
assert.equal(fs.existsSync(outputPath), true);
assert.equal(fs.readFileSync(outputPath, 'utf8').includes('replace-me'), false);

const readyConfigText = JSON.stringify({
  servers: [{
    args: ['server.js'],
    command: 'node',
    id: 'ready-server',
  }],
});
const readyReport = runMcpConfigPreflight({
  projectRoot: tempRoot,
  rawText: readyConfigText,
});
assert.equal(readyReport.preflight.statusCounts.ready, readyReport.preflight.checks.length);
const evidencePath = path.join(tempRoot, 'ready-evidence.json');
fs.writeFileSync(evidencePath, formatSettingsMcpConfigPreflightExportText(readyReport.preflight));
const matchingEvidenceReport = runMcpConfigPreflight({
  evidencePath,
  projectRoot: tempRoot,
  rawText: readyConfigText,
});
assert.equal(matchingEvidenceReport.evidence?.currentMatch, true);

const mismatchedEvidenceReport = runMcpConfigPreflight({
  evidencePath,
  projectRoot: tempRoot,
  rawText: '{"servers":[]}',
});
assert.equal(mismatchedEvidenceReport.evidence?.currentMatch, false);

const evidenceOutputPath = path.join(tempRoot, 'evidence-report.json');
runMcpConfigPreflight({
  evidencePath,
  outputPath: evidenceOutputPath,
  projectRoot: tempRoot,
  rawText: readyConfigText,
});
const evidenceOutputText = fs.readFileSync(evidenceOutputPath, 'utf8');
assert.equal(evidenceOutputText.includes('"currentMatch": true'), true);
assert.equal(evidenceOutputText.includes('server.js'), false);

assert.throws(
  () => parseMcpConfigPreflightArgs(['--rawText']),
  /Missing value after --rawText/u,
);
assert.throws(
  () => parseMcpConfigPreflightArgs(['--evidence']),
  /Missing value after --evidence/u,
);
assert.throws(
  () => runMcpConfigPreflight({ inputPath: 'draft.json', rawText: '{}' }),
  /Use either --input or --rawText/u,
);
assert.throws(
  () => runMcpConfigPreflight({ evidencePath: 'missing.json', projectRoot: tempRoot }),
  /missing\.json/u,
);

console.log('agent MCP config preflight smoke passed');
