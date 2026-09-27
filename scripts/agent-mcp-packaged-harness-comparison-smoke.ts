import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createSettingsMcpPackagedHarnessComparison,
} from '../src/components/settings/settingsMcpPackagedHarnessComparison.ts';
import {
  parseMcpPackagedHarnessComparisonArgs,
  runMcpPackagedHarnessComparison,
} from './agent-mcp-packaged-harness-comparison.ts';

function createCallReport(successes: number, kind = 'packaged') {
  return {
    kind: 'mcp-packaged-read-only-call-report' as const,
    runtime: { kind, mode: kind === 'packaged' ? 'packaged' as const : 'unknown' as const },
    servers: [
      {
        id: 'filesystem',
        listSuccessCount: successes,
        optionalCallSuccessCount: successes,
      },
      {
        id: 'memory',
        listSuccessCount: successes,
        optionalCallSuccessCount: successes,
      },
    ],
    version: 1 as const,
  };
}

const comparison = createSettingsMcpPackagedHarnessComparison(
  createCallReport(0),
  createCallReport(20, 'packaged-main-harness'),
);
assert.equal(comparison.status, 'blocked');
assert.equal(comparison.packagedCoveredServerCount, 0);
assert.equal(comparison.harnessCoveredServerCount, 2);
assert.match(comparison.conclusion, /Harness coverage succeeds/u);
assert.match(comparison.summaryText, /packaged=0\/2/u);
assert.match(comparison.summaryText, /harness=2\/2/u);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-packaged-harness-comparison-'));
const packagedPath = path.join(tempDir, 'packaged.json');
const harnessPath = path.join(tempDir, 'harness.json');
const outputPath = path.join(tempDir, 'comparison.json');
fs.writeFileSync(packagedPath, `${JSON.stringify(createCallReport(0), null, 2)}\n`, 'utf8');
fs.writeFileSync(harnessPath, `${JSON.stringify(createCallReport(20, 'packaged-main-harness'), null, 2)}\n`, 'utf8');

const parsed = parseMcpPackagedHarnessComparisonArgs([
  '--packaged-report',
  packagedPath,
  '--harness-report',
  harnessPath,
  '--output',
  outputPath,
  '--pretty',
]);
assert.equal(parsed.pretty, true);

const cliComparison = runMcpPackagedHarnessComparison(parsed);
assert.equal(cliComparison.harnessCoveredServerCount, 2);
assert.equal(fs.existsSync(outputPath), true);
assert.throws(
  () => parseMcpPackagedHarnessComparisonArgs(['--packaged-report', packagedPath]),
  /Usage:/u,
);

console.log('agent MCP packaged harness comparison smoke passed');
