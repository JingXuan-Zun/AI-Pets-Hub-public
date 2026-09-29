import { strict as assert } from 'node:assert';
import {
  AGENT_SKILL_MARKETPLACE_IDENTITY_METADATA_KIND,
  createAgentSkillMarketplaceIdentityMetadataPreviewReport,
  createAgentSkillMarketplaceInstallReadinessPreviewReport,
  createEmptyAgentSkillInstalledPackageRegistry,
} from '../src/agent';
import { createSignedUpdateFixture } from './agent-skill-signed-package-update-fixture';
import { readProjectFile } from './smokeTestHarness.ts';

const { signedLibrary, verifier } = createSignedUpdateFixture('2026-06-29T20:00:00.000Z', 'identity-key');
const draft = signedLibrary.drafts[0]!;

const wrongKindReport = createAgentSkillMarketplaceIdentityMetadataPreviewReport(
  JSON.stringify({ kind: 'wrong-kind', records: [] }),
  signedLibrary,
);
assert.equal(wrongKindReport.parseError, 'Input is not marketplace identity metadata.');
assert.equal(wrongKindReport.rows.length, 0);

const mismatchReport = createAgentSkillMarketplaceIdentityMetadataPreviewReport(
  JSON.stringify({
    kind: AGENT_SKILL_MARKETPLACE_IDENTITY_METADATA_KIND,
    records: [{ draftId: draft.id, packageVersion: '9.9.9', publisherId: 'studio', skillId: draft.skillId, sourceId: 'source' }],
  }),
  signedLibrary,
);
assert.equal(mismatchReport.rows[0]?.status, 'blocked');
assert.ok(mismatchReport.rows[0]?.issueCodes.includes('blocked-package-version-mismatch'));

const readyReport = createAgentSkillMarketplaceIdentityMetadataPreviewReport(
  JSON.stringify({
    kind: AGENT_SKILL_MARKETPLACE_IDENTITY_METADATA_KIND,
    records: [{
      channel: 'stable',
      draftId: draft.id,
      packageVersion: draft.package.scaffold.package.version,
      publisherId: 'studio',
      reviewedAt: '2026-06-30T00:00:00.000Z',
      reviewer: 'local-reviewer',
      skillId: draft.skillId,
      sourceId: 'source',
    }],
  }),
  signedLibrary,
);
assert.equal(readyReport.rows[0]?.status, 'ready');
assert.equal(readyReport.summary.ready, 1);
assert.equal(readyReport.summary.downloadAttempted, 0);
assert.equal(readyReport.summary.registryMutated, 0);

const readiness = createAgentSkillMarketplaceInstallReadinessPreviewReport(
  signedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
  { identityRows: readyReport.rows, signatureVerifier: verifier },
);
assert.equal(readiness.rows[0]?.sourceIdentity, 'local-draft');
assert.equal(readiness.rows[0]?.status, 'review-required');
assert.ok(readiness.rows[0]?.issueCodes.includes('marketplace-disabled'));
assert.equal(readiness.summary.downloadAttempted, 0);
assert.equal(readiness.summary.installAttempted, 0);

const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillMarketplaceInstallReadinessPanel.tsx');
assert.match(panelSource, /agent-skill-marketplace-identity-metadata\.v1/u);
assert.match(panelSource, /createAgentSkillMarketplaceIdentityMetadataPreviewReport/u);

console.log('agent skill marketplace identity metadata preview smoke passed');
