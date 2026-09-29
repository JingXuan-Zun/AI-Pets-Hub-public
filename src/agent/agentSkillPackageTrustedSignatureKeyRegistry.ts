import { type AgentSkillPackageTrustedSignatureKey } from './agentSkillPackageCryptoSignatureVerifier';

export const AGENT_SKILL_TRUSTED_SIGNATURE_KEY_REGISTRY_KIND = 'agent-skill-trusted-signature-key-registry.v1';
const MAX_AGENT_SKILL_TRUSTED_SIGNATURE_KEYS = 24;

export interface AgentSkillTrustedSignatureKeyRecord extends AgentSkillPackageTrustedSignatureKey {
  addedAt: string;
  label: string;
}

export interface AgentSkillTrustedSignatureKeyRegistry {
  kind: typeof AGENT_SKILL_TRUSTED_SIGNATURE_KEY_REGISTRY_KIND;
  keys: AgentSkillTrustedSignatureKeyRecord[];
}

export interface AgentSkillTrustedSignatureKeyResult {
  error: string | null;
  registry: AgentSkillTrustedSignatureKeyRegistry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value: unknown): AgentSkillTrustedSignatureKeyRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const keyId = getString(value.keyId);
  const publicKey = getString(value.publicKey);
  if (!keyId || !publicKey || value.algorithm !== 'ed25519') {
    return null;
  }
  return {
    addedAt: getString(value.addedAt) || new Date(0).toISOString(),
    algorithm: 'ed25519',
    keyId,
    label: getString(value.label) || keyId,
    publicKey,
  };
}

export function createEmptyAgentSkillTrustedSignatureKeyRegistry(): AgentSkillTrustedSignatureKeyRegistry {
  return {
    keys: [],
    kind: AGENT_SKILL_TRUSTED_SIGNATURE_KEY_REGISTRY_KIND,
  };
}

export function parseAgentSkillTrustedSignatureKeyRegistryJson(
  rawText?: string | null,
): AgentSkillTrustedSignatureKeyRegistry {
  if (!rawText?.trim()) {
    return createEmptyAgentSkillTrustedSignatureKeyRegistry();
  }
  const parsed = JSON.parse(rawText) as unknown;
  const keys = isRecord(parsed) && Array.isArray(parsed.keys)
    ? parsed.keys.map(normalizeKey).filter((key): key is AgentSkillTrustedSignatureKeyRecord => Boolean(key))
    : [];
  return {
    keys: keys.slice(0, MAX_AGENT_SKILL_TRUSTED_SIGNATURE_KEYS),
    kind: AGENT_SKILL_TRUSTED_SIGNATURE_KEY_REGISTRY_KIND,
  };
}

export function serializeAgentSkillTrustedSignatureKeyRegistry(
  registry: AgentSkillTrustedSignatureKeyRegistry,
) {
  return JSON.stringify({
    keys: registry.keys.slice(0, MAX_AGENT_SKILL_TRUSTED_SIGNATURE_KEYS),
    kind: AGENT_SKILL_TRUSTED_SIGNATURE_KEY_REGISTRY_KIND,
  });
}

export function upsertAgentSkillTrustedSignatureKey(
  registry: AgentSkillTrustedSignatureKeyRegistry,
  key: AgentSkillPackageTrustedSignatureKey & { label?: string },
  addedAt = new Date().toISOString(),
): AgentSkillTrustedSignatureKeyResult {
  const normalized = normalizeKey({ ...key, addedAt, label: key.label || key.keyId });
  if (!normalized) {
    return { error: 'Trusted signature key must include ed25519 algorithm, keyId, and publicKey.', registry };
  }
  return {
    error: null,
    registry: {
      keys: [
        normalized,
        ...registry.keys.filter((item) => item.keyId !== normalized.keyId),
      ].slice(0, MAX_AGENT_SKILL_TRUSTED_SIGNATURE_KEYS),
      kind: AGENT_SKILL_TRUSTED_SIGNATURE_KEY_REGISTRY_KIND,
    },
  };
}

export function removeAgentSkillTrustedSignatureKey(
  registry: AgentSkillTrustedSignatureKeyRegistry,
  keyId: string,
): AgentSkillTrustedSignatureKeyRegistry {
  return {
    keys: registry.keys.filter((key) => key.keyId !== keyId),
    kind: AGENT_SKILL_TRUSTED_SIGNATURE_KEY_REGISTRY_KIND,
  };
}
