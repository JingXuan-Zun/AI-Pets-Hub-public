import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMcpCompatibilityMatrix } from './agent-mcp-compatibility-matrix.ts';
import { projectRoot } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-compatibility-matrix-smoke-'));
try {
  const outputPath = path.join(tempRoot, 'report.json');
  const report = await runMcpCompatibilityMatrix(outputPath);
  assert.equal(report.kind, 'mcp-compatibility-matrix-report.v1');
  assert.deepEqual(report.summary, { failed: 0, passed: 8, total: 8 });
  assert.equal(fs.existsSync(outputPath), true);
  const reportText = fs.readFileSync(outputPath, 'utf8');
  assert.equal(reportText.includes('secret-token'), false);
  assert.equal(reportText.includes(projectRoot), false);
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

console.log('agent MCP compatibility matrix smoke passed');
