import { strict as assert } from 'node:assert';
import {
  AGENT_SKILL_EXTERNAL_SANDBOX_BOOTSTRAP_ENABLED,
  createAgentSkillExternalSandboxBootstrapProcessProfile,
  createAgentSkillExternalSandboxBootstrapStartReport,
  getAgentSkillExternalLoaderRequiredIpcContractCodes,
  getAgentSkillExternalSandboxRequiredEvidenceCodes,
} from '../src/agent';
import { createBootstrapReadyFixture } from './agent-skill-external-sandbox-bootstrap-fixture';
import { readProjectFile } from './smokeTestHarness.ts';

const { evidenceRegistry, policy, signedRegistry, trustedPackageIds, verifier } = createBootstrapReadyFixture('start-key');
const baseOptions = {
  contractCodes: getAgentSkillExternalLoaderRequiredIpcContractCodes(),
  evidenceCodes: getAgentSkillExternalSandboxRequiredEvidenceCodes(),
  signatureVerifier: verifier,
  trustedPackageIds,
};

const missingProfileReport = createAgentSkillExternalSandboxBootstrapStartReport(
  signedRegistry,
  policy,
  evidenceRegistry,
  baseOptions,
);
assert.equal(missingProfileReport.summary['blocked-process-profile'], 1);
assert.equal(missingProfileReport.summary.spawnAttempted, 0);
assert.equal(missingProfileReport.rows[0]?.spawnAttempted, false);
assert.equal(missingProfileReport.rows[0]?.packageImportAttempted, false);
assert.ok(missingProfileReport.rows[0]?.issueCodes.includes('bootstrap-process-profile-missing'));

const readyProfileReport = createAgentSkillExternalSandboxBootstrapStartReport(
  signedRegistry,
  policy,
  evidenceRegistry,
  {
    ...baseOptions,
    processProfile: createAgentSkillExternalSandboxBootstrapProcessProfile(),
  },
);
assert.equal(AGENT_SKILL_EXTERNAL_SANDBOX_BOOTSTRAP_ENABLED, false);
assert.equal(readyProfileReport.summary['blocked-disabled'], 1);
assert.equal(readyProfileReport.summary.spawnAttempted, 0);
assert.equal(readyProfileReport.summary.packageImportAttempted, 0);
assert.equal(readyProfileReport.rows[0]?.featureFlagEnabled, false);
assert.equal(readyProfileReport.rows[0]?.processProfileStatus, 'process-ready-if-bootstrap-enabled');
assert.deepEqual(readyProfileReport.rows[0]?.issueCodes, ['external-package-loader-disabled']);

const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExternalSandboxBootstrapStartPanel.tsx');
const securitySource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
assert.match(panelSource, /Sandbox bootstrap start/u);
assert.match(panelSource, /spawnAttempted/u);
assert.match(securitySource, /SettingsAgentSkillExternalSandboxBootstrapStartPanel/u);

console.log('agent skill external sandbox bootstrap start smoke passed');
