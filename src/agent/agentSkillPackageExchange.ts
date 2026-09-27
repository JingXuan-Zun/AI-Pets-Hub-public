import { createAgentSkillAuthoringScaffold, type AgentSkillAuthoringScaffold } from './agentSkillAuthoringScaffold';
import { createAgentSkillManifest } from './agentSkillManifest';

export const AGENT_SKILL_PACKAGE_KIND = 'agent-skill-package.v1';

export interface AgentSkillPackageExport {
  exportedAt: string;
  kind: typeof AGENT_SKILL_PACKAGE_KIND;
  runtime?: AgentSkillPackageRuntime;
  security?: AgentSkillPackageSecurityMetadata;
  scaffold: AgentSkillAuthoringScaffold;
  signature?: AgentSkillPackageSignatureEnvelope;
}

export interface AgentSkillPackageRuntime {
  capabilityEntrypoint?: string;
  entrypoint: string;
  kind: 'wasm-pure-i32-v1' | 'wasm-pure-json-v1';
  moduleBase64: string;
}

export interface AgentSkillPackageSignatureEnvelope {
  algorithm?: string;
  digest?: string;
  keyId?: string;
  signature?: string;
}

export interface AgentSkillPackageSecurityMetadata {
  signature?: AgentSkillPackageSignatureEnvelope;
}

export interface AgentSkillPackageImportPreview {
  errors: string[];
  kind: string;
  ok: boolean;
  package: AgentSkillPackageExport | null;
  skillId: string;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSignatureEnvelope(value: unknown): AgentSkillPackageSignatureEnvelope | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const envelope = {
    algorithm: getString(value.algorithm) || undefined,
    digest: getString(value.digest) || undefined,
    keyId: getString(value.keyId) || undefined,
    signature: getString(value.signature) || undefined,
  };
  return Object.values(envelope).some(Boolean) ? envelope : undefined;
}

function normalizeSecurityMetadata(value: unknown): AgentSkillPackageSecurityMetadata | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const signature = normalizeSignatureEnvelope(value.signature);
  return signature ? { signature } : undefined;
}

function normalizeRuntime(value: unknown): AgentSkillPackageRuntime | undefined {
  if (!isRecord(value) || !['wasm-pure-i32-v1', 'wasm-pure-json-v1'].includes(String(value.kind))) {
    return undefined;
  }
  const entrypoint = getString(value.entrypoint);
  const capabilityEntrypoint = getString(value.capabilityEntrypoint) || undefined;
  const moduleBase64 = getString(value.moduleBase64);
  return entrypoint && moduleBase64
    ? { capabilityEntrypoint, entrypoint, kind: value.kind as AgentSkillPackageRuntime['kind'], moduleBase64 }
    : undefined;
}

function normalizePackageExport(value: unknown): AgentSkillPackageExport | null {
  if (!isRecord(value) || value.kind !== AGENT_SKILL_PACKAGE_KIND || !isRecord(value.scaffold)) {
    return null;
  }

  const skill = isRecord(value.scaffold.skill) ? value.scaffold.skill : {};
  const skillId = getString(skill.id);
  if (!skillId) {
    return null;
  }

  return {
    exportedAt: getString(value.exportedAt) || new Date(0).toISOString(),
    kind: AGENT_SKILL_PACKAGE_KIND,
    runtime: normalizeRuntime(value.runtime),
    security: normalizeSecurityMetadata(value.security),
    scaffold: value.scaffold as unknown as AgentSkillAuthoringScaffold,
    signature: normalizeSignatureEnvelope(value.signature),
  };
}

function createMetadataWarnings(packageExport: AgentSkillPackageExport) {
  const entry = createAgentSkillManifest().entries.find((item) => item.id === packageExport.scaffold.skill.id);
  if (!entry) {
    return { errors: [`Unknown registered Skill: ${packageExport.scaffold.skill.id}`], warnings: [] };
  }

  const warnings = [
    entry.package.version === packageExport.scaffold.package.version
      ? ''
      : `Version differs: registry ${entry.package.version}, package ${packageExport.scaffold.package.version}.`,
    entry.package.runtime === packageExport.scaffold.package.runtime
      ? ''
      : `Runtime differs: registry ${entry.package.runtime}, package ${packageExport.scaffold.package.runtime}.`,
  ].filter(Boolean);

  return { errors: [], warnings };
}

export function createAgentSkillPackageExport(skillId: string, exportedAt = new Date().toISOString()) {
  const scaffold = createAgentSkillAuthoringScaffold(skillId);
  if (!scaffold) {
    return null;
  }

  return {
    exportedAt,
    kind: AGENT_SKILL_PACKAGE_KIND,
    scaffold,
  } satisfies AgentSkillPackageExport;
}

export function parseAgentSkillPackageImportJson(inputJson: string): AgentSkillPackageImportPreview {
  try {
    const parsed = JSON.parse(inputJson) as unknown;
    const packageExport = normalizePackageExport(parsed);
    if (!packageExport) {
      return {
        errors: ['Input is not an agent-skill-package.v1 JSON object.'],
        kind: isRecord(parsed) ? getString(parsed.kind) : '',
        ok: false,
        package: null,
        skillId: '',
        warnings: [],
      };
    }

    const metadataResult = createMetadataWarnings(packageExport);
    return {
      errors: metadataResult.errors,
      kind: packageExport.kind,
      ok: metadataResult.errors.length === 0,
      package: packageExport,
      skillId: packageExport.scaffold.skill.id,
      warnings: metadataResult.warnings,
    };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : 'Invalid JSON.'],
      kind: '',
      ok: false,
      package: null,
      skillId: '',
      warnings: [],
    };
  }
}
