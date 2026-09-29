import {
  createAgentSkillCryptoSignatureVerifier,
  type AgentSkillPackageCryptoVerifyInput,
} from './agentSkillPackageCryptoSignatureVerifier';
import { type AgentSkillPackageSignatureVerifier } from './agentSkillPackageSignatureVerifier';
import { type AgentSkillTrustedSignatureKeyRegistry } from './agentSkillPackageTrustedSignatureKeyRegistry';

export interface AgentSkillTrustedSignatureVerifierFactoryOptions {
  registry: AgentSkillTrustedSignatureKeyRegistry;
  verifySignature: (input: AgentSkillPackageCryptoVerifyInput) => boolean;
}

export interface AgentSkillTrustedSignatureVerifierFactoryResult {
  issueCodes: string[];
  verifier: AgentSkillPackageSignatureVerifier | null;
}

export function createAgentSkillTrustedSignatureVerifierFromRegistry(
  options: AgentSkillTrustedSignatureVerifierFactoryOptions,
): AgentSkillTrustedSignatureVerifierFactoryResult {
  if (!options.registry.keys.length) {
    return {
      issueCodes: ['trusted-signature-key-registry-empty'],
      verifier: null,
    };
  }
  return {
    issueCodes: [],
    verifier: createAgentSkillCryptoSignatureVerifier({
      trustedKeys: options.registry.keys,
      verifySignature: options.verifySignature,
    }),
  };
}
