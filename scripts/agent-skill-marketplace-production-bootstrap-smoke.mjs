import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { bootstrapMarketplaceProduction } from './marketplace-production-bootstrap.mjs';
import {
  loadMarketplaceProductionPackagingConfig,
} from './marketplace-production-packaging-config.mjs';

const require = createRequire(import.meta.url);
const {
  createExternalSkillMarketplacePublisherCatalogService,
} = require('../electron/externalSkillMarketplacePublisherCatalogService.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-production-bootstrap-smoke-'));
const catalogUrl = 'https://575738264.github.io/ai-desktop-pet-marketplace-catalog/v1/publishers.json';

try {
  const result = bootstrapMarketplaceProduction({
    catalogDays: 60,
    catalogUrl,
    now: () => Date.parse('2026-07-29T08:00:00.000Z'),
    outputDirectory: tempRoot,
  });
  const privateKeyPath = path.join(tempRoot, 'private', 'catalog-root-private-key.pem');
  const rootRegistryPath = path.join(tempRoot, 'production', 'marketplaceCatalogRootKeys.json');
  const deliveryConfigPath = path.join(tempRoot, 'production', 'marketplaceCatalogDelivery.json');
  const catalogPath = path.join(tempRoot, 'publish', 'v1', 'publishers.json');
  const privateKeyText = fs.readFileSync(privateKeyPath, 'utf8');
  const roots = JSON.parse(fs.readFileSync(rootRegistryPath, 'utf8'));
  const delivery = JSON.parse(fs.readFileSync(deliveryConfigPath, 'utf8'));
  const envelope = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  assert.equal(result.catalogSequence, 1);
  assert.equal(result.publisherCount, 0);
  assert.equal(result.catalogExpiresAt, '2026-09-27T08:00:00.000Z');
  assert.equal(result.rootKeyFingerprint.length, 64);
  assert.match(privateKeyText, /BEGIN PRIVATE KEY/u);
  assert.equal(JSON.stringify({ roots, delivery, envelope }).includes('PRIVATE KEY'), false);
  assert.equal(delivery.catalogUrl, catalogUrl);
  assert.deepEqual(envelope.catalog.publishers, []);
  assert.equal(envelope.signature.keyId, roots.keys[0].keyId);
  assert.equal(
    crypto.createPrivateKey(privateKeyText).asymmetricKeyType,
    'ed25519',
  );

  const catalogService = createExternalSkillMarketplacePublisherCatalogService({
    rootKeyRegistryPath: rootRegistryPath,
    userDataPath: path.join(tempRoot, 'verification-profile'),
  });
  assert.equal(catalogService.verifyEnvelope(envelope).ok, true);
  const packaging = await loadMarketplaceProductionPackagingConfig({
    env: {
      DESKTOP_PET_MARKETPLACE_DELIVERY_CONFIG_PATH: deliveryConfigPath,
      DESKTOP_PET_MARKETPLACE_ROOT_KEYS_PATH: rootRegistryPath,
    },
    projectRoot: tempRoot,
    required: true,
  });
  assert.equal(packaging.enabled, true);
  assert.equal(packaging.summary.activeRootKeyCount, 1);
  assert.equal(packaging.summary.transportOrigin, 'https://575738264.github.io');
  assert.throws(
    () => bootstrapMarketplaceProduction({ catalogUrl, outputDirectory: tempRoot }),
    /Refusing to overwrite existing marketplace production directory/u,
  );
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

console.log('agent skill marketplace production bootstrap smoke passed');
