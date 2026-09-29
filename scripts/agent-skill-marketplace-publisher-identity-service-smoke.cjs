const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createCanonicalPublisherCatalogPayload,
  createExternalSkillMarketplacePublisherCatalogService,
} = require('../electron/externalSkillMarketplacePublisherCatalogService.cjs');
const {
  createExternalSkillMarketplacePublisherIdentityService,
} = require('../electron/externalSkillMarketplacePublisherIdentityService.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-marketplace-publisher-'));
let nowMs = Date.parse('2026-07-27T00:00:00.000Z');
const rootRegistryPath = path.join(tempRoot, 'root-keys.json');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(rootRegistryPath, JSON.stringify({
  keys: [{
    algorithm: 'ed25519',
    keyId: 'market-root-v1',
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    status: 'active',
  }],
  kind: 'external-skill-marketplace-catalog-root-key-registry.v1',
  minimumSequence: 1,
}), 'utf8');
const catalogService = createExternalSkillMarketplacePublisherCatalogService({
  now: () => nowMs,
  rootKeyRegistryPath: rootRegistryPath,
  userDataPath: tempRoot,
});
const service = createExternalSkillMarketplacePublisherIdentityService({ catalogService, userDataPath: tempRoot });
const keyFingerprint = 'a'.repeat(64);
const artifact = {
  signatureVerification: {
    keyFingerprint,
    keyId: 'publisher-key-v1',
    publisherId: 'studio.example',
    status: 'verified',
    verifier: 'main-process-ed25519',
  },
};

function provision(status = 'active', sequence = 1) {
  const catalog = {
    expiresAt: '2026-08-27T00:00:00.000Z',
    issuedAt: `2026-07-${String(26 + sequence).padStart(2, '0')}T00:00:00.000Z`,
    kind: 'external-skill-marketplace-publisher-catalog.v1',
    publishers: [{
      keyFingerprint,
      keyId: 'publisher-key-v1',
      publisherId: 'studio.example',
      status,
      verifiedAt: '2026-07-27T00:00:00.000Z',
    }],
    sequence,
  };
  return catalogService.provisionCatalog({
    catalog,
    kind: 'external-skill-marketplace-publisher-catalog-envelope.v1',
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-marketplace-publisher-catalog-v1',
      keyId: 'market-root-v1',
      signature: crypto.sign(null, Buffer.from(createCanonicalPublisherCatalogPayload(catalog)), privateKey).toString('base64'),
    },
  });
}

try {
  const missingRegistry = service.assessArtifact(artifact);
  assert.equal(missingRegistry.status, 'blocked');
  assert.equal(missingRegistry.registryStatus, 'missing');
  assert.equal(missingRegistry.issueCodes.includes('marketplace-publisher-registry-missing'), true);

  assert.equal(provision().ok, true);
  const verified = service.assessArtifact(artifact);
  assert.equal(verified.status, 'verified');
  assert.equal(verified.registryStatus, 'ready');
  assert.equal(verified.catalogSequence, 1);
  assert.equal(verified.rootKeyId, 'market-root-v1');
  assert.deepEqual(verified.issueCodes, []);

  const missingIdentity = service.assessArtifact({ signatureVerification: {} });
  assert.equal(missingIdentity.status, 'blocked');
  assert.equal(missingIdentity.issueCodes.includes('marketplace-publisher-id-missing'), true);

  const impersonated = service.assessArtifact({
    signatureVerification: { ...artifact.signatureVerification, keyFingerprint: 'b'.repeat(64) },
  });
  assert.equal(impersonated.status, 'blocked');
  assert.equal(impersonated.issueCodes.includes('marketplace-publisher-key-fingerprint-mismatch'), true);

  nowMs = Date.parse('2026-07-28T00:00:00.000Z');
  assert.equal(provision('revoked', 2).ok, true);
  const revoked = service.assessArtifact(artifact);
  assert.equal(revoked.status, 'blocked');
  assert.equal(revoked.issueCodes.includes('marketplace-publisher-revoked'), true);

  fs.writeFileSync(service.getPaths().marketplacePublisherRegistryPath, JSON.stringify({
    kind: 'external-skill-marketplace-publisher-registry.v1',
    publishers: [],
  }), 'utf8');
  const forgedLegacyRegistry = service.assessArtifact(artifact);
  assert.equal(forgedLegacyRegistry.status, 'blocked');
  assert.equal(forgedLegacyRegistry.registryStatus, 'invalid');
  assert.equal(forgedLegacyRegistry.issueCodes.includes('marketplace-publisher-registry-invalid'), true);
  assert.equal(typeof service.replaceRegistry, 'undefined');

  console.log('agent skill marketplace publisher identity service smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
