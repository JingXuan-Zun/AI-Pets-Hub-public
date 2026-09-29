import {
  createAgentSkillPackageCanonicalSignaturePayload,
} from './agentSkillPackageSignaturePayload';
import {
  type AgentSkillPackageSignatureVerifier,
  type AgentSkillPackageSignatureVerifierInput,
  type AgentSkillPackageSignatureVerifierResult,
} from './agentSkillPackageSignatureVerifier';

export interface AgentSkillPackageTrustedSignatureKey {
  algorithm: 'ed25519';
  keyId: string;
  publicKey: string;
}

export interface AgentSkillPackageCryptoSignatureVerifierOptions {
  trustedKeys: readonly AgentSkillPackageTrustedSignatureKey[];
  verifySignature: (input: AgentSkillPackageCryptoVerifyInput) => boolean;
}

export interface AgentSkillPackageCryptoVerifyInput {
  algorithm: 'ed25519';
  payload: string;
  publicKey: string;
  signature: string;
}

function findTrustedKey(
  input: AgentSkillPackageSignatureVerifierInput,
  trustedKeys: readonly AgentSkillPackageTrustedSignatureKey[],
) {
  return trustedKeys.find((key) => (
    key.keyId === input.metadata.keyId && key.algorithm === input.metadata.algorithm
  )) ?? null;
}

function createUnsupportedResult(issueCodes: string[]) {
  return {
    issueCodes,
    status: 'unsupported',
    verifier: 'crypto-signature-verifier',
  } satisfies AgentSkillPackageSignatureVerifierResult;
}

function createInvalidResult(issueCodes: string[]) {
  return {
    issueCodes,
    status: 'invalid',
    verifier: 'crypto-signature-verifier',
  } satisfies AgentSkillPackageSignatureVerifierResult;
}

function createVerifiedResult() {
  return {
    issueCodes: [],
    status: 'verified',
    verifier: 'crypto-signature-verifier',
  } satisfies AgentSkillPackageSignatureVerifierResult;
}

function verifyEd25519Signature(
  input: AgentSkillPackageSignatureVerifierInput,
  trustedKey: AgentSkillPackageTrustedSignatureKey,
  options: AgentSkillPackageCryptoSignatureVerifierOptions,
): AgentSkillPackageSignatureVerifierResult {
  const payload = createAgentSkillPackageCanonicalSignaturePayload(input.item);
  const verified = options.verifySignature({
    algorithm: 'ed25519',
    payload,
    publicKey: trustedKey.publicKey,
    signature: input.metadata.signature,
  });
  return verified ? createVerifiedResult() : createInvalidResult(['signature-crypto-verification-failed']);
}

export function createAgentSkillCryptoSignatureVerifier(
  options: AgentSkillPackageCryptoSignatureVerifierOptions,
): AgentSkillPackageSignatureVerifier {
  return {
    verifier: 'crypto-signature-verifier',
    verify(input) {
      if (input.metadata.algorithm !== 'ed25519') {
        return createUnsupportedResult(['signature-algorithm-unsupported']);
      }
      const trustedKey = findTrustedKey(input, options.trustedKeys);
      if (!trustedKey) {
        return createUnsupportedResult(['signature-trusted-key-missing']);
      }
      return verifyEd25519Signature(input, trustedKey, options);
    },
  };
}
