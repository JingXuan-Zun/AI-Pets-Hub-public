import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  assertMarketplaceProductionPackagingMode,
  createMarketplaceProductionExtraResources,
  loadMarketplaceProductionPackagingConfig,
  MARKETPLACE_DELIVERY_CONFIG_ENV,
  MARKETPLACE_ROOT_KEYS_ENV,
} from './marketplace-production-packaging-config.mjs';

const require = createRequire(import.meta.url);
const {
  resolveExternalSkillMarketplaceProductionConfigPaths,
} = require('../electron/externalSkillMarketplaceProductionConfigPaths.cjs');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-marketplace-production-package-'));
const rootKeyRegistryPath = path.join(tempRoot, 'roots.json');
const deliveryConfigPath = path.join(tempRoot, 'delivery.json');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

function writeRoots(keys) {
  fs.writeFileSync(rootKeyRegistryPath, JSON.stringify({
    keys,
    kind: 'external-skill-marketplace-catalog-root-key-registry.v1',
    minimumSequence: 7,
  }), 'utf8');
}

function writeDelivery(enabled) {
  fs.writeFileSync(deliveryConfigPath, JSON.stringify({
    allowedOrigins: enabled ? ['https://catalog.example.test'] : [],
    catalogUrl: enabled ? 'https://catalog.example.test/private/catalog.json' : null,
    enabled,
    kind: 'external-skill-marketplace-publisher-catalog-delivery-config.v1',
    maxResponseBytes: 262144,
    requestTimeoutMs: 10000,
  }), 'utf8');
}

try {
  const disabled = await loadMarketplaceProductionPackagingConfig({ env: {}, projectRoot });
  assert.deepEqual(disabled, { enabled: false, source: 'bundled-default' });
  await assert.rejects(
    loadMarketplaceProductionPackagingConfig({
      env: { [MARKETPLACE_ROOT_KEYS_ENV]: rootKeyRegistryPath },
      projectRoot,
    }),
    /Set both/u,
  );

  writeRoots([]);
  writeDelivery(true);
  await assert.rejects(
    loadMarketplaceProductionPackagingConfig({
      env: {
        [MARKETPLACE_DELIVERY_CONFIG_ENV]: deliveryConfigPath,
        [MARKETPLACE_ROOT_KEYS_ENV]: rootKeyRegistryPath,
      },
      projectRoot,
    }),
    /no active root key/u,
  );

  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  writeRoots([{
    algorithm: 'ed25519',
    keyId: 'market-root-v1',
    publicKey: privateKeyPem,
    status: 'active',
  }]);
  writeDelivery(true);
  await assert.rejects(
    loadMarketplaceProductionPackagingConfig({
      env: {
        [MARKETPLACE_DELIVERY_CONFIG_ENV]: deliveryConfigPath,
        [MARKETPLACE_ROOT_KEYS_ENV]: rootKeyRegistryPath,
      },
      projectRoot,
    }),
    /root_registry_invalid/u,
  );

  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  writeRoots([{
    algorithm: 'ed25519',
    keyId: 'market-root-v1',
    publicKey: publicKeyPem,
    status: 'active',
  }]);
  writeDelivery(false);
  await assert.rejects(
    loadMarketplaceProductionPackagingConfig({
      env: {
        [MARKETPLACE_DELIVERY_CONFIG_ENV]: deliveryConfigPath,
        [MARKETPLACE_ROOT_KEYS_ENV]: rootKeyRegistryPath,
      },
      projectRoot,
    }),
    /not enabled and ready/u,
  );

  writeDelivery(true);
  const env = {
    [MARKETPLACE_DELIVERY_CONFIG_ENV]: deliveryConfigPath,
    [MARKETPLACE_ROOT_KEYS_ENV]: rootKeyRegistryPath,
  };
  const ready = await loadMarketplaceProductionPackagingConfig({ env, projectRoot, required: true });
  assert.equal(ready.enabled, true);
  assert.deepEqual(ready.summary, {
    activeRootKeyCount: 1,
    minimumSequence: 7,
    totalRootKeyCount: 1,
    transportOrigin: 'https://catalog.example.test',
  });
  assert.equal(JSON.stringify(ready.summary).includes('/private/catalog.json'), false);
  assert.equal(JSON.stringify(ready.summary).includes(publicKeyPem.trim()), false);
  assert.deepEqual(
    createMarketplaceProductionExtraResources(ready).map((entry) => entry.to),
    [
      'marketplace-production/marketplaceCatalogRootKeys.json',
      'marketplace-production/marketplaceCatalogDelivery.json',
    ],
  );

  assert.doesNotThrow(() => assertMarketplaceProductionPackagingMode(ready, 'production-fresh'));
  assert.throws(
    () => assertMarketplaceProductionPackagingMode(ready, 'ordinary-fresh'),
    /ordinary fresh builds cannot enroll production trust/u,
  );
  assert.throws(
    () => assertMarketplaceProductionPackagingMode(ready, 'incremental'),
    /incremental packaging cannot update the portable EXE/u,
  );

  const resourcesPath = path.join(tempRoot, 'resources');
  const bundledDirectory = path.join(tempRoot, 'bundled');
  assert.equal(resolveExternalSkillMarketplaceProductionConfigPaths({ bundledDirectory, resourcesPath }).configSource, 'bundled-default');
  fs.mkdirSync(path.join(resourcesPath, 'marketplace-production'), { recursive: true });
  const resolvedProduction = resolveExternalSkillMarketplaceProductionConfigPaths({ bundledDirectory, resourcesPath });
  assert.equal(resolvedProduction.configSource, 'packaged-production');
  assert.equal(resolvedProduction.rootKeyRegistryPath.endsWith('marketplaceCatalogRootKeys.json'), true);

  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['dist:win:production'], /--require-marketplace-production/u);
  assert.match(packageJson.scripts['dist:win:production'], /--outDir release\/\.fresh-renderer-dist/u);
  const freshSource = fs.readFileSync(path.join(projectRoot, 'scripts', 'dist-win-fresh.mjs'), 'utf8');
  const incrementalSource = fs.readFileSync(path.join(projectRoot, 'scripts', 'dist-win-incremental.mjs'), 'utf8');
  assert.match(freshSource, /createMarketplaceProductionExtraResources/u);
  assert.match(freshSource, /assertMarketplaceProductionPackagingMode/u);
  assert.match(freshSource, /prepareFreshPackagingInput/u);
  assert.match(freshSource, /packagingInputRoot/u);
  assert.match(freshSource, /copyFileWithRetry/u);
  assert.match(freshSource, /afterPack: copyFreshExtraResources/u);
  assert.match(incrementalSource, /assertMarketplaceProductionPackagingMode\(marketplaceProductionConfig, 'incremental'\)/u);

  console.log('agent skill marketplace production packaging smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
