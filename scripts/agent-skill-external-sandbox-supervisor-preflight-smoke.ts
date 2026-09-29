import { strict as assert } from 'node:assert';
import {
  createAgentSkillExternalSandboxBootstrapProcessProfile,
  createAgentSkillExternalSandboxSupervisorContract,
  createAgentSkillExternalSandboxSupervisorPreflightReport,
  getAgentSkillExternalLoaderRequiredIpcContractCodes,
  getAgentSkillExternalSandboxRequiredEvidenceCodes,
} from '../src/agent';
import { createBootstrapReadyFixture } from './agent-skill-external-sandbox-bootstrap-fixture';
import { readProjectFile } from './smokeTestHarness.ts';

const { evidenceRegistry, policy, signedRegistry, trustedPackageIds, verifier } = createBootstrapReadyFixture('supervisor-key');
const baseOptions = {
  contractCodes: getAgentSkillExternalLoaderRequiredIpcContractCodes(),
  evidenceCodes: getAgentSkillExternalSandboxRequiredEvidenceCodes(),
  processProfile: createAgentSkillExternalSandboxBootstrapProcessProfile(),
  signatureVerifier: verifier,
  trustedPackageIds,
};

const missingContractReport = createAgentSkillExternalSandboxSupervisorPreflightReport(
  signedRegistry,
  policy,
  evidenceRegistry,
  baseOptions,
);
assert.equal(missingContractReport.summary['blocked-supervisor-contract'], 1);
assert.equal(missingContractReport.summary.supervisorLaunchAttempted, 0);
assert.equal(missingContractReport.rows[0]?.supervisorLaunchAttempted, false);
assert.equal(missingContractReport.rows[0]?.spawnAttempted, false);
assert.equal(missingContractReport.rows[0]?.packageImportAttempted, false);
assert.ok(missingContractReport.rows[0]?.issueCodes.includes('supervisor-contract-missing'));

const readyContractReport = createAgentSkillExternalSandboxSupervisorPreflightReport(
  signedRegistry,
  policy,
  evidenceRegistry,
  {
    ...baseOptions,
    supervisorContract: createAgentSkillExternalSandboxSupervisorContract(),
  },
);
const row = readyContractReport.rows[0]!;
assert.equal(readyContractReport.summary['supervisor-ready-if-bootstrap-enabled'], 1);
assert.equal(readyContractReport.summary.supervisorLaunchAttempted, 0);
assert.equal(row.startStatus, 'blocked-disabled');
assert.equal(row.supervisorContractId, 'external-skill-sandbox-supervisor-v1');
assert.equal(row.supervisorLaunchAttempted, false);
assert.equal(row.spawnAttempted, false);
assert.equal(row.packageImportAttempted, false);
assert.deepEqual(row.issueCodes, ['external-package-loader-disabled']);

const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExternalSandboxSupervisorPreflightPanel.tsx');
const securitySource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
assert.match(panelSource, /Sandbox supervisor preflight/u);
assert.match(panelSource, /supervisorLaunchAttempted/u);
assert.match(securitySource, /SettingsAgentSkillExternalSandboxSupervisorPreflightPanel/u);

console.log('agent skill external sandbox supervisor preflight smoke passed');
