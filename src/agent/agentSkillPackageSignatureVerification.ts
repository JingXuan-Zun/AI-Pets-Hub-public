import { type AgentSkillInstalledPackageRegistry, type AgentSkillInstalledPackage } from './agentSkillPackageInstalledRegistry';
import {
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillPackageSignatureVerifierResult,
} from './agentSkillPackageSignatureVerifier';

export type AgentSkillPackageSignatureStatus = 'blocked' | 'invalid' | 'unsigned' | 'unverified' | 'verified';

export interface AgentSkillPackageSignatureMetadata {
  algorithm: string;
  digest: string;
  keyId: string;
  signature: string;
}

export interface AgentSkillPackageSignatureVerificationRow {
  issueCodes: string[];
  metadata: AgentSkillPackageSignatureMetadata | null;
  packageId: string;
  skillId: string;
  status: AgentSkillPackageSignatureStatus;
  verifier: string;
}

export interface AgentSkillPackageSignatureVerificationReport {
  rows: AgentSkillPackageSignatureVerificationRow[];
  summary: Record<AgentSkillPackageSignatureStatus, number> & { total: number };
}

export interface AgentSkillPackageSignatureVerificationOptions {
  verifier?: AgentSkillPackageSignatureVerifier | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getSignatureContainer(item: AgentSkillInstalledPackage) {
  const packageValue = item.package as unknown;
  if (!isRecord(packageValue)) {
    return null;
  }
  const directSignature = isRecord(packageValue.signature) ? packageValue.signature : null;
  const security = isRecord(packageValue.security) ? packageValue.security : null;
  const securitySignature = security && isRecord(security.signature) ? security.signature : null;
  return directSignature ?? securitySignature;
}

function normalizeSignatureMetadata(item: AgentSkillInstalledPackage): AgentSkillPackageSignatureMetadata | null {
  const value = getSignatureContainer(item);
  if (!value) {
    return null;
  }
  const algorithm = getString(value.algorithm);
  const digest = getString(value.digest);
  const keyId = getString(value.keyId);
  const signature = getString(value.signature);
  if (!algorithm && !digest && !keyId && !signature) {
    return null;
  }
  return { algorithm, digest, keyId, signature };
}

function createMissingFieldIssues(metadata: AgentSkillPackageSignatureMetadata) {
  return [
    metadata.algorithm ? '' : 'signature-algorithm-missing',
    metadata.digest ? '' : 'signature-digest-missing',
    metadata.keyId ? '' : 'signature-key-missing',
    metadata.signature ? '' : 'signature-value-missing',
  ].filter(Boolean);
}

function resolveVerifierStatus(result: AgentSkillPackageSignatureVerifierResult): AgentSkillPackageSignatureStatus {
  if (result.status === 'verified') {
    return 'verified';
  }
  return result.status === 'invalid' ? 'invalid' : 'blocked';
}

function createVerifiedRow(
  item: AgentSkillInstalledPackage,
  metadata: AgentSkillPackageSignatureMetadata,
  verifier: AgentSkillPackageSignatureVerifier,
) {
  const result = verifier.verify({ item, metadata });
  return {
    issueCodes: result.issueCodes,
    metadata,
    packageId: item.id,
    skillId: item.skillId,
    status: resolveVerifierStatus(result),
    verifier: result.verifier,
  };
}

function createRow(
  item: AgentSkillInstalledPackage,
  options: AgentSkillPackageSignatureVerificationOptions,
): AgentSkillPackageSignatureVerificationRow {
  const metadata = normalizeSignatureMetadata(item);
  if (!metadata) {
    return {
      issueCodes: ['package-signature-missing'],
      metadata: null,
      packageId: item.id,
      skillId: item.skillId,
      status: 'unsigned',
      verifier: 'missing',
    };
  }
  const missingFieldIssues = createMissingFieldIssues(metadata);
  if (!missingFieldIssues.length && options.verifier) {
    return createVerifiedRow(item, metadata, options.verifier);
  }
  const issueCodes = ['signature-verifier-missing', ...missingFieldIssues];
  return {
    issueCodes,
    metadata,
    packageId: item.id,
    skillId: item.skillId,
    status: issueCodes.length > 1 ? 'blocked' : 'unverified',
    verifier: 'missing',
  };
}

function createSummary(rows: AgentSkillPackageSignatureVerificationRow[]) {
  const summary = { blocked: 0, invalid: 0, total: rows.length, unsigned: 0, unverified: 0, verified: 0 };
  rows.forEach((row) => {
    summary[row.status] += 1;
  });
  return summary;
}

export function createAgentSkillPackageSignatureVerificationReport(
  installedRegistry: AgentSkillInstalledPackageRegistry,
  options: AgentSkillPackageSignatureVerificationOptions = {},
): AgentSkillPackageSignatureVerificationReport {
  const rows = installedRegistry.packages.map((item) => createRow(item, options));
  return { rows, summary: createSummary(rows) };
}
