import { strict as assert } from 'node:assert';
import {
  createAgentSkillExternalSandboxIsolationReport,
  createEmptyAgentSkillExternalSandboxEvidenceRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillTrustEvidenceRegistry,
  getAgentSkillExternalSandboxEvidenceCodes,
  getAgentSkillExternalSandboxRequiredEvidenceCodes,
  parseAgentSkillExternalSandboxEvidenceRegistryJson,
  serializeAgentSkillExternalSandboxEvidenceRegistry,
  setAgentSkillExternalSandboxEvidenceCode,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const required = getAgentSkillExternalSandboxRequiredEvidenceCodes();
let registry = createEmptyAgentSkillExternalSandboxEvidenceRegistry();
assert.deepEqual(getAgentSkillExternalSandboxEvidenceCodes(registry), []);

registry = setAgentSkillExternalSandboxEvidenceCode(registry, required[0]!, true, '2026-06-29T22:00:00.000Z');
assert.deepEqual(getAgentSkillExternalSandboxEvidenceCodes(registry), [required[0]]);

registry = setAgentSkillExternalSandboxEvidenceCode(registry, required[0]!, false);
assert.deepEqual(getAgentSkillExternalSandboxEvidenceCodes(registry), []);

const fullRegistry = required.reduce(
  (current, code) => setAgentSkillExternalSandboxEvidenceCode(current, code, true, '2026-06-29T22:01:00.000Z'),
  createEmptyAgentSkillExternalSandboxEvidenceRegistry(),
);
const parsed = parseAgentSkillExternalSandboxEvidenceRegistryJson(serializeAgentSkillExternalSandboxEvidenceRegistry(fullRegistry));
assert.deepEqual(getAgentSkillExternalSandboxEvidenceCodes(parsed).sort(), required.sort());

const ignored = parseAgentSkillExternalSandboxEvidenceRegistryJson(JSON.stringify({
  records: [{ code: 'sandbox-arbitrary-network', reviewedAt: '2026-06-29T22:02:00.000Z' }],
}));
assert.deepEqual(getAgentSkillExternalSandboxEvidenceCodes(ignored), []);

const emptyIsolation = createAgentSkillExternalSandboxIsolationReport(
  createEmptyAgentSkillInstalledPackageRegistry(),
  createEmptyAgentSkillInstalledPackageRuntimePolicy(),
  createEmptyAgentSkillTrustEvidenceRegistry(),
  { evidenceCodes: getAgentSkillExternalSandboxEvidenceCodes(parsed) },
);
assert.equal(emptyIsolation.summary.total, 0);

const hookSource = readProjectFile('src/components/settings/useSettingsAgentSkillExternalSandboxEvidenceRegistry.ts');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExternalSandboxIsolationPanel.tsx');
const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
assert.match(hookSource, /setAgentSkillExternalSandboxEvidenceCode/u);
assert.match(panelSource, /onSetExternalSandboxEvidence/u);
assert.match(exchangeSource, /useSettingsAgentSkillExternalSandboxEvidenceRegistry/u);

console.log('agent skill external sandbox evidence registry smoke passed');
