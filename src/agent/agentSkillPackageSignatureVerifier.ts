import { type AgentSkillInstalledPackage } from './agentSkillPackageInstalledRegistry';
import { type AgentSkillPackageSignatureMetadata } from './agentSkillPackageSignatureVerification';

export type AgentSkillPackageSignatureVerifierStatus = 'invalid' | 'unsupported' | 'verified';

export interface AgentSkillPackageSignatureVerifierInput {
  item: AgentSkillInstalledPackage;
  metadata: AgentSkillPackageSignatureMetadata;
}

export interface AgentSkillPackageSignatureVerifierResult {
  issueCodes: string[];
  status: AgentSkillPackageSignatureVerifierStatus;
  verifier: string;
}

export interface AgentSkillPackageSignatureVerifier {
  verifier: string;
  verify: (input: AgentSkillPackageSignatureVerifierInput) => AgentSkillPackageSignatureVerifierResult;
}

export interface AgentSkillPackageSignatureFixture {
  algorithm: string;
  digest: string;
  keyId: string;
  packageId?: string;
  signature: string;
  skillId?: string;
}

function matchesOptionalScope(
  fixture: AgentSkillPackageSignatureFixture,
  input: AgentSkillPackageSignatureVerifierInput,
) {
  return (!fixture.packageId || fixture.packageId === input.item.id)
    && (!fixture.skillId || fixture.skillId === input.item.skillId);
}

function matchesSignature(
  fixture: AgentSkillPackageSignatureFixture,
  metadata: AgentSkillPackageSignatureMetadata,
) {
  return fixture.algorithm === metadata.algorithm
    && fixture.digest === metadata.digest
    && fixture.keyId === metadata.keyId
    && fixture.signature === metadata.signature;
}

function resolveFixtureIssues(input: AgentSkillPackageSignatureVerifierInput) {
  return [
    input.metadata.algorithm ? '' : 'signature-algorithm-missing',
    input.metadata.digest ? '' : 'signature-digest-missing',
    input.metadata.keyId ? '' : 'signature-key-missing',
    input.metadata.signature ? '' : 'signature-value-missing',
  ].filter(Boolean);
}

export function createAgentSkillFixtureSignatureVerifier(
  fixtures: readonly AgentSkillPackageSignatureFixture[],
): AgentSkillPackageSignatureVerifier {
  return {
    verifier: 'fixture-signature-verifier',
    verify(input) {
      const fieldIssues = resolveFixtureIssues(input);
      if (fieldIssues.length) {
        return { issueCodes: fieldIssues, status: 'unsupported', verifier: 'fixture-signature-verifier' };
      }
      const verified = fixtures.some((fixture) => (
        matchesOptionalScope(fixture, input) && matchesSignature(fixture, input.metadata)
      ));
      return verified
        ? { issueCodes: [], status: 'verified', verifier: 'fixture-signature-verifier' }
        : { issueCodes: ['signature-fixture-mismatch'], status: 'invalid', verifier: 'fixture-signature-verifier' };
    },
  };
}
