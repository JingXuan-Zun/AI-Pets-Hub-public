const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createExternalSkillMarketplacePublisherCatalogDeliveryService,
} = require('../electron/externalSkillMarketplacePublisherCatalogDeliveryService.cjs');
const {
  createCanonicalPublisherCatalogPayload,
  createExternalSkillMarketplacePublisherCatalogService,
} = require('../electron/externalSkillMarketplacePublisherCatalogService.cjs');
const {
  createExternalSkillMarketplaceProductionReadinessService,
} = require('../electron/externalSkillMarketplaceProductionReadinessService.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-marketplace-production-readiness-'));
const configPath = path.join(tempRoot, 'delivery.json');
const rootRegistryPath = path.join(tempRoot, 'roots.json');
const nowMs = Date.parse('2026-07-28T12:00:00.000Z');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();

function writeRootRegistry(keys = []) {
  fs.writeFileSync(rootRegistryPath, JSON.stringify({
    keys,
    kind: 'external-skill-marketplace-catalog-root-key-registry.v1',
    minimumSequence: 1,
  }), 'utf8');
}

function writeDeliveryConfig(value) {
  fs.writeFileSync(configPath, JSON.stringify(value), 'utf8');
}

function createEnvelope() {
  const catalog = {
    expiresAt: '2026-08-28T12:00:00.000Z',
    issuedAt: '2026-07-28T11:00:00.000Z',
    kind: 'external-skill-marketplace-publisher-catalog.v1',
    publishers: [{
      keyFingerprint: 'a'.repeat(64),
      keyId: 'publisher-key-v1',
      publisherId: 'studio.example',
      status: 'active',
      verifiedAt: '2026-07-28T11:00:00.000Z',
    }],
    sequence: 1,
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

try {
  writeRootRegistry();
  writeDeliveryConfig({
    allowedOrigins: [],
    catalogUrl: null,
    enabled: false,
    kind: 'external-skill-marketplace-publisher-catalog-delivery-config.v1',
  });
  const catalogService = createExternalSkillMarketplacePublisherCatalogService({
    now: () => nowMs,
    rootKeyRegistryPath: rootRegistryPath,
    userDataPath: tempRoot,
  });
  const deliveryService = createExternalSkillMarketplacePublisherCatalogDeliveryService({
    catalogService,
    configPath,
    now: () => nowMs,
    userDataPath: tempRoot,
  });
  const readinessService = createExternalSkillMarketplaceProductionReadinessService({
    catalogService,
    deliveryService,
    now: () => nowMs,
  });

  const notConfigured = readinessService.createReport();
  assert.equal(notConfigured.status, 'not-configured');
  assert.equal(notConfigured.operationalConfigurationReady, false);
  assert.equal(notConfigured.marketReleaseAllowed, false);
  assert.equal(notConfigured.marketReleaseStatus, 'disabled');
  assert.equal(notConfigured.rootRegistry.totalKeyCount, 0);
  assert.equal(notConfigured.delivery.enabled, false);

  fs.writeFileSync(configPath, '{bad', 'utf8');
  const invalid = readinessService.createReport();
  assert.equal(invalid.status, 'invalid');
  assert.equal(invalid.issueCodes.includes('catalog-delivery-config'), true);

  writeRootRegistry([{
    algorithm: 'ed25519',
    keyId: 'market-root-v1',
    publicKey: publicKeyPem,
    status: 'active',
  }]);
  writeDeliveryConfig({
    allowedOrigins: ['https://catalog.example.test'],
    catalogUrl: 'https://catalog.example.test/private/v1/publishers.json?channel=production',
    enabled: true,
    kind: 'external-skill-marketplace-publisher-catalog-delivery-config.v1',
    maxResponseBytes: 262144,
    requestTimeoutMs: 10000,
  });
  const incomplete = readinessService.createReport();
  assert.equal(incomplete.status, 'incomplete');
  assert.equal(incomplete.rootRegistry.activeKeyCount, 1);
  assert.equal(incomplete.delivery.transportOrigin, 'https://catalog.example.test');
  assert.equal(incomplete.activeCatalog.status, 'missing');

  assert.equal(catalogService.provisionCatalog(createEnvelope()).ok, true);
  const ready = readinessService.createReport();
  assert.equal(ready.status, 'ready-disabled');
  assert.equal(ready.operationalConfigurationReady, true);
  assert.equal(ready.marketReleaseAllowed, false);
  assert.equal(ready.issueCodes.includes('marketplace-release-disabled'), true);
  assert.equal(ready.activeCatalog.sequence, 1);
  assert.equal(ready.activeCatalog.publisherCount, 1);

  const exported = readinessService.exportReport();
  assert.equal(exported.ok, true);
  assert.equal(exported.mimeType, 'application/json');
  assert.equal(JSON.parse(exported.text).status, 'ready-disabled');
  assert.equal(exported.text.includes(publicKeyPem.trim()), false);
  assert.equal(exported.text.includes(tempRoot), false);
  assert.equal(exported.text.includes('/private/v1/publishers.json'), false);
  assert.equal(exported.text.includes('https://catalog.example.test'), true);

  const rootStatusText = JSON.stringify(catalogService.getRootRegistryStatus());
  assert.equal(rootStatusText.includes('PUBLIC KEY'), false);
  assert.equal(rootStatusText.includes(rootRegistryPath), false);

  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  const ipcSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ipcHandlers.cjs'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  const panelSource = fs.readFileSync(path.join(
    __dirname,
    '..',
    'src',
    'components',
    'settings',
    'SettingsAgentSkillMarketplaceProductionReadinessPanel.tsx',
  ), 'utf8');
  const wrapperSource = fs.readFileSync(path.join(
    __dirname,
    '..',
    'src',
    'components',
    'settings',
    'SettingsAgentSkillSignedPackageUpdatePanels.tsx',
  ), 'utf8');
  assert.match(mainSource, /createExternalSkillMarketplaceProductionReadinessService/u);
  assert.match(ipcSource, /get-external-skill-marketplace-production-readiness/u);
  assert.match(preloadSource, /getExternalSkillMarketplaceProductionReadiness/u);
  assert.match(panelSource, /Marketplace production readiness/u);
  assert.match(wrapperSource, /SettingsAgentSkillMarketplaceProductionReadinessPanel/u);
  assert.equal(preloadSource.includes('refreshMarketplacePublisherCatalog'), false);

  console.log('agent skill marketplace production readiness smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
