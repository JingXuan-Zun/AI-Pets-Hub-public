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
  createExternalSkillMarketplacePublisherCatalogDeliveryService,
} = require('../electron/externalSkillMarketplacePublisherCatalogDeliveryService.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-catalog-delivery-'));
const configPath = path.join(tempRoot, 'delivery.json');
const rootRegistryPath = path.join(tempRoot, 'roots.json');
let nowMs = Date.parse('2026-07-27T00:00:00.000Z');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const catalogService = createExternalSkillMarketplacePublisherCatalogService({
  now: () => nowMs,
  rootKeyRegistryPath: rootRegistryPath,
  userDataPath: tempRoot,
});

function writeConfig(overrides = {}) {
  fs.writeFileSync(configPath, JSON.stringify({
    allowedOrigins: ['https://catalog.example.test'],
    catalogUrl: 'https://catalog.example.test/v1/publishers.json',
    enabled: true,
    kind: 'external-skill-marketplace-publisher-catalog-delivery-config.v1',
    maxResponseBytes: 262144,
    requestTimeoutMs: 100,
    ...overrides,
  }), 'utf8');
}

function createEnvelope(sequence, publisherId = 'studio.example') {
  const catalog = {
    expiresAt: '2026-08-27T00:00:00.000Z',
    issuedAt: `2026-07-${String(26 + sequence).padStart(2, '0')}T00:00:00.000Z`,
    kind: 'external-skill-marketplace-publisher-catalog.v1',
    publishers: [{
      keyFingerprint: 'a'.repeat(64),
      keyId: 'publisher-key-v1',
      publisherId,
      status: 'active',
      verifiedAt: '2026-07-27T00:00:00.000Z',
    }],
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

function jsonResponse(value, options = {}) {
  return new Response(options.body ?? JSON.stringify(value), {
    headers: { 'content-type': 'application/json', ...options.headers },
    status: options.status ?? 200,
  });
}

async function main() {
  try {
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

    let requests = 0;
    fs.writeFileSync(configPath, JSON.stringify({
      allowedOrigins: [],
      catalogUrl: null,
      enabled: false,
      kind: 'external-skill-marketplace-publisher-catalog-delivery-config.v1',
    }), 'utf8');
    const disabledService = createExternalSkillMarketplacePublisherCatalogDeliveryService({
      catalogService,
      configPath,
      request: async () => { requests += 1; },
      userDataPath: tempRoot,
    });
    assert.equal((await disabledService.refreshCatalog()).status, 'disabled');
    assert.equal(requests, 0);

    writeConfig();
    let nextResponse = jsonResponse(createEnvelope(1));
    const service = createExternalSkillMarketplacePublisherCatalogDeliveryService({
      catalogService,
      configPath,
      request: async (url, options) => {
        requests += 1;
        assert.equal(url, 'https://catalog.example.test/v1/publishers.json');
        assert.equal(options.redirect, 'manual');
        assert.equal(options.credentials, 'omit');
        return nextResponse;
      },
      userDataPath: tempRoot,
    });
    const delivered = await service.refreshCatalog();
    assert.equal(delivered.ok, true, JSON.stringify(delivered));
    assert.equal(delivered.sequence, 1);
    assert.equal(delivered.transportOrigin, 'https://catalog.example.test');
    assert.equal(catalogService.readActiveCatalog().catalog.sequence, 1);
    const activeText = fs.readFileSync(catalogService.getPaths().activeCatalogPath, 'utf8');

    nowMs = Date.parse('2026-07-28T00:00:00.000Z');
    const forged = createEnvelope(2, 'studio.forged');
    forged.catalog.publishers[0].publisherId = 'studio.attacker';
    nextResponse = jsonResponse(forged);
    assert.equal((await service.refreshCatalog()).error, 'marketplace_publisher_catalog_signature_invalid');
    assert.equal(fs.readFileSync(catalogService.getPaths().activeCatalogPath, 'utf8'), activeText);

    nextResponse = new Response(null, {
      headers: { location: 'https://other.example.test/catalog.json' },
      status: 302,
    });
    assert.equal((await service.refreshCatalog()).error, 'marketplace_catalog_delivery_redirect_rejected');
    assert.equal(fs.readFileSync(catalogService.getPaths().activeCatalogPath, 'utf8'), activeText);

    nextResponse = jsonResponse({}, { headers: { 'content-length': '262145' } });
    assert.equal((await service.refreshCatalog()).error, 'marketplace_catalog_delivery_response_too_large');

    nextResponse = new Response('{}', { headers: { 'content-type': 'text/html' }, status: 200 });
    assert.equal((await service.refreshCatalog()).error, 'marketplace_catalog_delivery_content_type_rejected');

    writeConfig({ catalogUrl: 'http://catalog.example.test/v1/publishers.json' });
    const beforeInvalidConfigRequests = requests;
    assert.equal((await service.refreshCatalog()).error, 'marketplace_catalog_delivery_config_invalid');
    assert.equal(requests, beforeInvalidConfigRequests);

    writeConfig();
    const timeoutService = createExternalSkillMarketplacePublisherCatalogDeliveryService({
      catalogService,
      configPath,
      request: async () => new Promise(() => {}),
      userDataPath: tempRoot,
    });
    assert.equal((await timeoutService.refreshCatalog()).error, 'marketplace_catalog_delivery_timeout');

    const bundledConfig = JSON.parse(fs.readFileSync(path.join(
      __dirname,
      '..',
      'electron',
      'marketplaceCatalogDelivery.json',
    ), 'utf8'));
    assert.equal(bundledConfig.enabled, false);
    const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
    const ipcSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ipcHandlers.cjs'), 'utf8');
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
    assert.equal(preloadSource.includes('refreshMarketplacePublisherCatalog'), false);
    assert.equal(ipcSource.includes('refreshMarketplacePublisherCatalog'), false);
    assert.match(mainSource, /externalSkillMarketplacePublisherCatalogDeliveryService\.refreshCatalog\(\)/u);
    console.log('agent skill marketplace publisher catalog delivery smoke passed');
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
