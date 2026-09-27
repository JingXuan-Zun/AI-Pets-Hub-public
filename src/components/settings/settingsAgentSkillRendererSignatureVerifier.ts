import { ed25519 } from '@noble/curves/ed25519';
import {
  createAgentSkillTrustedSignatureVerifierFromRegistry,
  type AgentSkillPackageCryptoVerifyInput,
  type AgentSkillTrustedSignatureKeyRegistry,
} from '../../agent';

const ED25519_SPKI_PREFIX_HEX = '302a300506032b6570032100';

function decodeHex(value: string) {
  const normalized = value.trim().replace(/^0x/u, '');
  if (!/^[\da-f]+$/iu.test(normalized) || normalized.length % 2 !== 0) {
    return null;
  }
  return Uint8Array.from(normalized.match(/../gu)?.map((chunk) => parseInt(chunk, 16)) ?? []);
}

function decodeBase64(value: string) {
  try {
    const clean = value.replace(/\s+/gu, '').replace(/-/gu, '+').replace(/_/gu, '/');
    const binary = atob(clean.padEnd(clean.length + ((4 - clean.length % 4) % 4), '='));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function bytesStartWith(value: Uint8Array, prefix: Uint8Array) {
  return prefix.every((byte, index) => value[index] === byte);
}

function unwrapEd25519PublicKey(value: Uint8Array) {
  const prefix = decodeHex(ED25519_SPKI_PREFIX_HEX);
  if (value.length === 32) {
    return value;
  }
  return prefix && bytesStartWith(value, prefix) ? value.slice(prefix.length) : null;
}

function decodePublicKey(value: string) {
  const pemBody = value.includes('-----BEGIN')
    ? value.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/gu, '')
    : '';
  const decoded = pemBody ? decodeBase64(pemBody) : decodeHex(value) ?? decodeBase64(value);
  return decoded ? unwrapEd25519PublicKey(decoded) : null;
}

function verifyRendererEd25519Signature(input: AgentSkillPackageCryptoVerifyInput) {
  try {
    const publicKey = decodePublicKey(input.publicKey);
    const signature = decodeBase64(input.signature);
    if (!publicKey || !signature) {
      return false;
    }
    return ed25519.verify(signature, new TextEncoder().encode(input.payload), publicKey);
  } catch {
    return false;
  }
}

export function createSettingsAgentSkillRendererSignatureVerifier(
  registry: AgentSkillTrustedSignatureKeyRegistry,
) {
  return createAgentSkillTrustedSignatureVerifierFromRegistry({
    registry,
    verifySignature: verifyRendererEd25519Signature,
  });
}
