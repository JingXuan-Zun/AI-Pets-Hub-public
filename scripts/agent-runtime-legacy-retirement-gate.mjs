import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  evaluateAgentRuntimeLegacyRetirementGate,
  formatAgentRuntimeLegacyRetirementGateReport,
  inspectAgentRuntimeLegacyRetirementStaticCoverage,
} from './agentRuntimeLegacyRetirementGateCore.mjs';

import { createAgentRuntimeSourceRevision } from './agentRuntimeSourceRevisionCore.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const reportOnly = args.includes('--report-only');
const evidenceFlagIndex = args.indexOf('--evidence');
const configuredEvidencePath = evidenceFlagIndex >= 0 ? args[evidenceFlagIndex + 1] : null;
const evidencePath = configuredEvidencePath || process.env.AGENT_RUNTIME_RETIREMENT_EVIDENCE || null;

let observationManifest = null;
if (evidencePath) {
  const absoluteEvidencePath = resolve(evidencePath);
  if (!existsSync(absoluteEvidencePath)) {
    console.error(`Production observation manifest does not exist: ${absoluteEvidencePath}`);
    process.exitCode = 1;
  } else {
    observationManifest = JSON.parse(readFileSync(absoluteEvidencePath, 'utf8'));
  }
}

const { revision: currentSourceRevision } = createAgentRuntimeSourceRevision(process.cwd());
const result = evaluateAgentRuntimeLegacyRetirementGate({
  currentSourceRevision,
  observationManifest,
  staticChecks: inspectAgentRuntimeLegacyRetirementStaticCoverage(process.cwd()),
});

console.log(json
  ? JSON.stringify(result, null, 2)
  : formatAgentRuntimeLegacyRetirementGateReport(result));

if (!reportOnly && !result.ready) {
  process.exitCode = 1;
}
