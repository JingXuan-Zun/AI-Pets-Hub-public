import { type AgentSkillPackageExport } from './agentSkillPackageExchange';
import { type AgentSkillInstalledPackage } from './agentSkillPackageInstalledRegistry';

export const AGENT_SKILL_PACKAGE_SIGNATURE_PAYLOAD_VERSION = 'agent-skill-package-signature-payload.v1';

export interface AgentSkillPackageSignaturePayload {
  kind: typeof AGENT_SKILL_PACKAGE_SIGNATURE_PAYLOAD_VERSION;
  package: AgentSkillPackageExport;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneWithoutSignature(packageExport: AgentSkillPackageExport): AgentSkillPackageExport {
  const security = packageExport.security?.signature
    ? { ...packageExport.security, signature: undefined }
    : packageExport.security;
  const normalizedSecurity = security && Object.values(security).some(Boolean) ? security : undefined;
  const nextPackage = {
    ...packageExport,
    security: normalizedSecurity,
    signature: undefined,
  };
  return JSON.parse(JSON.stringify(nextPackage)) as AgentSkillPackageExport;
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = normalizeJsonValue(value[key]);
      return result;
    }, {});
}

export function createAgentSkillPackageSignaturePayload(
  item: AgentSkillInstalledPackage,
): AgentSkillPackageSignaturePayload {
  return {
    kind: AGENT_SKILL_PACKAGE_SIGNATURE_PAYLOAD_VERSION,
    package: cloneWithoutSignature(item.package),
  };
}

export function canonicalizeAgentSkillPackageSignaturePayload(
  payload: AgentSkillPackageSignaturePayload,
) {
  return JSON.stringify(normalizeJsonValue(payload));
}

export function createAgentSkillPackageCanonicalSignaturePayload(
  item: AgentSkillInstalledPackage,
) {
  return canonicalizeAgentSkillPackageSignaturePayload(
    createAgentSkillPackageSignaturePayload(item),
  );
}
