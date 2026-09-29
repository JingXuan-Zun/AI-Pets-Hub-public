import { strict as assert } from 'node:assert';
import {
  createAgentSkillExternalSandboxBootstrapDryRunReport,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillTrustEvidenceRegistry,
  getAgentSkillExternalLoaderRequiredIpcContractCodes,
  getAgentSkillExternalSandboxRequiredEvidenceCodes,
} from '../src/agent';
import { createBootstrapReadyFixture, createUnsignedBootstrapRegistry } from './agent-skill-external-sandbox-bootstrap-fixture';
import { readProjectFile } from './smokeTestHarness.ts';

const unsignedRegistry = createUnsignedBootstrapRegistry();
const blockedReport = createAgentSkillExternalSandboxBootstrapDryRunReport(
  unsignedRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy(),
  createEmptyAgentSkillTrustEvidenceRegistry(),
);
assert.equal(blockedReport.rows[0]?.status, 'blocked');
assert.equal(blockedReport.rows[0]?.attempted, false);
assert.ok(blockedReport.rows[0]?.issueCodes.includes('external-package-loader-disabled'));

const { evidenceRegistry, policy, signedRegistry, trustedPackageIds, verifier } = createBootstrapReadyFixture();
const readyReport = createAgentSkillExternalSandboxBootstrapDryRunReport(
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
assert.equal(readyReport.summary['ready-if-loader-enabled'], 1);
assert.equal(readyReport.summary.attempted, 0);
assert.equal(readyReport.rows[0]?.loaderState, 'disabled');
assert.deepEqual(readyReport.rows[0]?.issueCodes, ['external-package-loader-disabled']);

const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExternalSandboxBootstrapDryRunPanel.tsx');
const securitySource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
assert.match(panelSource, /Sandbox bootstrap dry-run/u);
assert.match(securitySource, /SettingsAgentSkillExternalSandboxBootstrapDryRunPanel/u);

console.log('agent skill external sandbox bootstrap dry-run smoke passed');
