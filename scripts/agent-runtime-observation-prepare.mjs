import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AGENT_RUNTIME_RETIREMENT_REQUIRED_OBSERVATIONS } from './agentRuntimeLegacyRetirementGateCore.mjs';
import { createAgentRuntimeSourceRevision } from './agentRuntimeSourceRevisionCore.mjs';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const reviewerIndex = args.indexOf('--reviewed-by');
const outputPath = resolve(
  outputIndex >= 0 && args[outputIndex + 1]
    ? args[outputIndex + 1]
    : 'PROJECT_AGENT_RUNTIME_V4_OBSERVATION_MANIFEST.json',
);
const reviewedBy = reviewerIndex >= 0 && args[reviewerIndex + 1]
  ? args[reviewerIndex + 1]
  : 'REPLACE_WITH_REVIEWER';

if (existsSync(outputPath) && !args.includes('--force')) {
  throw new Error(`Observation manifest already exists: ${outputPath}. Use --force only when replacing pending evidence intentionally.`);
}

const { fileCount, revision } = createAgentRuntimeSourceRevision(process.cwd());
const manifest = {
  schemaVersion: 1,
  sourceRevision: revision,
  reviewedBy,
  unresolvedRegressions: [],
  observations: AGENT_RUNTIME_RETIREMENT_REQUIRED_OBSERVATIONS.map(({ id }) => ({
    id,
    status: 'pending',
    sourceRevision: revision,
    observedAt: null,
    evidenceRef: '',
  })),
};

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Prepared pending observation manifest: ${outputPath}`);
console.log(revision);
console.log(`files=${fileCount}`);
