import { strict as assert } from 'node:assert';
import {
  createAgentSkillExternalSandboxBootstrapGateReport,
  getAgentSkillExternalLoaderRequiredIpcContractCodes,
  getAgentSkillExternalSandboxRequiredEvidenceCodes,
} from '../src/agent';
import { createBootstrapReadyFixture } from './agent-skill-external-sandbox-bootstrap-fixture';
import { readProjectFile } from './smokeTestHarness.ts';

const { evidenceRegistry, policy, signedRegistry, trustedPackageIds, verifier } = createBootstrapReadyFixture('gate-key');
const report = createAgentSkillExternalSandboxBootstrapGateReport(
  signedRegistry,
  policy,
  evidenceRegistry,
  {
    contractCodes: getAgentSkillExternalLoaderRequiredIpcContractCodes(),
    evidenceCodes: getAgentSkillExternalSandboxRequiredEvidenceCodes(),
    signatureVerifier: verifier,
    trustedPackageIds,
  },
);
assert.equal(report.summary['blocked-disabled'], 1);
assert.equal(report.summary.started, 0);
assert.equal(report.rows[0]?.started, false);
assert.equal(report.rows[0]?.status, 'blocked-disabled');
assert.deepEqual(report.rows[0]?.issueCodes, ['external-package-loader-disabled']);

const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExternalSandboxBootstrapGatePanel.tsx');
const securitySource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
assert.match(panelSource, /Sandbox bootstrap gate/u);
assert.match(securitySource, /SettingsAgentSkillExternalSandboxBootstrapGatePanel/u);

console.log('agent skill external sandbox bootstrap gate smoke passed');
