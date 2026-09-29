const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createCanonicalPublisherCatalogPayload,
  createExternalSkillMarketplacePublisherCatalogService,
} = require('../electron/externalSkillMarketplacePublisherCatalogService.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-publisher-catalog-'));
const rootRegistryPath = path.join(tempRoot, 'app-owned-root-keys.json');
let nowMs = Date.parse('2026-07-27T00:00:00.000Z');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const service = createExternalSkillMarketplacePublisherCatalogService({
  now: () => nowMs,
  rootKeyRegistryPath: rootRegistryPath,
  userDataPath: tempRoot,
});

function writeRoots(status = 'active', minimumSequence = 1) {
  fs.writeFileSync(rootRegistryPath, JSON.stringify({
    keys: [{
      algorithm: 'ed25519',
      keyId: 'market-root-v1',
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      status,
    }],
    kind: 'external-skill-marketplace-catalog-root-key-registry.v1',
    minimumSequence,
  }), 'utf8');
}

function createEnvelope(sequence, publishers, options = {}) {
  const catalog = {
    expiresAt: options.expiresAt ?? '2026-08-27T00:00:00.000Z',
    issuedAt: options.issuedAt ?? `2026-07-${String(26 + sequence).padStart(2, '0')}T00:00:00.000Z`,
    kind: 'external-skill-marketplace-publisher-catalog.v1',
    publishers,
    sequence,
  };
  return {
    catalog,
    kind: 'external-skill-marketplace-publisher-catalog-envelope.v1',
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-marketplace-publisher-catalog-v1',
      keyId: 'market-root-v1',
      signature: crypto.sign(
        null,
        Buffer.from(createCanonicalPublisherCatalogPayload(catalog)),
        privateKey,
      ).toString('base64'),
    },
  };
}

const publisher = {
  keyFingerprint: 'a'.repeat(64),
  keyId: 'publisher-key-v1',
  publisherId: 'studio.example',
  status: 'active',
  verifiedAt: '2026-07-27T00:00:00.000Z',
};

try {
  const bundledRoots = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '..',
    'electron',
    'marketplaceCatalogRootKeys.json',
  ), 'utf8'));
  assert.equal(bundledRoots.kind, 'external-skill-marketplace-catalog-root-key-registry.v1');
  assert.deepEqual(bundledRoots.keys, []);
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  assert.equal(preloadSource.includes('provisionMarketplacePublisherCatalog'), false);
  const gatewaySource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'externalSkillCapabilityGateway.cjs'), 'utf8');
  const identitySource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'externalSkillMarketplacePublisherIdentityService.cjs'), 'utf8');
  assert.match(gatewaySource, /createExternalSkillMarketplacePublisherIdentityService/u);
  assert.match(identitySource, /catalog\.initialize\(\)/u);
  assert.match(identitySource, /catalog\.readActiveCatalog\(\)/u);

  const envelopeOne = createEnvelope(1, [publisher]);
  assert.equal(service.verifyEnvelope(envelopeOne).error, 'marketplace_catalog_root_registry_missing');
  writeRoots();

  const provisionedOne = service.provisionCatalog(envelopeOne);
  assert.equal(provisionedOne.ok, true, JSON.stringify(provisionedOne));
  assert.equal(provisionedOne.sequence, 1);
  assert.equal(service.readActiveCatalog().catalog.publishers[0].publisherId, 'studio.example');
  const activeTextOne = fs.readFileSync(service.getPaths().activeCatalogPath, 'utf8');

  const forged = createEnvelope(2, [{ ...publisher, publisherId: 'studio.forged' }]);
  forged.catalog.publishers[0].publisherId = 'studio.attacker';
  assert.equal(service.provisionCatalog(forged).error, 'marketplace_publisher_catalog_signature_invalid');
  assert.equal(fs.readFileSync(service.getPaths().activeCatalogPath, 'utf8'), activeTextOne);
  assert.equal(service.provisionCatalog(envelopeOne).error, 'marketplace_publisher_catalog_replay_rejected');

  const future = createEnvelope(2, [publisher], {
    expiresAt: '2026-09-01T00:00:00.000Z',
    issuedAt: '2026-08-01T00:00:00.000Z',
  });
  assert.equal(service.provisionCatalog(future).error, 'marketplace_publisher_catalog_not_yet_valid');

  nowMs = Date.parse('2026-07-28T00:00:00.000Z');
  const envelopeTwo = createEnvelope(2, [{ ...publisher, status: 'revoked' }]);
  const provisionedTwo = service.provisionCatalog(envelopeTwo);
  assert.equal(provisionedTwo.ok, true, JSON.stringify(provisionedTwo));
  assert.equal(provisionedTwo.sequence, 2);
  assert.equal(service.readActiveCatalog().catalog.publishers[0].status, 'revoked');

  fs.writeFileSync(service.getPaths().activeCatalogPath, '{bad', 'utf8');
  const recovered = service.recoverActiveCatalog();
  assert.equal(recovered.ok, true, JSON.stringify(recovered));
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.sequence, 2);

  nowMs = Date.parse('2026-08-28T00:00:00.000Z');
  assert.equal(service.readActiveCatalog().status, 'expired');
  writeRoots('revoked');
  assert.equal(service.readActiveCatalog({ allowExpired: true }).error, 'marketplace_publisher_catalog_root_key_revoked');

  writeRoots('active', 3);
  assert.equal(service.readActiveCatalog({ allowExpired: true }).error, 'marketplace_publisher_catalog_below_minimum_sequence');
  assert.equal(JSON.stringify(service.readActiveCatalog()).includes(tempRoot), false);
  console.log('agent skill marketplace publisher catalog service smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
